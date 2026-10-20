import {
  levelById,
  roomBoundary,
  wallLengthMm,
  wallsOf,
  wallTopElevation,
} from './derived';
import { dimensionValue, modelBounds, viewCrop, type Bounds } from './documentation';
import type {
  BimModel,
  CompassDir,
  DoorElement,
  Point,
  RoofElement,
  StairDirection,
  StairElement,
  ViewElement,
  WallElement,
  WindowElement,
} from './types';

/**
 * A view rendered to plain primitives, in SVG space (x right, y down, mm).
 * Sections/elevations map building height to −y; plans use x/z directly.
 */
export type FillKind =
  | 'cut' // material cut by the section plane
  | 'beyond' // surface seen beyond the cut
  | 'glass'
  | 'door'
  | 'slab'
  | 'roof'
  | 'stair'
  | 'room'
  | 'none';

export type Prim =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: FillKind; id?: string }
  | { t: 'poly'; pts: Point[]; fill: FillKind; id?: string }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; style: 'level' | 'ground' | 'dim' | 'swing' | 'thin' | 'cut' }
  | { t: 'text'; x: number; y: number; s: string; size: number; anchor?: 'start' | 'middle' | 'end'; tone?: 'normal' | 'dim' | 'tag' };

export interface Drawing {
  minX: number;
  minY: number;
  width: number;
  height: number;
  prims: Prim[];
  note?: string;
}

const LOOK_OF_COMPASS: Record<CompassDir, StairDirection> = { N: 'z+', S: 'z-', E: 'x-', W: 'x+' };

interface Proj {
  /** Horizontal screen coordinate. */
  u: (x: number, z: number) => number;
  /** Distance along the look direction (bigger = farther). */
  d: (x: number, z: number) => number;
}

/** Right-handed projection looking along `look` with +Y up. */
function projection(look: StairDirection): Proj {
  const l: Point = look === 'x+' ? [1, 0] : look === 'x-' ? [-1, 0] : look === 'z+' ? [0, 1] : [0, -1];
  const right: Point = [-l[1], l[0]];
  return {
    u: (x, z) => right[0] * x + right[1] * z,
    d: (x, z) => l[0] * x + l[1] * z,
  };
}

const wallBase = (w: WallElement, m: BimModel) => levelById(m, w.baseLevelId)?.elevation ?? 0;

interface Opening {
  from: number;
  to: number;
  sill: number;
  top: number;
  kind: 'door' | 'window';
  id: string;
}

const openingsOn = (w: WallElement, m: BimModel): Opening[] =>
  m.elements
    .filter((e): e is DoorElement | WindowElement => (e.type === 'door' || e.type === 'window') && e.hostWallId === w.id)
    .map((e) => ({ from: e.offset, to: e.offset + e.width, sill: e.sill, top: e.sill + e.height, kind: e.type as 'door' | 'window', id: e.id }));

const levelLines = (
  m: BimModel,
  x0: number,
  x1: number,
  prims: Prim[],
  textSize: number
) => {
  for (const l of m.levels) {
    prims.push({ t: 'line', x1: x0, y1: -l.elevation, x2: x1, y2: -l.elevation, style: l.elevation === 0 ? 'ground' : 'level' });
    prims.push({ t: 'text', x: x1 + textSize * 0.3, y: -l.elevation + textSize * 0.35, s: `${l.name} +${l.elevation}`, size: textSize, anchor: 'start', tone: 'dim' });
  }
};

