import {
  createFloorCommand,
  createRoofCommand,
  createTagCommand,
  undoCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../domain/commands';
import { createDimensionCommand, createSheetCommand, createViewCommand, placeOnSheetCommand } from '../domain/commandsDocs';
import {
  copyWallsToLevelCommand,
  createGridCommand,
  createRectangleWallsCommand,
  mirrorWallsCommand,
  createStairCommand,
} from '../domain/commandsExtended';
import { roomBoundary } from '../domain/derived';
import type { BimModel, CompassDir, Point, RoomElement, StairDirection, StairElement, WallElement } from '../domain/types';
import { lockAxis, projectOnWall } from '../plan/snap';
import { EMPTY_CHAIN, placeOpening, placeRoomAt, wallChainTap, type ChainState } from '../ui/workspace/toolActions';
import { levelTap, roofLevelId, type CommandId, type HouseGeom, type LevelDef, type StepDef } from './model';

/**
 * One level of the campaign as plain data plus pure functions, so the screen
 * only draws and forwards taps. Taps are in plan millimetres ([x, z]), or
 * [0, elevation] on the elevation view.
 */

export type DrawMode = 'line' | 'rect';

export interface PlayState {
  session: MissionSessionState;
  stepIndex: number;
  command: CommandId | null;
  chain: ChainState;
  /** First point of a two-tap tool (grid, rectangle, stair, section). */
  firstTap: Point | null;
  /** Wall tool draw option, as on Revit's Draw panel. */
  drawMode: DrawMode;
  /** Room waiting for a name after it was tagged. */
  namingRoomId: string | null;
  taps: number;
  wrongPicks: number;
  done: boolean;
}

export type Effect = 'select' | 'snap' | 'build' | 'error' | 'success';

export interface TapResult {
  state: PlayState;
  effect?: Effect;
  message?: string;
}

export const SNAP = 1000;
export const ELEVATION_SNAP = 500;
const snap = (v: number, step: number) => Math.round(v / step) * step;
export const snapPoint = (p: Point): Point => [snap(p[0], SNAP), snap(p[1], SNAP)];

export function newPlay(session: MissionSessionState): PlayState {
  return {
    session,
    stepIndex: 0,
    command: null,
    chain: EMPTY_CHAIN,
    firstTap: null,
    drawMode: 'line',
    namingRoomId: null,
    taps: 0,
    wrongPicks: 0,
    done: false,
  };
}

export const currentStep = (level: LevelDef, st: PlayState) => level.steps[Math.min(st.stepIndex, level.steps.length - 1)];
export const stepLevel = (s: StepDef) => s.on ?? 'l0';

/** Picking a ribbon command. A wrong pick costs the second star. */
export function pickCommand(level: LevelDef, st: PlayState, id: CommandId): TapResult {
  const want = currentStep(level, st).command;
  if (id !== want) return { state: { ...st, wrongPicks: st.wrongPicks + 1 }, effect: 'error' };
  return { state: { ...st, command: id, chain: EMPTY_CHAIN, firstTap: null }, effect: 'select' };
}

/** Line / Rectangle on the wall tool's Draw panel. */
export function setDrawMode(st: PlayState, mode: DrawMode): TapResult {
  return { state: { ...st, drawMode: mode, chain: EMPTY_CHAIN, firstTap: null }, effect: 'select' };
}

const wallsOn = (m: BimModel, levelId: string) =>
  m.elements.filter((e): e is WallElement => e.type === 'wall' && e.baseLevelId === levelId);

function nearestWall(m: BimModel, levelId: string, p: Point, maxDist = 900): WallElement | null {
  let best: { w: WallElement; d: number } | null = null;
  for (const w of wallsOn(m, levelId)) {
    const along = projectOnWall(w, p);
    const len = Math.abs(w.end[0] - w.start[0]) + Math.abs(w.end[1] - w.start[1]);
    if (len === 0) continue;
    const k = along / len;
    const q: Point = [w.start[0] + (w.end[0] - w.start[0]) * k, w.start[1] + (w.end[1] - w.start[1]) * k];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d <= maxDist && (!best || d < best.d)) best = { w, d };
  }
  return best?.w ?? null;
}

