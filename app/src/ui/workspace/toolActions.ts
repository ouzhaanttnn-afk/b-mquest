import {
  createDimensionCommand,
  createTagCommand,
  createViewCommand,
  createDoorCommand,
  createFloorCommand,
  createGridCommand,
  createRoofCommand,
  createRoomCommand,
  createStairCommand,
  createWallCommand,
  createWindowCommand,
  updateElementProperty,
  type CommandResult,
  type MissionSessionState,
} from '../../domain/commands';
import { rectPolygon, roomBoundary, wallLengthMm } from '../../domain/derived';
import type { CompassDir } from '../../domain/types';
import type { Point, StairDirection, WallElement } from '../../domain/types';
import { lockAxis } from '../../plan/snap';

export type ToolId =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'floor'
  | 'roof'
  | 'room'
  | 'stair'
  | 'grid'
  | 'section'
  | 'elevation'
  | 'dimension'
  | 'tag';

export interface ToolDef {
  id: ToolId;
  label: string;
  group: 'Mimari' | 'Referans' | 'Görünüm' | 'Açıklama';
  hint: string;
}

/** Revit-style tabs: Architecture and Datum, shown as one scrollable row. */
export const TOOL_DEFS: ToolDef[] = [
  { id: 'wall', label: 'Duvar', group: 'Mimari', hint: 'Başlangıç noktasına parmağını bas, bitiş noktasına sürükleyip bırak. (İki noktaya sırayla dokunmak da olur.)' },
  { id: 'door', label: 'Kapı', group: 'Mimari', hint: 'Bir duvara dokun: kapı oraya yerleşir. Seçip duvar boyunca sürükleyerek kaydır.' },
  { id: 'window', label: 'Pencere', group: 'Mimari', hint: 'Bir duvara dokun: pencere oraya yerleşir. Seçip duvar boyunca sürükleyerek kaydır.' },
  { id: 'floor', label: 'Döşeme', group: 'Mimari', hint: 'Duvarlara dokunarak seç (Pick Walls), sonra "Döşeme Oluştur".' },
  { id: 'roof', label: 'Çatı', group: 'Mimari', hint: 'Duvarlara dokunarak seç, katı/eğimi/çıkmayı belirle, sonra "Çatı Oluştur".' },
  { id: 'room', label: 'Oda', group: 'Mimari', hint: 'Kapalı bir alanın içine dokun. Alan kapalı değilse boşluk kırmızı işaretlenir.' },
  { id: 'stair', label: 'Merdiven', group: 'Mimari', hint: 'Merdivenin başlangıç noktasına dokun.' },
  { id: 'grid', label: 'Aks', group: 'Referans', hint: 'Başlangıçtan bitişe sürükleyip bırak: aks oluşur, adı otomatik verilir.' },
  { id: 'section', label: 'Kesit', group: 'Görünüm', hint: 'Başlangıçtan bitişe sürükleyip bırak: kesit çizgisi oluşur. Yönü sonra çevirebilirsin.' },
  { id: 'elevation', label: 'Cephe', group: 'Görünüm', hint: 'Bir yön seç (K / G / D / B): o cephenin görünümü eklenir.' },
  { id: 'dimension', label: 'Ölçü', group: 'Açıklama', hint: 'Birbirine paralel iki duvara dokun: aralarındaki ölçü çizilir ve model değişince güncellenir.' },
  { id: 'tag', label: 'Etiket', group: 'Açıklama', hint: 'Bir kapıya, pencereye veya odaya dokun: etiketi eklenir.' },
];

const round50 = (v: number) => Math.round(v / 50) * 50;

export interface WallDefaults {
  baseLevelId: string;
  height: number;
  thickness: number;
}

export interface ChainState {
  /** Where the next segment starts; null = no chain running. */
  start: Point | null;
  /** First point of the chain, to close loops automatically. */
  origin: Point | null;
}

export const EMPTY_CHAIN: ChainState = { start: null, origin: null };

export interface TapOutcome<S> {
  result: CommandResult | null;
  next: S;
  toast?: string;
}