/** Roof silhouette as seen from `proj`: gable triangle or flat band. */
function roofPrims(roof: RoofElement, m: BimModel, proj: Proj, clip?: [number, number]): Prim[] {
  const xs = roof.footprint.map((p) => p[0]);
  const zs = roof.footprint.map((p) => p[1]);
  const o = roof.overhang;
  const x0 = Math.min(...xs) - o, x1 = Math.max(...xs) + o;
  const z0 = Math.min(...zs) - o, z1 = Math.max(...zs) + o;
  const base = levelById(m, roof.baseLevelId)?.elevation ?? 0;
  const ridgeAlongX = x1 - x0 >= z1 - z0;
  const half = (ridgeAlongX ? z1 - z0 : x1 - x0) / 2;
  const rise = Math.tan((roof.slope * Math.PI) / 180) * half;
  const ua = proj.u(x0, z0), ub = proj.u(x1, z1);
  let u0 = Math.min(ua, ub), u1 = Math.max(ua, ub);
  if (clip) {
    u0 = Math.max(u0, clip[0]);
    u1 = Math.min(u1, clip[1]);
    if (u1 <= u0) return [];
  }
  // Is the u axis the one the ridge runs along?
  const uIsX = Math.abs(proj.u(1, 0)) === 1;
  const ridgeAlongU = ridgeAlongX === uIsX;
  if (ridgeAlongU) {
    return [{ t: 'rect', x: u0, y: -(base + rise), w: u1 - u0, h: rise, fill: 'roof', id: roof.id }];
  }
  const mid = (u0 + u1) / 2;
  return [{ t: 'poly', pts: [[u0, -base], [u1, -base], [mid, -(base + rise)]], fill: 'roof', id: roof.id }];
}

function stairPrims(s: StairElement, m: BimModel, proj: Proj): Prim[] {
  const base = levelById(m, s.baseLevelId)?.elevation ?? 0;
  const [dx, dz]: Point = s.direction.startsWith('x')
    ? [s.direction === 'x+' ? 1 : -1, 0]
    : [0, s.direction === 'z+' ? 1 : -1];
  const prims: Prim[] = [];
  const uRun = Math.abs(proj.u(dx, dz)) === 1;
  for (let i = 0; i < s.risers; i++) {
    const a = proj.u(s.start[0] + dx * i * s.treadDepth, s.start[1] + dz * i * s.treadDepth);
    const b = proj.u(s.start[0] + dx * (i + 1) * s.treadDepth, s.start[1] + dz * (i + 1) * s.treadDepth);
    const h = (i + 1) * s.riserHeight;
    if (uRun) {
      prims.push({ t: 'rect', x: Math.min(a, b), y: -(base + h), w: s.treadDepth, h, fill: 'stair', id: s.id });
    }
  }
  if (!uRun) {
    const ua = proj.u(s.start[0], s.start[1]);
    const ub = proj.u(s.start[0] + (dx === 0 ? s.width : 0), s.start[1] + (dz === 0 ? s.width : 0));
    prims.push({ t: 'rect', x: Math.min(ua, ub), y: -(base + s.risers * s.riserHeight), w: Math.abs(ub - ua), h: s.risers * s.riserHeight, fill: 'stair', id: s.id });
  }
  return prims;
}

function floorPrims(m: BimModel, proj: Proj, cutD: number | null, uClip?: [number, number]): Prim[] {
  const prims: Prim[] = [];
  for (const f of m.elements) {
    if (f.type !== 'floor') continue;
    const elev = levelById(m, f.levelId)?.elevation ?? 0;
    const us = f.boundary.map((p) => proj.u(p[0], p[1]));
    const ds = f.boundary.map((p) => proj.d(p[0], p[1]));
    let u0 = Math.min(...us), u1 = Math.max(...us);
    if (uClip) {
      u0 = Math.max(u0, uClip[0]);
      u1 = Math.min(u1, uClip[1]);
      if (u1 <= u0) continue;
    }
    const crossed = cutD !== null && Math.min(...ds) <= cutD && Math.max(...ds) >= cutD;
    if (cutD !== null && Math.max(...ds) < cutD) continue;
    prims.push({ t: 'rect', x: u0, y: -elev, w: u1 - u0, h: f.thickness, fill: crossed ? 'cut' : 'slab', id: f.id });
  }
  return prims;
}

