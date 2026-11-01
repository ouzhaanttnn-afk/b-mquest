import {
  addLevelCommand,
  createFloorCommand,
  createRoofCommand,
  createTagCommand,
  setLevelElevationCommand,
  undoCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../domain/commands';
import { roomBoundary } from '../domain/derived';
import type { Point, RoomElement, WallElement } from '../domain/types';
import { projectOnWall } from '../plan/snap';
import { EMPTY_CHAIN, gridTap, placeOpening, placeRoomAt, wallChainTap, type ChainState } from '../ui/workspace/toolActions';
import { HOUSE, roofLevelId, type CommandId, type LevelDef } from './house1';

/**
 * One level of the campaign as plain data plus pure functions, so the screen
 * only draws and forwards taps. Taps are in plan millimetres ([x, z]), or
 * [0, elevation] on the elevation view.
 */

export interface PlayState {
  session: MissionSessionState;
  stepIndex: number;
  command: CommandId | null;
  chain: ChainState;
  gridStart: Point | null;
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
  return { session, stepIndex: 0, command: null, chain: EMPTY_CHAIN, gridStart: null, namingRoomId: null, taps: 0, wrongPicks: 0, done: false };
}

export const currentStep = (level: LevelDef, st: PlayState) => level.steps[Math.min(st.stepIndex, level.steps.length - 1)];

/** Picking a ribbon command. A wrong pick costs the second star. */
export function pickCommand(level: LevelDef, st: PlayState, id: CommandId): TapResult {
  const want = currentStep(level, st).command;
  if (id !== want) return { state: { ...st, wrongPicks: st.wrongPicks + 1 }, effect: 'error' };
  return { state: { ...st, command: id }, effect: 'select' };
}

const walls = (s: MissionSessionState) => s.model.elements.filter((e): e is WallElement => e.type === 'wall');

function nearestWall(s: MissionSessionState, p: Point, maxDist = 900): WallElement | null {
  let best: { w: WallElement; d: number } | null = null;
  for (const w of walls(s)) {
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

export function roomAt(s: MissionSessionState, p: Point): RoomElement | null {
  for (const e of s.model.elements) {
    if (e.type !== 'room') continue;
    const b = roomBoundary(e, s.model);
    if (!b.open && b.rects.some(([x0, z0, x1, z1]) => p[0] >= Math.min(x0, x1) && p[0] <= Math.max(x0, x1) && p[1] >= Math.min(z0, z1) && p[1] <= Math.max(z0, z1))) return e;
  }
  return null;
}

const insideHouse = (p: Point) => p[0] > 0 && p[0] < HOUSE.w && p[1] > 0 && p[1] < HOUSE.d;

/** Advances to the next unfinished step after a model change. */
function settle(level: LevelDef, st: PlayState, effect: Effect): TapResult {
  let i = st.stepIndex;
  while (i < level.steps.length && level.steps[i].done(st.session.model)) i++;
  if (i >= level.steps.length) {
    return { state: { ...st, stepIndex: level.steps.length - 1, done: true, command: null, chain: EMPTY_CHAIN, gridStart: null }, effect: 'success' };
  }
  if (i !== st.stepIndex) {
    return { state: { ...st, stepIndex: i, command: null, chain: EMPTY_CHAIN, gridStart: null }, effect: 'build' };
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
  switch (st.command) {
    case 'level': {
      const elev = Math.max(ELEVATION_SNAP, snap(raw[1], ELEVATION_SNAP));
      const top = s.model.levels.find((l) => l.id !== 'l0');
      if (!top) {
        const added = addLevelCommand(s);
        if (!added.ok) return applied(level, st, added);
        const id = added.state.model.levels.find((l) => l.id !== 'l0')!.id;
        const cur = added.state.model.levels.find((l) => l.id === id)!.elevation;
        return applied(level, st, cur === elev ? added : setLevelElevationCommand(added.state, id, elev));
      }
      return applied(level, st, setLevelElevationCommand(s, top.id, elev));
    }
    case 'grid': {
      const o = gridTap(s, st.gridStart, snapPoint(raw));
      if (!o.result) return { state: { ...st, gridStart: o.next }, effect: 'snap' };
      const r = applied(level, { ...st, gridStart: o.result.ok ? o.next : st.gridStart }, o.result);
      return r;
    }
    case 'wall': {
      const o = wallChainTap(s, st.chain, snapPoint(raw), { baseLevelId: 'l0', height: HOUSE.wallH, thickness: 200 });
      if (!o.result) return { state: { ...st, chain: o.next }, effect: 'snap' };
      return applied(level, { ...st, chain: o.result.ok ? o.next : st.chain }, o.result);
    }
    case 'door':
    case 'window': {
      const w = nearestWall(s, raw);
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
      if (!insideHouse(raw)) return { state: st, effect: 'error', message: 'Evin içine dokun.' };
      return applied(level, st, createFloorCommand(s, { levelId: 'l0' }));
    case 'roof':
      if (!insideHouse(raw)) return { state: st, effect: 'error', message: 'Evin içine dokun.' };
      return applied(level, st, createRoofCommand(s, { baseLevelId: roofLevelId(s.model), slope: 30, overhang: 500 }));
    case 'room': {
      if (roomAt(s, raw)) return { state: st, effect: 'error', message: 'Bu oda zaten tanımlı.' };
      const o = placeRoomAt(s, 'l0', [snap(raw[0], 100), snap(raw[1], 100)]);
      if (!o.result) return { state: st, effect: 'error', message: 'Burası kapalı bir oda değil.' };
      return applied(level, st, o.result);
    }
    case 'tag': {
      const room = roomAt(s, raw);
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

/** Choosing a name for the room that was just tagged. */
export function nameRoom(level: LevelDef, st: PlayState, name: string): TapResult {
  if (!st.namingRoomId) return { state: st };
  const r = updateElementProperty(st.session, st.namingRoomId, 'name', name);
  return applied(level, { ...st, namingRoomId: null, taps: st.taps + 1 }, r);
}

export function undo(level: LevelDef, st: PlayState): TapResult {
  if (st.session.past.length === 0) return { state: { ...st, chain: EMPTY_CHAIN, gridStart: null } };
  const session = undoCommand(st.session);
  let i = 0;
  while (i < level.steps.length - 1 && level.steps[i].done(session.model)) i++;
  return {
    state: { ...st, session, stepIndex: i, done: false, chain: EMPTY_CHAIN, gridStart: null, namingRoomId: null, taps: st.taps + 1 },
    effect: 'select',
  };
}

/** ★ finished · ★★ no wrong command · ★★★ within the tap allowance. */
export function starsFor(level: LevelDef, st: PlayState): number {
  if (!st.done) return 0;
  return 1 + (st.wrongPicks === 0 ? 1 : 0) + (st.taps <= level.par ? 1 : 0);
}
