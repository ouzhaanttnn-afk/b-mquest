import { hostedElements } from './derived';
import { cloneModelDeep, nextId, parseStrictIntegerMm, type CommandError } from './validation';
import type { BimElement, BimModel, Point, WallElement } from './types';
import type { OpResult } from './modelOps';

/**
 * Revit Modify tools on walls: Copy, Mirror, Offset, Align.
 * Hosted doors/windows travel with their wall so relationships stay intact.
 */

const MAX_ELEMENTS = 500;
const LIMIT = 100_000;

const fail = (code: string, message: string, field?: string): OpResult => ({
  ok: false,
  error: { code, message, field } as CommandError,
});

const wallById = (model: BimModel, id: string): WallElement | null => {
  const el = model.elements.find((e) => e.id === id);
  return el && el.type === 'wall' ? el : null;
};

function coord(raw: unknown, field: string, min = -LIMIT, max = LIMIT) {
  return parseStrictIntegerMm(raw, field, min, max);
}

/** Clone walls with `place` applied to each; hosted openings follow. */
function cloneWalls(
  model: BimModel,
  ids: string[],
  place: (w: WallElement) => { start: Point; end: Point }
): OpResult {
  const walls = ids.map((id) => wallById(model, id));
  if (ids.length === 0 || walls.some((w) => !w)) {
    return fail('E_NOT_FOUND', 'Önce kopyalanacak duvar(lar)ı seç.');
  }
  const next = cloneModelDeep(model);
  let firstId: string | undefined;
  for (const w of walls as WallElement[]) {
    const open = hostedElements(w.id, model);
    if (next.elements.length + 1 + open.length > MAX_ELEMENTS) {
      return fail('E_MAX_ELEMENTS', 'Model en fazla 500 nesne içerebilir.');
    }
    const { start, end } = place(w);
    for (const v of [...start, ...end]) {
      if (!Number.isInteger(v) || Math.abs(v) > LIMIT) {
        return fail('E_RANGE', 'Sonuç model sınırlarının dışında kalıyor.');
      }
    }
    const id = nextId(next, 'w');
    const copy: WallElement = {
      ...w,
      id,
      name: `${w.name}-k`,
      start: [start[0], start[1]],
      end: [end[0], end[1]],
    };
    next.elements.push(copy);
    firstId ??= id;
    for (const o of open) {
      const oid = nextId(next, o.type === 'door' ? 'd' : 'win');
      next.elements.push({ ...(o as BimElement), id: oid, hostWallId: id } as BimElement);
    }
  }
  return { ok: true, model: next, createdId: firstId };
}

/** Copy: duplicate walls moved by (dx, dz). */
export function copyWallsOp(
  model: BimModel,
  ids: string[],
  dxRaw: unknown,
  dzRaw: unknown
): OpResult {
  const dx = coord(dxRaw, 'dx');
  if (!dx.ok) return { ok: false, error: dx.error };
  const dz = coord(dzRaw, 'dz');
  if (!dz.ok) return { ok: false, error: dz.error };
  if (dx.value === 0 && dz.value === 0) {
    return fail('E_ZERO_MOVE', 'Kopya aynı yere düşer; dx veya dz sıfırdan farklı olmalı.');
  }
  return cloneWalls(model, ids, (w) => ({
    start: [w.start[0] + dx.value, w.start[1] + dz.value],
    end: [w.end[0] + dx.value, w.end[1] + dz.value],
  }));
}

/**
 * Mirror: reflect walls across a vertical line x = at (axis 'x') or a
 * horizontal line z = at (axis 'z'). The originals stay.
 */
export function mirrorWallsOp(
  model: BimModel,
  ids: string[],
  axis: 'x' | 'z',
  atRaw: unknown
): OpResult {
  const at = coord(atRaw, 'at');
  if (!at.ok) return { ok: false, error: at.error };
  const m = (p: Point): Point =>
    axis === 'x' ? [2 * at.value - p[0], p[1]] : [p[0], 2 * at.value - p[1]];
  const res = cloneWalls(model, ids, (w) => ({ start: m(w.start), end: m(w.end) }));
  if (res.ok) {
    const same = ids.every((id) => {
      const w = wallById(model, id)!;
      const [s, e] = [m(w.start), m(w.end)];
      return s[0] === w.start[0] && s[1] === w.start[1] && e[0] === w.end[0] && e[1] === w.end[1];
    });
    if (same) return fail('E_ZERO_MOVE', 'Ayna ekseni duvarın üzerinde; kopya aynı yere düşer.');
  }
  return res;
}