/** A wall seen face-on (elevation, or beyond a section). */
function wallFace(w: WallElement, m: BimModel, proj: Proj, uClip?: [number, number]): Prim[] {
  const prims: Prim[] = [];
  const a = proj.u(w.start[0], w.start[1]);
  const b = proj.u(w.end[0], w.end[1]);
  let lo = Math.min(a, b), hi = Math.max(a, b);
  if (hi === lo) {
    // Wall seen end-on: show its thickness.
    lo -= w.thickness / 2;
    hi += w.thickness / 2;
  }
  const base = wallBase(w, m);
  const top = wallTopElevation(w, m);
  const l = Math.max(lo, uClip?.[0] ?? -Infinity);
  const r = Math.min(hi, uClip?.[1] ?? Infinity);
  if (r <= l) return prims;
  prims.push({ t: 'rect', x: l, y: -top, w: r - l, h: top - base, fill: 'beyond', id: w.id });

  const len = wallLengthMm(w);
  if (len > 0) {
    const dirU = b >= a ? 1 : -1;
    for (const op of openingsOn(w, m)) {
      const s1 = a + dirU * op.from;
      const s2 = a + dirU * op.to;
      const x0 = Math.min(s1, s2), x1 = Math.max(s1, s2);
      const cx0 = Math.max(x0, uClip?.[0] ?? -Infinity), cx1 = Math.min(x1, uClip?.[1] ?? Infinity);
      if (cx1 <= cx0) continue;
      prims.push({
        t: 'rect', x: cx0, y: -(base + op.top), w: cx1 - cx0, h: op.top - op.sill,
        fill: op.kind === 'window' ? 'glass' : 'door', id: op.id,
      });
    }
  }
  return prims;
}

function extents(m: BimModel): { y1: number; u: Bounds } {
  const b = modelBounds(m) ?? { minX: 0, maxX: 6000, minZ: 0, maxZ: 4000 };
  const walls = wallsOf(m);
  const wallTop = Math.max(0, ...walls.map((w) => wallTopElevation(w, m)));
  const roofTop = Math.max(
    0,
    ...m.elements
      .filter((e): e is RoofElement => e.type === 'roof')
      .map((r) => {
        const base = levelById(m, r.baseLevelId)?.elevation ?? 0;
        return base + 4000;
      })
  );
  const levelTop = Math.max(0, ...m.levels.map((l) => l.elevation));
  return { y1: Math.max(wallTop, roofTop, levelTop) + 600, u: b };
}

export function buildElevation(m: BimModel, direction: CompassDir): Drawing {
  const proj = projection(LOOK_OF_COMPASS[direction]);
  const { y1, u } = extents(m);
  const corners: Point[] = [[u.minX, u.minZ], [u.maxX, u.minZ], [u.minX, u.maxZ], [u.maxX, u.maxZ]];
  const us = corners.map(([x, z]) => proj.u(x, z));
  const pad = 1200;
  const x0 = Math.min(...us) - pad;
  const x1 = Math.max(...us) + pad;
  const prims: Prim[] = [];
  levelLines(m, x0, x1, prims, 220);

  // Far to near: nearer walls overdraw farther ones.
  const walls = [...wallsOf(m)].sort(
    (a, b) =>
      Math.max(proj.d(b.start[0], b.start[1]), proj.d(b.end[0], b.end[1])) -
      Math.max(proj.d(a.start[0], a.start[1]), proj.d(a.end[0], a.end[1]))
  );
  prims.push(...floorPrims(m, proj, null));
  for (const w of walls) prims.push(...wallFace(w, m, proj));
  for (const s of m.elements) if (s.type === 'stair') prims.push(...stairPrims(s, m, proj));
  for (const r of m.elements) if (r.type === 'roof') prims.push(...roofPrims(r, m, proj));
  return { minX: x0, minY: -y1, width: x1 - x0 + 1400, height: y1 + 600, prims };
}

