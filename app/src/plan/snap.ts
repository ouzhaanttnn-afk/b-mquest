import type { BimModel, GridElement, Point, WallElement } from '../domain/types';

export type SnapKind = 'endpoint' | 'gridline' | 'grid' | 'free';

export interface SnapResult {
  point: Point;
  kind: SnapKind;
}

export interface SnapOptions {
  /** Plain grid step in mm. */
  step?: number;
  /** Capture radius for wall ends and Grid lines in mm. */
  tolerance?: number;
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Snaps a raw plan point (mm). Priority: wall end points, Grid line
 * intersections / single Grid lines, then the plain 100 mm grid.
 */
export function snapPoint(
  raw: Point,
  model: BimModel,
  { step = 100, tolerance = 250 }: SnapOptions = {}
): SnapResult {
  let best: Point | null = null;
  let bestD = tolerance;
  for (const el of model.elements) {
    if (el.type !== 'wall') continue;
    for (const p of [el.start, el.end]) {
      const d = dist(raw, p);
      if (d <= bestD) {
        best = [p[0], p[1]];
        bestD = d;
      }
    }
  }
  if (best) return { point: best, kind: 'endpoint' };

  const grids = model.elements.filter((e): e is GridElement => e.type === 'grid');
  const xs = grids.filter((g) => g.start[0] === g.end[0]).map((g) => g.start[0]);
  const zs = grids.filter((g) => g.start[1] === g.end[1]).map((g) => g.start[1]);
  const nearest = (v: number, lines: number[]): number | null => {
    let hit: number | null = null;
    let hd = tolerance;
    for (const l of lines) {
      if (Math.abs(v - l) <= hd) {
        hit = l;
        hd = Math.abs(v - l);
      }
    }
    return hit;
  };
  const gx = nearest(raw[0], xs);
  const gz = nearest(raw[1], zs);
  const round = (v: number) => Math.round(v / step) * step;
  if (gx !== null || gz !== null) {
    return {
      point: [gx ?? round(raw[0]), gz ?? round(raw[1])],
      kind: 'gridline',
    };
  }
  return { point: [round(raw[0]), round(raw[1])], kind: 'grid' };
}

/** Keeps a segment axis-parallel by following the dominant direction. */
export function lockAxis(anchor: Point, pt: Point): Point {
  const dx = Math.abs(pt[0] - anchor[0]);
  const dz = Math.abs(pt[1] - anchor[1]);
  return dx >= dz ? [pt[0], anchor[1]] : [anchor[0], pt[1]];
}

/** Position of a point along a wall (mm from its start), clamped to the wall. */
export function projectOnWall(wall: WallElement, pt: Point): number {
  const len = Math.abs(wall.end[0] - wall.start[0]) + Math.abs(wall.end[1] - wall.start[1]);
  if (len === 0) return 0;
  const dx = Math.sign(wall.end[0] - wall.start[0]);
  const dz = Math.sign(wall.end[1] - wall.start[1]);
  const proj = (pt[0] - wall.start[0]) * dx + (pt[1] - wall.start[1]) * dz;
  return Math.max(0, Math.min(len, proj));
}