/** Offset: a parallel copy `distance` mm to the left of the wall direction. */
export function offsetWallOp(model: BimModel, id: string, distanceRaw: unknown): OpResult {
  const d = coord(distanceRaw, 'distance', -LIMIT, LIMIT);
  if (!d.ok) return { ok: false, error: d.error };
  if (d.value === 0) return fail('E_ZERO_MOVE', 'Öteleme mesafesi sıfır olamaz.');
  const w = wallById(model, id);
  if (!w) return fail('E_NOT_FOUND', 'Önce ötelenecek duvarı seç.');
  const dx = w.end[0] - w.start[0];
  const dz = w.end[1] - w.start[1];
  const len = Math.hypot(dx, dz);
  if (len === 0) return fail('E_DEGENERATE', 'Sıfır uzunluklu duvar ötelenemez.');
  const ox = Math.round((-dz / len) * d.value);
  const oz = Math.round((dx / len) * d.value);
  return cloneWalls(model, [id], (s) => ({
    start: [s.start[0] + ox, s.start[1] + oz],
    end: [s.end[0] + ox, s.end[1] + oz],
  }));
}

/** Align: slide a wall (parallel to the reference) onto the reference's line. */
export function alignWallOp(model: BimModel, movingId: string, refId: string): OpResult {
  const mv = wallById(model, movingId);
  const ref = wallById(model, refId);
  if (!mv || !ref) return fail('E_NOT_FOUND', 'Hizalanacak duvarı ve referans duvarı seç.');
  if (mv.id === ref.id) return fail('E_SAME', 'Bir duvarı kendisine hizalayamazsın.');
  const mvH = mv.start[1] === mv.end[1];
  const mvV = mv.start[0] === mv.end[0];
  const refH = ref.start[1] === ref.end[1];
  const refV = ref.start[0] === ref.end[0];
  if (!((mvH && refH) || (mvV && refV))) {
    return fail(
      'E_NOT_PARALLEL',
      'Hizalama için iki duvarın da aynı yönde (ikisi yatay ya da ikisi düşey) olması gerekir.'
    );
  }
  const next = cloneModelDeep(model);
  const idx = next.elements.findIndex((e) => e.id === movingId);
  const target = mvH ? ref.start[1] : ref.start[0];
  const cur = mvH ? mv.start[1] : mv.start[0];
  if (target === cur) return fail('E_ZERO_MOVE', 'Duvarlar zaten aynı hizada.');
  next.elements[idx] = {
    ...mv,
    start: mvH ? [mv.start[0], target] : [target, mv.start[1]],
    end: mvH ? [mv.end[0], target] : [target, mv.end[1]],
  };
  return { ok: true, model: next };
}

export interface RectangleWallsInput {
  /** South-west corner. */
  x: number;
  z: number;
  width: unknown;
  depth: unknown;
  baseLevelId: string;
  height: number;
  thickness: number;
}

/** Four walls around a rectangle in one step (Revit's Rectangle draw option). */
export function rectangleWallsOp(model: BimModel, input: RectangleWallsInput): OpResult {
  const w = coord(input.width, 'width', 100, LIMIT);
  if (!w.ok) return { ok: false, error: w.error };
  const d = coord(input.depth, 'depth', 100, LIMIT);
  if (!d.ok) return { ok: false, error: d.error };
  if (model.elements.length + 4 > MAX_ELEMENTS) {
    return fail('E_MAX_ELEMENTS', 'Model en fazla 500 nesne içerebilir.');
  }
  if (!model.levels.some((l) => l.id === input.baseLevelId)) {
    return fail('E_LEVEL', 'Geçerli bir kat seçilmelidir.');
  }
  const x0 = input.x;
  const z0 = input.z;
  const x1 = x0 + w.value;
  const z1 = z0 + d.value;
  const corners: Array<[Point, Point, string]> = [
    [[x0, z0], [x1, z0], 'Güney'],
    [[x1, z0], [x1, z1], 'Doğu'],
    [[x1, z1], [x0, z1], 'Kuzey'],
    [[x0, z1], [x0, z0], 'Batı'],
  ];
  const next = cloneModelDeep(model);
  let first: string | undefined;
  for (const [start, end, label] of corners) {
    const id = nextId(next, 'w');
    first ??= id;
    next.elements.push({
      id,
      type: 'wall',
      name: `${label} duvar`,
      baseLevelId: input.baseLevelId,
      start: [start[0], start[1]],
      end: [end[0], end[1]],
      height: input.height,
      thickness: input.thickness,
    });
  }
  return { ok: true, model: next, createdId: first };
}