/** Centre of a door or window in plan. */
export function openingCentre(m: BimModel, id: string): Point | null {
  const o = m.elements.find((e) => e.id === id);
  if (!o || (o.type !== 'door' && o.type !== 'window')) return null;
  const host = m.elements.find((e): e is WallElement => e.type === 'wall' && e.id === o.hostWallId);
  if (!host) return null;
  const len = Math.abs(host.end[0] - host.start[0]) + Math.abs(host.end[1] - host.start[1]);
  const k = (o.offset + o.width / 2) / len;
  return [host.start[0] + (host.end[0] - host.start[0]) * k, host.start[1] + (host.end[1] - host.start[1]) * k];
}

function openingNear(m: BimModel, levelId: string, p: Point, maxDist = 800): string | null {
  let best: { id: string; d: number } | null = null;
  for (const e of m.elements) {
    if (e.type !== 'door' && e.type !== 'window') continue;
    const host = m.elements.find((w) => w.id === e.hostWallId);
    if (!host || host.type !== 'wall' || host.baseLevelId !== levelId) continue;
    const c = openingCentre(m, e.id);
    if (!c) continue;
    const d = Math.hypot(p[0] - c[0], p[1] - c[1]);
    if (d <= maxDist && (!best || d < best.d)) best = { id: e.id, d };
  }
  return best?.id ?? null;
}

/** Which facade a tap outside the house asks for (north is up in the plan). */
export function facadeAt(g: HouseGeom, p: Point): CompassDir | null {
  if (p[1] > g.d) return 'S';
  if (p[1] < 0) return 'N';
  if (p[0] > g.w) return 'E';
  if (p[0] < 0) return 'W';
  return null;
}

export function roomAt(s: MissionSessionState, p: Point, levelId = 'l0'): RoomElement | null {
  for (const e of s.model.elements) {
    if (e.type !== 'room' || e.levelId !== levelId) continue;
    const b = roomBoundary(e, s.model);
    if (!b.open && b.rects.some(([x0, z0, x1, z1]) => p[0] >= Math.min(x0, x1) && p[0] <= Math.max(x0, x1) && p[1] >= Math.min(z0, z1) && p[1] <= Math.max(z0, z1))) return e;
  }
  return null;
}

const insideHouse = (g: HouseGeom, p: Point) => p[0] > 0 && p[0] < g.w && p[1] > 0 && p[1] < g.d;

/** Plan rectangle a stair covers: [x0, z0, x1, z1]. */
export function stairRect(s: StairElement): [number, number, number, number] {
  const run = s.risers * s.treadDepth;
  const [x, z] = s.start;
  switch (s.direction) {
    case 'x+':
      return [x, z, x + run, z + s.width];
    case 'x-':
      return [x - run, z, x, z + s.width];
    case 'z+':
      return [x, z, x + s.width, z + run];
    case 'z-':
      return [x, z - run, x + s.width, z];
  }
}

/**
 * Upper floor outline with the stair opening cut out, as you would with Edit
 * Boundary in Revit. The opening is pushed to the nearest outer edge so the
 * outline stays one simple polygon.
 */
export function floorOutlineWithOpening(g: HouseGeom, m: BimModel, levelId: string): Point[] | undefined {
  const stair = m.elements.find((e): e is StairElement => e.type === 'stair' && e.topLevelId === levelId);
  if (!stair) return undefined;
  const [sx0, sz0, sx1, sz1] = stairRect(stair);
  const W = g.w;
  const D = g.d;
  const pad = 100;
  const gaps = { left: sx0, right: W - sx1, front: sz0, back: D - sz1 };
  const side = (Object.keys(gaps) as Array<keyof typeof gaps>).reduce((a, b) => (gaps[a] <= gaps[b] ? a : b));
  const a0 = Math.max(0, sz0 - pad), a1 = Math.min(D, sz1 + pad);
  const b0 = Math.max(0, sx0 - pad), b1 = Math.min(W, sx1 + pad);
  switch (side) {
    case 'left':
      return [[0, 0], [W, 0], [W, D], [0, D], [0, a1], [b1, a1], [b1, a0], [0, a0]];
    case 'right':
      return [[0, 0], [W, 0], [W, a0], [b0, a0], [b0, a1], [W, a1], [W, D], [0, D]];
    case 'front':
      return [[0, 0], [b0, 0], [b0, a1], [b1, a1], [b1, 0], [W, 0], [W, D], [0, D]];
    case 'back':
      return [[0, 0], [W, 0], [W, D], [b1, D], [b1, a0], [b0, a0], [b0, D], [0, D]];
  }
}

