import type {
  BimElement,
  BimModel,
  DoorElement,
  ElementType,
  Level,
  Point,
  RoomElement,
  WallElement,
  WindowElement,
} from './types';

export type Opening = DoorElement | WindowElement;

export const levelById = (model: BimModel, id: string): Level | undefined =>
  model.levels.find((l) => l.id === id);

export const wallLengthMm = (w: WallElement): number =>
  Math.abs(w.end[0] - w.start[0]) + Math.abs(w.end[1] - w.start[1]);

export const isOpening = (e: BimElement): e is Opening =>
  e.type === 'door' || e.type === 'window';

/** Walls in the model; narrower than a filter at every call site. */
export const wallsOf = (model: BimModel): WallElement[] =>
  model.elements.filter((e): e is WallElement => e.type === 'wall');

/**
 * Absolute elevation of the wall top. A top constraint wins over the
 * stored Unconnected Height, exactly like Revit's Top Constraint.
 */
export function wallTopElevation(wall: WallElement, model: BimModel): number {
  const base = levelById(model, wall.baseLevelId)?.elevation ?? 0;
  const top = wall.topConstraint ? levelById(model, wall.topConstraint) : undefined;
  if (top) return top.elevation + (wall.topOffset ?? 0);
  return base + wall.height;
}

/** Height a constrained wall must have for its top to meet the constraint. */
export function constrainedWallHeight(
  wall: WallElement,
  model: BimModel
): number | null {
  const top = wall.topConstraint ? levelById(model, wall.topConstraint) : undefined;
  if (!top) return null;
  const base = levelById(model, wall.baseLevelId)?.elevation ?? 0;
  return top.elevation + (wall.topOffset ?? 0) - base;
}

export function hostedElements(wallId: string, model: BimModel): Opening[] {
  return model.elements.filter(
    (e): e is Opening => isOpening(e) && e.hostWallId === wallId
  );
}

export function elementTypeOf(
  model: BimModel,
  el: BimElement
): ElementType | undefined {
  const typeId = (el as { typeId?: string }).typeId;
  return typeId ? model.types?.find((t) => t.id === typeId) : undefined;
}

export type Rect = [number, number, number, number];

export interface RoomBoundary {
  /** true when the seed region leaks outside the wall network. */
  open: boolean;
  /** Mid-point of the first gap found (only when open). */
  gapAt?: Point;
  /** Cells that make up the enclosed region (centre-line based). */
  rects: Rect[];
  /** Area in mm² (0 when open). */
  area: number;
}

interface WallGrid {
  xs: number[];
  zs: number[];
  nx: number;
  nz: number;
  /** vBlock "i:j": wall between cell (i-1,j) and (i,j). */
  vBlock: Set<string>;
  /** hBlock "i:j": wall between cell (i,j-1) and (i,j). */
  hBlock: Set<string>;
}

/**
 * Splits the plane into a coordinate grid from the wall centre-lines (plus
 * optional extra coordinates) and records which cell borders are walls.
 */
function buildWallGrid(
  walls: WallElement[],
  extraX: number[] = [],
  extraZ: number[] = []
): WallGrid {
  const xsSet = new Set<number>(extraX);
  const zsSet = new Set<number>(extraZ);
  for (const w of walls) {
    xsSet.add(w.start[0]);
    xsSet.add(w.end[0]);
    zsSet.add(w.start[1]);
    zsSet.add(w.end[1]);
  }
  if (xsSet.size === 0) xsSet.add(0);
  if (zsSet.size === 0) zsSet.add(0);
  const xs = [...xsSet].sort((a, b) => a - b);
  const zs = [...zsSet].sort((a, b) => a - b);
  // A free outer ring marks "outside the building".
  xs.unshift(xs[0] - 1000);
  xs.push(xs[xs.length - 1] + 1000);
  zs.unshift(zs[0] - 1000);
  zs.push(zs[zs.length - 1] + 1000);
  const nx = xs.length - 1;
  const nz = zs.length - 1;
  const vBlock = new Set<string>();
  const hBlock = new Set<string>();
  for (const w of walls) {
    const [ax, az] = w.start;
    const [bx, bz] = w.end;
    if (ax === bx) {
      const xi = xs.indexOf(ax);
      const lo = Math.min(az, bz);
      const hi = Math.max(az, bz);
      for (let j = 0; j < nz; j++) {
        if (zs[j] >= lo && zs[j + 1] <= hi) vBlock.add(`${xi}:${j}`);
      }
    } else {
      const zi = zs.indexOf(az);
      const lo = Math.min(ax, bx);
      const hi = Math.max(ax, bx);
      for (let i = 0; i < nx; i++) {
        if (xs[i] >= lo && xs[i + 1] <= hi) hBlock.add(`${i}:${zi}`);
      }
    }
  }
  return { xs, zs, nx, nz, vBlock, hBlock };
}

