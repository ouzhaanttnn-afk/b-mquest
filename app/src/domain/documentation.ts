import { levelById, wallsOf } from './derived';
import {
  cloneModelDeep,
  nextId,
  parseStrictIntegerMm,
  type CommandError,
} from './validation';
import type {
  BimModel,
  CompassDir,
  DimensionElement,
  Point,
  SheetElement,
  StairDirection,
  TagElement,
  ViewElement,
  ViewKind,
  WallElement,
} from './types';

export type DocOp =
  | { ok: true; model: BimModel; createdId?: string }
  | { ok: false; error: CommandError };

const fail = (code: string, message: string, field?: string): DocOp => ({
  ok: false,
  error: { code, message, field },
});

export const SHEET_W = 420;
export const SHEET_H = 297;

// ---- derived values ---------------------------------------------------------

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Bounding box of the walls (centre lines); null for an empty model. */
export function modelBounds(model: BimModel): Bounds | null {
  const walls = wallsOf(model);
  if (walls.length === 0) return null;
  const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

const isHorizontal = (w: WallElement) => w.start[1] === w.end[1];

/** Distance between two parallel wall centre lines (mm), else null. */
export function dimensionValue(dim: DimensionElement, model: BimModel): number | null {
  const a = wallsOf(model).find((w) => w.id === dim.wallA);
  const b = wallsOf(model).find((w) => w.id === dim.wallB);
  if (!a || !b || isHorizontal(a) !== isHorizontal(b)) return null;
  return isHorizontal(a)
    ? Math.abs(a.start[1] - b.start[1])
    : Math.abs(a.start[0] - b.start[0]);
}

/** Text a tag shows: Mark for doors/windows, "name number" for rooms. */
export function tagLabel(tag: TagElement, model: BimModel): string {
  const t = model.elements.find((e) => e.id === tag.targetId);
  if (!t) return '?';
  if (t.type === 'door' || t.type === 'window') return t.mark;
  if (t.type === 'room') return `${t.name}${t.number ? ' ' + t.number : ''}`;
  return t.id;
}

export function viewCrop(view: ViewElement): Bounds | null {
  const { cropMinX, cropMaxX, cropMinZ, cropMaxZ } = view;
  if (
    cropMinX === undefined || cropMaxX === undefined ||
    cropMinZ === undefined || cropMaxZ === undefined
  ) {
    return null;
  }
  return { minX: cropMinX, maxX: cropMaxX, minZ: cropMinZ, maxZ: cropMaxZ };
}

/** Does a section's cut line pass through the building? */
export function sectionCutsModel(view: ViewElement, model: BimModel): boolean {
  const b = modelBounds(model);
  if (!b || view.kind !== 'section' || !view.cutLine) return false;
  const [p, q] = view.cutLine;
  const lo = { x: Math.min(p[0], q[0]), z: Math.min(p[1], q[1]) };
  const hi = { x: Math.max(p[0], q[0]), z: Math.max(p[1], q[1]) };
  return lo.x <= b.maxX && hi.x >= b.minX && lo.z <= b.maxZ && hi.z >= b.minZ;
}

export function sheetViewKinds(sheet: SheetElement, model: BimModel): Set<ViewKind> {
  const kinds = new Set<ViewKind>();
  for (const pl of sheet.placements) {
    const v = model.elements.find((e) => e.id === pl.viewId);
    if (v && v.type === 'view') kinds.add(v.kind);
  }
  return kinds;
}

// ---- operations -----------------------------------------------------------------

export interface CreateViewInput {
  kind: ViewKind;
  levelId?: string;
  cutLine?: [Point, Point];
  lookDir?: StairDirection;
  direction?: CompassDir;
  name?: string;
}

const ELEV_NAME: Record<CompassDir, string> = { N: 'Kuzey', S: 'Güney', E: 'Doğu', W: 'Batı' };

/** Default look direction of a section from its cut line. */
export function defaultLookDir(cut: [Point, Point]): StairDirection {
  return cut[0][1] === cut[1][1] ? 'z+' : 'x+';
}

export function createViewOp(model: BimModel, input: CreateViewInput): DocOp {
  const id = nextId(model, 'v');
  const views = model.elements.filter((e) => e.type === 'view');
  let view: ViewElement;
  if (input.kind === 'plan') {
    const level = levelById(model, input.levelId ?? model.levels[0].id);
    if (!level) return fail('E_LEVEL', 'Plan görünümü için geçerli bir kat seçilmelidir.', 'levelId');
    view = { id, type: 'view', name: input.name ?? `Plan - ${level.name}`, kind: 'plan', levelId: level.id, scale: 100, cutHeight: 1200 };
  } else if (input.kind === 'section') {
    const cut = input.cutLine;
    if (!cut) return fail('E_SECTION_LINE', 'Kesit için iki nokta gerekir.');
    if (cut[0][0] !== cut[1][0] && cut[0][1] !== cut[1][1]) {
      return fail('E_SECTION_AXIS', 'Kesit çizgisi yalnızca X veya Z eksenine paralel olabilir.');
    }
    if (cut[0][0] === cut[1][0] && cut[0][1] === cut[1][1]) {
      return fail('E_SECTION_LINE', 'Kesit çizgisinin iki ucu aynı olamaz.');
    }
    const n = views.filter((v) => v.type === 'view' && v.kind === 'section').length + 1;
    view = {
      id, type: 'view', name: input.name ?? `Kesit ${n}`, kind: 'section',
      cutLine: [[cut[0][0], cut[0][1]], [cut[1][0], cut[1][1]]],
      lookDir: input.lookDir ?? defaultLookDir(cut), scale: 50,
    };
  } else {
    const dir = input.direction;
    if (!dir) return fail('E_ELEVATION_DIR', 'Cephe yönü seçilmelidir.');
    if (views.some((v) => v.type === 'view' && v.kind === 'elevation' && v.direction === dir)) {
      return fail('E_ELEVATION_DUP', `${ELEV_NAME[dir]} cephesi zaten var.`);
    }
    view = { id, type: 'view', name: input.name ?? `Cephe - ${ELEV_NAME[dir]}`, kind: 'elevation', direction: dir, scale: 100 };
  }
  const next = cloneModelDeep(model);
  next.elements.push(view);
  return { ok: true, model: next, createdId: id };
}

export function createDimensionOp(
  model: BimModel,
  wallA: string,
  wallB: string
): DocOp {
  const walls = wallsOf(model);
  const a = walls.find((w) => w.id === wallA);
  const b = walls.find((w) => w.id === wallB);
  if (!a || !b || a.id === b.id) {
    return fail('E_DIM_REF', 'Ölçü için birbirinden farklı iki duvar seçmelisin.');
  }
  if (isHorizontal(a) !== isHorizontal(b)) {
    return fail('E_DIM_PARALLEL', 'Ölçülendirilecek iki duvar birbirine paralel olmalıdır.');
  }
  if (model.elements.some((e) => e.type === 'dimension' && ((e.wallA === a.id && e.wallB === b.id) || (e.wallA === b.id && e.wallB === a.id)))) {
    return fail('E_DIM_DUP', 'Bu iki duvar arasında zaten bir ölçü var.');
  }
  const id = nextId(model, 'dim');
  const dim: DimensionElement = { id, type: 'dimension', name: `Ölçü ${id.slice(3)}`, wallA: a.id, wallB: b.id };
  const next = cloneModelDeep(model);
  next.elements.push(dim);
  return { ok: true, model: next, createdId: id };
}

export function createTagOp(model: BimModel, targetId: string): DocOp {
  const t = model.elements.find((e) => e.id === targetId);
  if (!t || !(t.type === 'door' || t.type === 'window' || t.type === 'room')) {
    return fail('E_TAG_TARGET', 'Yalnızca kapı, pencere ve odalar etiketlenir.');
  }
  if (model.elements.some((e) => e.type === 'tag' && e.targetId === targetId)) {
    return fail('E_TAG_DUP', `${targetId} zaten etiketli.`);
  }
  const id = nextId(model, 'tg');
  const tag: TagElement = { id, type: 'tag', name: `Etiket ${id.slice(2)}`, targetId };
  const next = cloneModelDeep(model);
  next.elements.push(tag);
  return { ok: true, model: next, createdId: id };
}

export function createSheetOp(model: BimModel, input: { number?: string; name?: string } = {}): DocOp {
  const sheets = model.elements.filter((e) => e.type === 'sheet');
  const id = nextId(model, 'sh');
  const sheet: SheetElement = {
    id,
    type: 'sheet',
    name: input.name?.trim() || 'Adsız Pafta',
    number: input.number?.trim() || `A-${100 + sheets.length + 1}`,
    size: 'A3',
    placements: [],
  };
  const next = cloneModelDeep(model);
  next.elements.push(sheet);
  return { ok: true, model: next, createdId: id };
}

/** Paper size (mm) a view occupies on a sheet at its scale. */
export function viewPaperSize(view: ViewElement, model: BimModel): { w: number; h: number } {
  const crop = viewCrop(view) ?? modelBounds(model) ?? { minX: 0, maxX: 6000, minZ: 0, maxZ: 4000 };
  const widthMm =
    view.kind === 'section' && view.cutLine
      ? Math.hypot(view.cutLine[1][0] - view.cutLine[0][0], view.cutLine[1][1] - view.cutLine[0][1])
      : view.kind === 'elevation' && (view.direction === 'E' || view.direction === 'W')
      ? crop.maxZ - crop.minZ
      : crop.maxX - crop.minX;
  const heightMm =
    view.kind === 'plan'
      ? crop.maxZ - crop.minZ
      : Math.max(...model.levels.map((l) => l.elevation), 0) + 3600;
  return { w: Math.max(10, widthMm / view.scale), h: Math.max(10, heightMm / view.scale) };
}

const TITLE_BLOCK = { x: SHEET_W - 130, z: SHEET_H - 50, w: 120, h: 40 };

const overlaps = (
  a: { x: number; z: number; w: number; h: number },
  b: { x: number; z: number; w: number; h: number }
) => a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.h && b.z < a.z + a.h;

/** First free spot (10 mm grid) that avoids the other views and title block. */
export function autoPlacement(
  model: BimModel,
  sheet: SheetElement,
  view: ViewElement
): Point | null {
  const size = viewPaperSize(view, model);
  const taken = sheet.placements
    .filter((p) => p.viewId !== view.id)
    .map((p) => {
      const v = model.elements.find((e) => e.id === p.viewId);
      const sz = v && v.type === 'view' ? viewPaperSize(v, model) : { w: 0, h: 0 };
      return { x: p.x - 4, z: p.z - 4, w: sz.w + 8, h: sz.h + 16 };
    });
  for (let z = 20; z + size.h <= SHEET_H - 14; z += 10) {
    for (let x = 20; x + size.w <= SHEET_W - 14; x += 10) {
      const r = { x, z, w: size.w, h: size.h + 8 };
      if (overlaps(r, TITLE_BLOCK)) continue;
      if (taken.some((t) => overlaps(r, t))) continue;
      return [x, z];
    }
  }
  return null;
}

/** Puts (or moves) a view on a sheet; positions are snapped to 5 mm. */
export function placeOnSheetOp(
  model: BimModel,
  sheetId: string,
  viewId: string,
  x?: number,
  z?: number
): DocOp {
  const sheet = model.elements.find((e) => e.id === sheetId);
  const view = model.elements.find((e) => e.id === viewId);
  if (!sheet || sheet.type !== 'sheet') return fail('E_SHEET', `${sheetId} kimlikli pafta bulunamadı.`);
  if (!view || view.type !== 'view') return fail('E_VIEW', `${viewId} kimlikli görünüm bulunamadı.`);
  const size = viewPaperSize(view, model);
  const existing = sheet.placements.find((p) => p.viewId === viewId);
  let wantX = x ?? existing?.x;
  let wantZ = z ?? existing?.z;
  if (wantX === undefined || wantZ === undefined) {
    const spot = autoPlacement(model, sheet, view);
    if (!spot) {
      return fail(
        'E_SHEET_FULL',
        `Pafta dolu: ${view.name} (${Math.round(size.w)}×${Math.round(size.h)} mm) için boş yer yok; ölçeği küçült (1:${view.scale * 2}).`,
        'placements'
      );
    }
    [wantX, wantZ] = spot;
  }
  const px = parseStrictIntegerMm(wantX, 'offset', 0, 420);
  const pz = parseStrictIntegerMm(wantZ, 'offset', 0, 297);
  if (!px.ok) return { ok: false, error: px.error };
  if (!pz.ok) return { ok: false, error: pz.error };
  const nx = Math.round(px.value / 5) * 5;
  const nz = Math.round(pz.value / 5) * 5;
  if (nx + size.w > SHEET_W - 10 || nz + size.h > SHEET_H - 10 || nx < 10 || nz < 10) {
    return fail(
      'E_SHEET_BOUNDS',
      `Görünüm (${Math.round(size.w)}×${Math.round(size.h)} mm) pafta çerçevesine sığmıyor; konumu değiştir ya da ölçeği küçült (1:${view.scale * 2}).`,
      'placements'
    );
  }
  const next = cloneModelDeep(model);
  const target = next.elements.find((e) => e.id === sheetId) as SheetElement;
  target.placements = [...target.placements.filter((p) => p.viewId !== viewId), { viewId, x: nx, z: nz }];
  return { ok: true, model: next };
}

export function removeFromSheetOp(model: BimModel, sheetId: string, viewId: string): DocOp {
  const next = cloneModelDeep(model);
  const sheet = next.elements.find((e) => e.id === sheetId);
  if (!sheet || sheet.type !== 'sheet') return fail('E_SHEET', `${sheetId} kimlikli pafta bulunamadı.`);
  sheet.placements = sheet.placements.filter((p) => p.viewId !== viewId);
  return { ok: true, model: next };
}

/** Crop region on / off. "On" starts from the model bounds plus a margin. */
export function setCropOp(model: BimModel, viewId: string, on: boolean): DocOp {
  const next = cloneModelDeep(model);
  const v = next.elements.find((e) => e.id === viewId);
  if (!v || v.type !== 'view') return fail('E_VIEW', `${viewId} kimlikli görünüm bulunamadı.`);
  if (on) {
    const b = modelBounds(model) ?? { minX: 0, maxX: 6000, minZ: 0, maxZ: 4000 };
    v.cropMinX = b.minX - 500;
    v.cropMaxX = b.maxX + 500;
    v.cropMinZ = b.minZ - 500;
    v.cropMaxZ = b.maxZ + 500;
  } else {
    delete v.cropMinX;
    delete v.cropMaxX;
    delete v.cropMinZ;
    delete v.cropMaxZ;
  }
  return { ok: true, model: next };
}

/** Moves the crop region in one step (drag of a corner handle). */
export function setCropRectOp(
  model: BimModel,
  viewId: string,
  rect: Bounds
): DocOp {
  const next = cloneModelDeep(model);
  const v = next.elements.find((e) => e.id === viewId);
  if (!v || v.type !== 'view') return fail('E_VIEW', `${viewId} kimlikli görünüm bulunamadı.`);
  if (rect.maxX - rect.minX < 500 || rect.maxZ - rect.minZ < 500) {
    return fail('E_CROP_SIZE', 'Kadraj en az 500 × 500 mm olmalıdır.', 'cropMinX');
  }
  v.cropMinX = Math.round(rect.minX / 50) * 50;
  v.cropMaxX = Math.round(rect.maxX / 50) * 50;
  v.cropMinZ = Math.round(rect.minZ / 50) * 50;
  v.cropMaxZ = Math.round(rect.maxZ / 50) * 50;
  return { ok: true, model: next };
}