/** Stair sized like Revit would for the storey height: risers ≤ 180 mm, 280 mm treads. */
export function stairInput(m: BimModel, base: string, top: string, start: Point, direction: StairDirection) {
  const lo = m.levels.find((l) => l.id === base)?.elevation ?? 0;
  const hi = m.levels.find((l) => l.id === top)?.elevation ?? 3000;
  const risers = Math.max(1, Math.ceil((hi - lo) / 180));
  return {
    baseLevelId: base,
    topLevelId: top,
    start,
    direction,
    width: 1000,
    risers,
    riserHeight: Math.round((hi - lo) / risers),
    treadDepth: 280,
  };
}

/** The level above `levelId`, if any. */
export const levelAbove = (m: BimModel, levelId: string) => {
  const here = m.levels.find((l) => l.id === levelId)?.elevation ?? 0;
  return [...m.levels].filter((l) => l.elevation > here).sort((a, b) => a.elevation - b.elevation)[0]?.id ?? null;
};

/** Advances to the next unfinished step after a model change. */
function settle(level: LevelDef, st: PlayState, effect: Effect): TapResult {
  let i = st.stepIndex;
  while (i < level.steps.length && level.steps[i].done(st.session.model)) i++;
  if (i >= level.steps.length) {
    return {
      state: { ...st, stepIndex: level.steps.length - 1, done: true, command: null, chain: EMPTY_CHAIN, firstTap: null },
      effect: 'success',
    };
  }
  if (i !== st.stepIndex) {
    return { state: { ...st, stepIndex: i, command: null, chain: EMPTY_CHAIN, firstTap: null }, effect: 'build' };
  }
  return { state: st, effect };
}

const applied = (level: LevelDef, st: PlayState, r: CommandResult | null, effect: Effect = 'build'): TapResult => {
  if (!r) return { state: st };
  if (!r.ok) return { state: st, effect: 'error', message: r.error.message };
  return settle(level, { ...st, session: r.state }, effect);
};

