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

/**
 * Finds the region around a room's seed point that is closed by walls on the
 * room's level. Walls are axis-aligned centre-lines, so the plane is split
 * into a coordinate grid and flood-filled from the seed cell.
 */
export function roomBoundary(room: RoomElement, model: BimModel): RoomBoundary {
  const walls = wallsOf(model).filter((w) => w.baseLevelId === room.levelId);
  const [sx0, sz0] = room.seedPoint;
  const xsSet = new Set<number>([sx0]);
  const zsSet = new Set<number>([sz0]);
  for (const w of walls) {
    xsSet.add(w.start[0]);
    xsSet.add(w.end[0]);
    zsSet.add(w.start[1]);
    zsSet.add(w.end[1]);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const zs = [...zsSet].sort((a, b) => a - b);
  xs.unshift(xs[0] - 1000);
  xs.push(xs[xs.length - 1] + 1000);
  zs.unshift(zs[0] - 1000);
  zs.push(zs[zs.length - 1] + 1000);
  const nx = xs.length - 1;
  const nz = zs.length - 1;

  // Barriers: key "v:xIndex:zCell" blocks between cell x-1 and x in row z.
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

  // Seed cell (nudge seeds lying exactly on a wall line by +1 mm).
  const cellOf = (v: number, arr: number[]): number => {
    for (let i = 0; i < arr.length - 1; i++) {
      if (v >= arr[i] && v < arr[i + 1]) return i;
    }
    return -1;
  };
  let si = cellOf(sx0 + (xsSet.has(sx0) ? 1 : 0), xs);
  let sj = cellOf(sz0 + (zsSet.has(sz0) ? 1 : 0), zs);
  if (si < 0) si = 0;
  if (sj < 0) sj = 0;

  const seen = new Set<string>([`${si}:${sj}`]);
  const queue: Array<[number, number]> = [[si, sj]];
  let gapAt: Point | undefined;
  const leak = (i: number, j: number, ni: number, nj: number) => {
    if (gapAt) return;
    const edgeX = ni !== i ? (ni > i ? xs[i + 1] : xs[i]) : (xs[i] + xs[i + 1]) / 2;
    const edgeZ = nj !== j ? (nj > j ? zs[j + 1] : zs[j]) : (zs[j] + zs[j + 1]) / 2;
    gapAt = [Math.round(edgeX), Math.round(edgeZ)];
  };
  const onRing = (i: number, j: number) =>
    i === 0 || j === 0 || i === nx - 1 || j === nz - 1;

  while (queue.length) {
    const [i, j] = queue.shift()!;
    if (onRing(i, j)) {
      if (!gapAt) gapAt = [Math.round(sx0), Math.round(sz0)];
      continue;
    }
    const moves: Array<[number, number, boolean]> = [
      [i + 1, j, vBlock.has(`${i + 1}:${j}`)],
      [i - 1, j, vBlock.has(`${i}:${j}`)],
      [i, j + 1, hBlock.has(`${i}:${j + 1}`)],
      [i, j - 1, hBlock.has(`${i}:${j}`)],
    ];
    for (const [ni, nj, blocked] of moves) {
      if (blocked) continue;
      const key = `${ni}:${nj}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (onRing(ni, nj)) leak(i, j, ni, nj);
      queue.push([ni, nj]);
    }
  }

  const reachedRing = [...seen].some((k) => {
    const [i, j] = k.split(':').map(Number);
    return onRing(i, j);
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

/**
 * Value of a (possibly derived) field, used by allEqual / compare criteria.
 * Derived names: topElevation, area, volume, closed.
 */
export function fieldValue(
  el: BimElement,
  field: string,
  model: BimModel
): number | string | boolean | null {
  if (field === 'topElevation' && el.type === 'wall') {
    return wallTopElevation(el, model);
  }
  if (el.type === 'room') {
    if (field === 'area') return Math.round(roomArea(el, model) * 100) / 100;
    if (field === 'volume') return Math.round(roomVolume(el, model) * 100) / 100;
    if (field === 'closed') return !roomBoundary(el, model).open;
  }
  if (el.type === 'roof' && field === 'baseElevation') {
    return levelById(model, el.baseLevelId)?.elevation ?? null;
  }
  if (el.type === 'floor' && field === 'elevation') {
    return levelById(model, el.levelId)?.elevation ?? null;
  }
  if (el.type === 'stair' && field === 'rise') return stairRise(el);
  if (el.type === 'stair' && field === 'levelRise') {
    const a = levelById(model, el.baseLevelId)?.elevation;
    const b = levelById(model, el.topLevelId)?.elevation;
    return a === undefined || b === undefined ? null : b - a;
  }
  const v = (el as unknown as Record<string, unknown>)[field];
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
    return v;
  }
  return null;
}