export function buildSection(m: BimModel, view: ViewElement): Drawing {
  const look = view.lookDir ?? 'z+';
  const proj = projection(look);
  const cut = view.cutLine ?? [[0, 0], [6000, 0]];
  const cutD = proj.d(cut[0][0], cut[0][1]);
  const uA = proj.u(cut[0][0], cut[0][1]);
  const uB = proj.u(cut[1][0], cut[1][1]);
  const u0 = Math.min(uA, uB), u1 = Math.max(uA, uB);
  const { y1 } = extents(m);
  const prims: Prim[] = [];
  levelLines(m, u0 - 400, u1 + 400, prims, 200);

  const walls = wallsOf(m);
  const maxD = (w: WallElement) => Math.max(proj.d(w.start[0], w.start[1]), proj.d(w.end[0], w.end[1]));
  const minD = (w: WallElement) => Math.min(proj.d(w.start[0], w.start[1]), proj.d(w.end[0], w.end[1]));

  // Beyond the cut, far to near.
  const beyond = walls
    .filter((w) => maxD(w) > cutD && minD(w) >= cutD)
    .sort((a, b) => maxD(b) - maxD(a));
  prims.push(...floorPrims(m, proj, cutD, [u0, u1]));
  for (const w of beyond) prims.push(...wallFace(w, m, proj, [u0, u1]));

  // Walls the cut plane passes through.
  for (const w of walls) {
    if (!(minD(w) < cutD && maxD(w) > cutD)) continue;
    const uw = proj.u(w.start[0], w.start[1]);
    if (uw < u0 || uw > u1) continue;
    const base = wallBase(w, m);
    const top = wallTopElevation(w, m);
    const x = uw - w.thickness / 2;
    // Where along the wall (from its start) does the plane cut it?
    const dStart = proj.d(w.start[0], w.start[1]);
    const dEnd = proj.d(w.end[0], w.end[1]);
    const along = Math.abs(cutD - dStart) * (wallLengthMm(w) / Math.max(1, Math.abs(dEnd - dStart)));
    const hole = openingsOn(w, m).find((o) => along >= o.from && along <= o.to);
    if (!hole) {
      prims.push({ t: 'rect', x, y: -top, w: w.thickness, h: top - base, fill: 'cut', id: w.id });
    } else {
      if (hole.sill > 0) prims.push({ t: 'rect', x, y: -(base + hole.sill), w: w.thickness, h: hole.sill, fill: 'cut', id: w.id });
      if (base + hole.top < top) prims.push({ t: 'rect', x, y: -top, w: w.thickness, h: top - (base + hole.top), fill: 'cut', id: w.id });
    }
  }
  for (const s of m.elements) {
    if (s.type === 'stair') {
      const dS = proj.d(s.start[0], s.start[1]);
      if (dS >= cutD - 3000) prims.push(...stairPrims(s, m, proj));
    }
  }
  for (const r of m.elements) if (r.type === 'roof') prims.push(...roofPrims(r, m, proj, [u0, u1]));
  const pad = 400;
  return {
    minX: u0 - pad,
    minY: -y1,
    width: u1 - u0 + pad * 2 + 1500,
    height: y1 + 600,
    prims,
  };
}