/** One tap of the wall tool: starts a chain or extends it with a wall. */
export function wallChainTap(
  session: MissionSessionState,
  chain: ChainState,
  tap: Point,
  d: WallDefaults
): TapOutcome<ChainState> {
  if (!chain.start) {
    return { result: null, next: { start: tap, origin: tap }, toast: 'Başlangıç seçildi; bitiş noktasına dokun.' };
  }
  const end = lockAxis(chain.start, tap);
  if (end[0] === chain.start[0] && end[1] === chain.start[1]) {
    return { result: null, next: chain };
  }
  const count = session.model.elements.filter((e) => e.type === 'wall').length;
  const result = createWallCommand(session, {
    name: `Duvar ${count + 1}`,
    baseLevelId: d.baseLevelId,
    startX: chain.start[0],
    startZ: chain.start[1],
    endX: end[0],
    endZ: end[1],
    height: d.height,
    thickness: d.thickness,
  });
  if (!result.ok) return { result, next: chain };
  const closed = chain.origin && end[0] === chain.origin[0] && end[1] === chain.origin[1];
  return {
    result,
    next: closed ? EMPTY_CHAIN : { start: end, origin: chain.origin },
    toast: closed ? 'Zincir kapandı.' : undefined,
  };
}

export interface OpeningDefaults {
  width: number;
  height: number;
  sill: number;
  name?: string;
  mark?: string;
  fireRating?: string;
}

/** Centre → offset (snapped to 50 mm, clamped to the wall). */
export function openingOffsetFor(wall: WallElement, centre: number, width: number): number {
  return Math.max(0, Math.min(wallLengthMm(wall) - width, round50(centre - width / 2)));
}

/** Tap on a wall with the Door/Window tool. */
export function placeOpening(
  session: MissionSessionState,
  kind: 'door' | 'window',
  wall: WallElement,
  centre: number,
  d: OpeningDefaults
): CommandResult {
  const offset = openingOffsetFor(wall, centre, d.width);
  if (kind === 'window') {
    return createWindowCommand(session, {
      hostWallId: wall.id,
      offset,
      width: d.width,
      height: d.height,
      sill: d.sill,
    });
  }
  return createDoorCommand(session, {
    name: d.name ?? 'Kapı',
    hostWallId: wall.id,
    offset,
    width: d.width,
    height: d.height,
    sill: d.sill,
    mark: d.mark ?? 'D-01',
    fireRating: d.fireRating ?? 'none',
  });
}

/** Dry run: is this offset a legal place for the opening? */
export function canMoveOpening(
  session: MissionSessionState,
  id: string,
  offset: number
): boolean {
  const opening = session.model.elements.find((e) => e.id === id);
  if (!opening || (opening.type !== 'door' && opening.type !== 'window')) return false;
  if (offset === opening.offset) return true;
  return updateElementProperty(session, id, 'offset', offset).ok;
}

/** Room tool: closed area gets a Room, an open one reports the gap. */
export function placeRoomAt(
  session: MissionSessionState,
  levelId: string,
  tap: Point
): { result: CommandResult | null; gapAt?: Point } {
  const probe = roomBoundary(
    { id: 'probe', type: 'room', name: '', number: '', levelId, seedPoint: tap },
    session.model
  );
  if (probe.open) return { result: null, gapAt: probe.gapAt ?? tap };
  const rooms = session.model.elements.filter((e) => e.type === 'room').length;
  return {
    result: createRoomCommand(session, {
      levelId,
      seedPoint: tap,
      name: 'Oda',
      number: String(101 + rooms),
    }),
  };
}

/** Grid tool: first tap = start, second tap = end. */
export function gridTap(
  session: MissionSessionState,
  start: Point | null,
  tap: Point
): TapOutcome<Point | null> {
  if (!start) return { result: null, next: tap, toast: 'Aksın bitiş noktasına dokun.' };
  const end = lockAxis(start, tap);
  if (end[0] === start[0] && end[1] === start[1]) return { result: null, next: start };
  const result = createGridCommand(session, { start, end });
  return { result, next: result.ok ? null : start };
}