const onRing = (g: WallGrid, i: number, j: number) =>
  i === 0 || j === 0 || i === g.nx - 1 || j === g.nz - 1;

/** Neighbour cells reachable from (i,j) without crossing a wall. */
function openMoves(g: WallGrid, i: number, j: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (!g.vBlock.has(`${i + 1}:${j}`)) out.push([i + 1, j]);
  if (!g.vBlock.has(`${i}:${j}`)) out.push([i - 1, j]);
  if (!g.hBlock.has(`${i}:${j + 1}`)) out.push([i, j + 1]);
  if (!g.hBlock.has(`${i}:${j}`)) out.push([i, j - 1]);
  return out;
}

/**
 * Finds the region around a room's seed point that is closed by walls on the
 * room's level. Walls are axis-aligned centre-lines, so the plane is split
 * into a coordinate grid and flood-filled from the seed cell.
 */
export function roomBoundary(room: RoomElement, model: BimModel): RoomBoundary {
  const walls = wallsOf(model).filter((w) => w.baseLevelId === room.levelId);
  const [sx0, sz0] = room.seedPoint;
  const g = buildWallGrid(walls, [sx0], [sz0]);
  const { xs, zs } = g;
  const onLine = (v: number, arr: number[]) => arr.includes(v);

  // Seed cell (a seed lying exactly on a wall line is nudged by +1 mm).
  const cellOf = (v: number, arr: number[]): number => {
    for (let i = 0; i < arr.length - 1; i++) {
      if (v >= arr[i] && v < arr[i + 1]) return i;
    }
    return -1;
  };
  const wallLineX = walls.some((w) => w.start[0] === sx0 && w.end[0] === sx0);
  const wallLineZ = walls.some((w) => w.start[1] === sz0 && w.end[1] === sz0);
  let si = cellOf(sx0 + (wallLineX && onLine(sx0, xs) ? 1 : 0), xs);
  let sj = cellOf(sz0 + (wallLineZ && onLine(sz0, zs) ? 1 : 0), zs);
  if (si < 0) si = 0;
  if (sj < 0) sj = 0;

  const seen = new Set<string>([`${si}:${sj}`]);
  const queue: Array<[number, number]> = [[si, sj]];
  let gapAt: Point | undefined;
  while (queue.length) {
    const [i, j] = queue.shift()!;
    if (onRing(g, i, j)) {
      if (!gapAt) gapAt = [Math.round(sx0), Math.round(sz0)];
      continue;
    }
    for (const [ni, nj] of openMoves(g, i, j)) {
      const key = `${ni}:${nj}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (onRing(g, ni, nj) && !gapAt) {
        // The unblocked edge between (i,j) and the outside is the gap.
        const ex = ni !== i ? (ni > i ? xs[i + 1] : xs[i]) : (xs[i] + xs[i + 1]) / 2;
        const ez = nj !== j ? (nj > j ? zs[j + 1] : zs[j]) : (zs[j] + zs[j + 1]) / 2;
        gapAt = [Math.round(ex), Math.round(ez)];
      }
      queue.push([ni, nj]);
    }
  }

  const reachedRing = [...seen].some((k) => {
    const [i, j] = k.split(':').map(Number);
    return onRing(g, i, j);
  });
  if (reachedRing) return { open: true, gapAt, rects: [], area: 0 };

  const rects: Rect[] = [];
  let area = 0;
  for (const k of seen) {
    const [i, j] = k.split(':').map(Number);
    rects.push([xs[i], zs[j], xs[i + 1], zs[j + 1]]);
    area += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j]);
  }
  return { open: false, rects, area };
}

export interface EnclosedRegion {
  rects: Rect[];
  area: number;
  /** A point inside the region, usable as a Room seed. */
  seed: Point;
}

/** Every region on a level that the walls close completely. */
export function enclosedRegions(model: BimModel, levelId: string): EnclosedRegion[] {
  const walls = wallsOf(model).filter((w) => w.baseLevelId === levelId);
  if (walls.length < 3) return [];
  const g = buildWallGrid(walls);
  const outside = new Set<string>();
  const queue: Array<[number, number]> = [[0, 0]];
  outside.add('0:0');
  while (queue.length) {
    const [i, j] = queue.shift()!;
    for (const [ni, nj] of openMoves(g, i, j)) {
      if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz) continue;
      const key = `${ni}:${nj}`;
      if (outside.has(key)) continue;
      outside.add(key);
      queue.push([ni, nj]);
    }
  }
  const visited = new Set<string>();
  const regions: EnclosedRegion[] = [];
  for (let i = 0; i < g.nx; i++) {
    for (let j = 0; j < g.nz; j++) {
      const key = `${i}:${j}`;
      if (outside.has(key) || visited.has(key)) continue;
      const comp: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[i, j]];
      visited.add(key);
      while (stack.length) {
        const [ci, cj] = stack.pop()!;
        comp.push([ci, cj]);
        for (const [ni, nj] of openMoves(g, ci, cj)) {
          const nk = `${ni}:${nj}`;
          if (outside.has(nk) || visited.has(nk)) continue;
          visited.add(nk);
          stack.push([ni, nj]);
        }
      }
      const rects = comp.map(
        ([ci, cj]): Rect => [g.xs[ci], g.zs[cj], g.xs[ci + 1], g.zs[cj + 1]]
      );
      const area = rects.reduce((s, q) => s + (q[2] - q[0]) * (q[3] - q[1]), 0);
      const first = rects[0];
      regions.push({
        rects,
        area,
        seed: [Math.round((first[0] + first[2]) / 2), Math.round((first[1] + first[3]) / 2)],
      });
    }
  }
  return regions;
}

/** Room area in m² (0 for an open room). */
export function roomArea(room: RoomElement, model: BimModel): number {
  return roomBoundary(room, model).area / 1_000_000;
}

/** Room volume in m³ using the lowest enclosing wall top. */
export function roomVolume(room: RoomElement, model: BimModel): number {
  const level = levelById(model, room.levelId);
  const walls = wallsOf(model).filter((w) => w.baseLevelId === room.levelId);
  if (!level || walls.length === 0) return 0;
  const top = Math.min(...walls.map((w) => wallTopElevation(w, model)));
  return (roomArea(room, model) * Math.max(0, top - level.elevation)) / 1000;
}

/** Polygon area (mm²) via the shoelace formula. */
export function polygonArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i];
    const [x2, z2] = poly[(i + 1) % poly.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}

/** Axis-aligned rectangle polygon (clockwise from the origin corner). */
export function rectPolygon(x0: number, z0: number, x1: number, z1: number): Point[] {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}

/** Floor/roof outline built from the wall centre-lines of a level. */
export function wallsOutline(model: BimModel, levelId: string): Point[] | null {
  const walls = wallsOf(model).filter((w) => w.baseLevelId === levelId);
  if (walls.length < 3) return null;
  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  return rectPolygon(
    Math.min(...xs),
    Math.min(...zs),
    Math.max(...xs),
    Math.max(...zs)
  );
}

/** Stair run: number of risers × riser height versus the level difference. */
export function stairRise(
  stair: { risers: number; riserHeight: number },
): number {
  return stair.risers * stair.riserHeight;
}