/** Plan drawing used on sheets (the live plan has its own, richer renderer). */
export function buildPlan(m: BimModel, view: ViewElement): Drawing {
  const crop = viewCrop(view);
  const b = crop ?? (() => {
    const mb = modelBounds(m) ?? { minX: 0, maxX: 6000, minZ: 0, maxZ: 4000 };
    return { minX: mb.minX - 700, maxX: mb.maxX + 700, minZ: mb.minZ - 900, maxZ: mb.maxZ + 700 };
  })();
  const level = view.levelId ?? m.levels[0]?.id;
  const prims: Prim[] = [];
  const inside = (p: Point) => p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ;
  const cutH = (view.cutHeight ?? 1200) + (levelById(m, level ?? '')?.elevation ?? 0);

  for (const r of m.elements) {
    if (r.type !== 'room' || r.levelId !== level) continue;
    const bd = roomBoundary(r, m);
    for (const q of bd.rects) prims.push({ t: 'rect', x: q[0], y: q[1], w: q[2] - q[0], h: q[3] - q[1], fill: 'room', id: r.id });
  }
  for (const w of wallsOf(m)) {
    if (w.baseLevelId !== level) continue;
    if (!inside(w.start) && !inside(w.end)) continue;
    const [sx, sz] = w.start;
    const [ex, ez] = w.end;
    const horiz = sz === ez;
    const t = w.thickness / 2;
    const ops = openingsOn(w, m).sort((a, c) => a.from - c.from);
    const len = wallLengthMm(w);
    const dir = horiz ? Math.sign(ex - sx) : Math.sign(ez - sz);
    const segs: Array<[number, number]> = [];
    let cur = 0;
    for (const o of ops) {
      if (o.from > cur) segs.push([cur, o.from]);
      cur = Math.max(cur, o.to);
    }
    if (cur < len) segs.push([cur, len]);
    for (const [s0, s1] of segs) {
      const p0 = horiz ? sx + dir * s0 : sx;
      const p1 = horiz ? sx + dir * s1 : sx;
      const q0 = horiz ? sz : sz + dir * s0;
      const q1 = horiz ? sz : sz + dir * s1;
      prims.push({
        t: 'rect',
        x: Math.min(p0, p1) - (horiz ? 0 : t),
        y: Math.min(q0, q1) - (horiz ? t : 0),
        w: horiz ? Math.abs(p1 - p0) : w.thickness,
        h: horiz ? w.thickness : Math.abs(q1 - q0),
        fill: 'cut',
        id: w.id,
      });
    }
    for (const o of ops) {
      const visible = cutH >= wallBase(w, m) + o.sill && cutH <= wallBase(w, m) + o.top;
      const a0 = horiz ? sx + dir * o.from : sx;
      const a1 = horiz ? sx + dir * o.to : sx;
      const c0 = horiz ? sz : sz + dir * o.from;
      const c1 = horiz ? sz : sz + dir * o.to;
      prims.push({ t: 'line', x1: a0, y1: c0, x2: a1, y2: c1, style: visible ? 'swing' : 'thin' });
    }
  }
  for (const d of m.elements) {
    if (d.type !== 'dimension') continue;
    const v = dimensionValue(d, m);
    const wa = wallsOf(m).find((w) => w.id === d.wallA);
    const wb = wallsOf(m).find((w) => w.id === d.wallB);
    if (v === null || !wa || !wb) continue;
    if (wa.start[1] === wa.end[1]) {
      const x = (Math.min(wa.start[0], wa.end[0]) + Math.max(wa.start[0], wa.end[0])) / 2 + 400;
      prims.push({ t: 'line', x1: x, y1: wa.start[1], x2: x, y2: wb.start[1], style: 'dim' });
      prims.push({ t: 'text', x: x + 120, y: (wa.start[1] + wb.start[1]) / 2, s: String(v), size: 170, anchor: 'start', tone: 'dim' });
    } else {
      const z = (Math.min(wa.start[1], wa.end[1]) + Math.max(wa.start[1], wa.end[1])) / 2 + 400;
      prims.push({ t: 'line', x1: wa.start[0], y1: z, x2: wb.start[0], y2: z, style: 'dim' });
      prims.push({ t: 'text', x: (wa.start[0] + wb.start[0]) / 2, y: z - 120, s: String(v), size: 170, anchor: 'middle', tone: 'dim' });
    }
  }
  return { minX: b.minX, minY: b.minZ, width: b.maxX - b.minX, height: b.maxZ - b.minZ, prims };
}

export function buildViewDrawing(m: BimModel, view: ViewElement): Drawing {
  if (view.kind === 'section') return buildSection(m, view);
  if (view.kind === 'elevation') return buildElevation(m, view.direction ?? 'S');
  return buildPlan(m, view);
}