/** A tap on the drawing with the current command. */
export function tap(level: LevelDef, st0: PlayState, raw: Point): TapResult {
  if (st0.done) return { state: st0 };
  if (!st0.command) return { state: st0, effect: 'error' };
  if (st0.namingRoomId) return { state: st0 };
  const st = { ...st0, taps: st0.taps + 1 };
  const s = st.session;
  const stp = currentStep(level, st);
  const on = stepLevel(stp);
  const g = level.geom;
  switch (st.command) {
    case 'level': {
      const elev = Math.max(ELEVATION_SNAP, snap(raw[1], ELEVATION_SNAP));
      const targets = stp.levels ?? [{ at: g.wallH, name: 'Kat 1' }];
      return applied(level, st, levelTap(s, elev, targets));
    }
    case 'grid': {
      const p = snapPoint(raw);
      if (!st.firstTap) return { state: { ...st, firstTap: p }, effect: 'snap' };
      const end = lockAxis(st.firstTap, p);
      if (end[0] === st.firstTap[0] && end[1] === st.firstTap[1]) return { state: st };
      const r = createGridCommand(s, { start: st.firstTap, end });
      return applied(level, { ...st, firstTap: r.ok ? null : st.firstTap }, r);
    }
    case 'wall': {
      const p = snapPoint(raw);
      if (st.drawMode === 'rect') {
        if (!st.firstTap) return { state: { ...st, firstTap: p }, effect: 'snap' };
        const a = st.firstTap;
        if (a[0] === p[0] || a[1] === p[1]) return { state: st, effect: 'error', message: 'Karşı köşeye dokun.' };
        const r = createRectangleWallsCommand(s, {
          x: Math.min(a[0], p[0]),
          z: Math.min(a[1], p[1]),
          width: Math.abs(p[0] - a[0]),
          depth: Math.abs(p[1] - a[1]),
          baseLevelId: on,
          height: g.wallH,
          thickness: 200,
        });
        return applied(level, { ...st, firstTap: null }, r);
      }
      const o = wallChainTap(s, st.chain, p, { baseLevelId: on, height: g.wallH, thickness: 200 });
      if (!o.result) return { state: { ...st, chain: o.next }, effect: 'snap' };
      return applied(level, { ...st, chain: o.result.ok ? o.next : st.chain }, o.result);
    }
    case 'door':
    case 'window': {
      const w = nearestWall(s.model, on, raw);
      if (!w) return { state: st, effect: 'error', message: 'Bir duvarın üstüne dokun.' };
      const isDoor = st.command === 'door';
      return applied(
        level,
        st,
        placeOpening(s, st.command, w, projectOnWall(w, raw), isDoor
          ? { width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' }
          : { width: 1200, height: 1200, sill: 900 })
      );
    }
    case 'floor':
      if (!insideHouse(g, raw)) return { state: st, effect: 'error', message: 'Evin içine dokun.' };
      return applied(level, st, createFloorCommand(s, { levelId: on, boundary: floorOutlineWithOpening(g, s.model, on) }));
    case 'roof':
      if (!insideHouse(g, raw)) return { state: st, effect: 'error', message: 'Evin içine dokun.' };
      return applied(level, st, createRoofCommand(s, { baseLevelId: roofLevelId(s.model), slope: 30, overhang: 500 }));
    case 'stair': {
      const top = levelAbove(s.model, on);
      if (!top) return { state: st, effect: 'error', message: 'Merdiven için üstte bir kat gerekir.' };
      if (!st.firstTap) {
        const m = stp.magnet;
        const p: Point = m && Math.hypot(raw[0] - m[0], raw[1] - m[1]) <= 1200 ? m : [snap(raw[0], 100), snap(raw[1], 100)];
        return { state: { ...st, firstTap: p }, effect: 'snap' };
      }
      const a = st.firstTap;
      const dx = raw[0] - a[0];
      const dz = raw[1] - a[1];
      if (Math.hypot(dx, dz) < 300) return { state: st };
      const dir: StairDirection = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 'x+' : 'x-') : dz > 0 ? 'z+' : 'z-';
      const r = createStairCommand(s, stairInput(s.model, on, top, a, dir));
      return applied(level, { ...st, firstTap: null }, r);
    }
    case 'section': {
      const p = snapPoint(raw);
      if (!st.firstTap) return { state: { ...st, firstTap: p }, effect: 'snap' };
      const end = lockAxis(st.firstTap, p);
      if (end[0] === st.firstTap[0] && end[1] === st.firstTap[1]) return { state: st };
      const r = createViewCommand(s, { kind: 'section', cutLine: [st.firstTap, end] });
      return applied(level, { ...st, firstTap: null }, r);
    }
    case 'paste':
      return { state: st0, effect: 'error', message: 'Yapıştırılacak katı seç.' };
    case 'room': {
      if (roomAt(s, raw, on)) return { state: st, effect: 'error', message: 'Bu oda zaten tanımlı.' };
      const o = placeRoomAt(s, on, [snap(raw[0], 100), snap(raw[1], 100)]);
      if (!o.result) return { state: st, effect: 'error', message: 'Burası kapalı bir oda değil.' };
      return applied(level, st, o.result);
    }
    case 'dimension': {
      const w = nearestWall(s.model, on, raw);
      if (!w) return { state: st, effect: 'error', message: 'Bir duvarın üstüne dokun.' };
      if (!st.firstTap) return { state: { ...st, firstTap: raw }, effect: 'snap' };
      const a = nearestWall(s.model, on, st.firstTap);
      if (!a || a.id === w.id) return { state: { ...st, firstTap: raw }, effect: 'snap' };
      return applied(level, { ...st, firstTap: null }, createDimensionCommand(s, a.id, w.id));
    }
    case 'elevation': {
      const dir = facadeAt(g, raw);
      if (!dir) return { state: st, effect: 'error', message: 'Evin dışına, cephenin önüne dokun.' };
      return applied(level, st, createViewCommand(s, { kind: 'elevation', direction: dir }));
    }
    case 'mirror': {
      const axisWall = nearestWall(s.model, on, raw);
      if (!axisWall) return { state: st, effect: 'error', message: 'Ayna ekseni olacak duvara dokun.' };
      const vertical = axisWall.start[0] === axisWall.end[0];
      const at = vertical ? axisWall.start[0] : axisWall.start[1];
      const onAxis = (w: WallElement) =>
        vertical ? w.start[0] === at && w.end[0] === at : w.start[1] === at && w.end[1] === at;
      const ids = wallsOn(s.model, on).filter((w) => !onAxis(w)).map((w) => w.id);
      return applied(level, st, mirrorWallsCommand(s, ids, vertical ? 'x' : 'z', at));
    }
    case 'sheet':
    case 'place':
      return { state: st0, effect: 'error', message: 'Listeden seç.' };
    case 'tag': {
      const opening = openingNear(s.model, on, raw);
      if (opening) {
        if (s.model.elements.some((e) => e.type === 'tag' && e.targetId === opening)) {
          return { state: st, effect: 'error', message: 'Bu zaten etiketli.' };
        }
        return applied(level, st, createTagCommand(s, opening));
      }
      const room = roomAt(s, raw, on);
      if (!room) return { state: st, effect: 'error', message: 'Bir odanın içine dokun.' };
      const already = s.model.elements.some((e) => e.type === 'tag' && e.targetId === room.id);
      if (already) return { state: { ...st, namingRoomId: room.id }, effect: 'select' };
      const r = createTagCommand(s, room.id);
      if (!r.ok) return { state: st, effect: 'error', message: r.error.message };
      return { state: { ...st, session: r.state, namingRoomId: room.id }, effect: 'build' };
    }
  }
  return { state: st };
}