const outlineOf = (session: MissionSessionState, ids: string[]): Point[] | null => {
  const walls = session.model.elements.filter(
    (e): e is WallElement => e.type === 'wall' && (ids.length === 0 || ids.includes(e.id))
  );
  if (walls.length < 3 && ids.length === 0) return null;
  if (walls.length === 0) return null;
  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  return rectPolygon(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
};

/** Floor "Pick Walls": outline of the picked walls (all walls if none picked). */
export function floorFromWalls(
  session: MissionSessionState,
  levelId: string,
  wallIds: string[]
): CommandResult {
  return createFloorCommand(session, {
    levelId,
    ...(outlineOf(session, wallIds) ? { boundary: outlineOf(session, wallIds)! } : {}),
  });
}

export function roofFromWalls(
  session: MissionSessionState,
  baseLevelId: string,
  wallIds: string[],
  slope: number,
  overhang: number
): CommandResult {
  return createRoofCommand(session, {
    baseLevelId,
    slope,
    overhang,
    ...(outlineOf(session, wallIds) ? { footprint: outlineOf(session, wallIds)! } : {}),
  });
}

export interface StairOptions {
  baseLevelId: string;
  topLevelId: string;
  direction: StairDirection;
  risers: number;
  riserHeight: number;
}

export function stairAt(
  session: MissionSessionState,
  tap: Point,
  o: StairOptions
): CommandResult {
  return createStairCommand(session, { ...o, start: tap });
}

/** Section tool: first tap = start, second tap = end of the cut line. */
export function sectionTap(
  session: MissionSessionState,
  start: Point | null,
  tap: Point
): TapOutcome<Point | null> {
  if (!start) return { result: null, next: tap, toast: 'Kesit çizgisinin bitiş noktasına dokun.' };
  const end = lockAxis(start, tap);
  if (end[0] === start[0] && end[1] === start[1]) return { result: null, next: start };
  const result = createViewCommand(session, { kind: 'section', cutLine: [start, end] });
  return { result, next: result.ok ? null : start };
}

export function elevationFor(session: MissionSessionState, direction: CompassDir): CommandResult {
  return createViewCommand(session, { kind: 'elevation', direction });
}

/** Dimension tool: first wall, then a parallel second wall. */
export function dimensionTap(
  session: MissionSessionState,
  firstWallId: string | null,
  wallId: string
): TapOutcome<string | null> {
  if (!firstWallId) return { result: null, next: wallId, toast: `${wallId} seçildi; paralel ikinci duvara dokun.` };
  if (firstWallId === wallId) return { result: null, next: firstWallId };
  const result = createDimensionCommand(session, firstWallId, wallId);
  return { result, next: result.ok ? null : firstWallId };
}

/** Closest door / window / room to a plan point (within 900 mm). */
export function pickTaggable(session: MissionSessionState, pt: Point): string | null {
  const m = session.model;
  let best: { id: string; d: number } | null = null;
  const consider = (id: string, p: Point) => {
    const d = Math.hypot(pt[0] - p[0], pt[1] - p[1]);
    if (d <= 900 && (!best || d < best.d)) best = { id, d };
  };
  for (const e of m.elements) {
    if (e.type === 'door' || e.type === 'window') {
      const host = m.elements.find((w): w is WallElement => w.id === e.hostWallId && w.type === 'wall');
      if (!host) continue;
      const len = wallLengthMm(host);
      if (len === 0) continue;
      const k = (e.offset + e.width / 2) / len;
      consider(e.id, [host.start[0] + (host.end[0] - host.start[0]) * k, host.start[1] + (host.end[1] - host.start[1]) * k]);
    } else if (e.type === 'room') {
      consider(e.id, e.seedPoint);
    }
  }
  return best ? (best as { id: string }).id : null;
}

export function tagTap(session: MissionSessionState, tap: Point): { result: CommandResult | null; toast?: string } {
  const id = pickTaggable(session, tap);
  if (!id) return { result: null, toast: 'Yakında kapı, pencere ya da oda yok; birine daha yakın dokun.' };
  return { result: createTagCommand(session, id) };
}