/** Commands that open a list instead of waiting for a tap on the drawing. */
export const LIST_COMMANDS: CommandId[] = ['paste', 'sheet', 'place'];

export interface Choice {
  id: string;
  label: string;
}

/** What the list shows for the current command. */
export function choicesFor(level: LevelDef, st: PlayState): Choice[] {
  const m = st.session.model;
  switch (st.command) {
    case 'paste': {
      const from = currentStep(level, st).from ?? 'l0';
      return m.levels.filter((l) => l.id !== from).map((l) => ({ id: l.id, label: l.name }));
    }
    case 'sheet':
      return [{ id: 'A3', label: 'A3 · Title block' }];
    case 'place': {
      const sheet = [...m.elements].reverse().find((e) => e.type === 'sheet');
      const placed = new Set(sheet && sheet.type === 'sheet' ? sheet.placements.map((p) => p.viewId) : []);
      return m.elements
        .filter((e) => e.type === 'view' && !placed.has(e.id))
        .map((e) => ({ id: e.id, label: e.name }));
    }
    default:
      return [];
  }
}

/** Picking from that list. */
export function choose(level: LevelDef, st: PlayState, id: string): TapResult {
  if (st.done || !st.command || !LIST_COMMANDS.includes(st.command)) return { state: st };
  const s = st.session;
  const next = { ...st, taps: st.taps + 1 };
  switch (st.command) {
    case 'paste': {
      const from = currentStep(level, st).from ?? 'l0';
      const ids = wallsOn(s.model, from).map((w) => w.id);
      return applied(level, next, copyWallsToLevelCommand(s, ids, id));
    }
    case 'sheet':
      return applied(level, next, createSheetCommand(s, { number: 'A-101', name: 'Planlar ve Cepheler' }));
    case 'place': {
      const sheet = [...s.model.elements].reverse().find((e) => e.type === 'sheet');
      if (!sheet) return { state: st, effect: 'error', message: 'Önce bir pafta oluştur.' };
      return applied(level, next, placeOnSheetCommand(s, sheet.id, id));
    }
  }
  return { state: st };
}

/** Paste Aligned to Selected Levels: the walls of the step's source level go onto `levelId`. */
export const pasteTo = (level: LevelDef, st: PlayState, levelId: string): TapResult =>
  st.command === 'paste' ? choose(level, st, levelId) : { state: st };

/** Choosing a name for the room that was just tagged. */
export function nameRoom(level: LevelDef, st: PlayState, name: string): TapResult {
  if (!st.namingRoomId) return { state: st };
  const r = updateElementProperty(st.session, st.namingRoomId, 'name', name);
  return applied(level, { ...st, namingRoomId: null, taps: st.taps + 1 }, r);
}

export function undo(level: LevelDef, st: PlayState): TapResult {
  if (st.session.past.length === 0) return { state: { ...st, chain: EMPTY_CHAIN, firstTap: null } };
  const session = undoCommand(st.session);
  let i = 0;
  while (i < level.steps.length - 1 && level.steps[i].done(session.model)) i++;
  return {
    state: { ...st, session, stepIndex: i, done: false, chain: EMPTY_CHAIN, firstTap: null, namingRoomId: null, taps: st.taps + 1 },
    effect: 'select',
  };
}

/** ★ finished · ★★ no wrong command · ★★★ within the tap allowance. */
export function starsFor(level: LevelDef, st: PlayState): number {
  if (!st.done) return 0;
  return 1 + (st.wrongPicks === 0 ? 1 : 0) + (st.taps <= level.par ? 1 : 0);
}
