import {
  constrainedWallHeight,
  levelById,
  rectPolygon,
  wallLengthMm,
  wallsOf,
  wallsOutline,
} from './derived';
import {
  type CommandError,
  normalizeTextField,
  parseStrictIntegerMm,
} from './validation';
import type {
  BimElement,
  BimModel,
  ElementType,
  FloorElement,
  GridElement,
  Point,
  RoofElement,
  RoomElement,
  StairDirection,
  StairElement,
  WindowElement,
} from './types';

export type OpResult =
  | { ok: true; model: BimModel; createdId?: string }
  | { ok: false; error: CommandError };

const fail = (code: string, message: string, field?: string): OpResult => ({
  ok: false,
  error: { code, message, field },
});

export function cloneModelDeep(model: BimModel): BimModel {
  return JSON.parse(JSON.stringify(model)) as BimModel;
}

/** Smallest unused id of the form `${prefix}${n}`. */
export function nextId(model: BimModel, prefix: string): string {
  const used = new Set(model.elements.map((e) => e.id));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const MAX_ELEMENTS = 500;
const tooMany = (model: BimModel): OpResult | null =>
  model.elements.length >= MAX_ELEMENTS
    ? fail('E_MAX_ELEMENTS', 'Model en fazla 500 nesne içerebilir.')
    : null;

const withElement = (
  model: BimModel,
  el: BimElement
): OpResult => {
  const next = cloneModelDeep(model);
  next.elements.push(el);
  return { ok: true, model: next, createdId: el.id };
};

// ---- creation -------------------------------------------------------------

export interface CreateWindowInput {
  hostWallId: string;
  offset: unknown;
  width: unknown;
  height: unknown;
  sill: unknown;
  name?: string;
  mark?: string;
  typeId?: string;
}

export function createWindowOp(model: BimModel, input: CreateWindowInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  const host = wallsOf(model).find((w) => w.id === input.hostWallId);
  if (!host) {
    return fail('E_HOST_MISSING', 'Pencere için geçerli bir taşıyıcı duvar seçilmelidir.', 'hostWallId');
  }
  const offset = parseStrictIntegerMm(input.offset, 'offset', 0, 200000);
  if (!offset.ok) return { ok: false, error: offset.error };
  const width = parseStrictIntegerMm(input.width, 'width', 1, 20000);
  if (!width.ok) return { ok: false, error: width.error };
  const height = parseStrictIntegerMm(input.height, 'height', 1, 20000);
  if (!height.ok) return { ok: false, error: height.error };
  const sill = parseStrictIntegerMm(input.sill, 'sill', 0, 20000);
  if (!sill.ok) return { ok: false, error: sill.error };
  if (offset.value + width.value > wallLengthMm(host)) {
    return fail(
      'E_OPENING_BOUNDS',
      `Pencere genişliği ve ofset toplamı (${offset.value + width.value} mm), duvar uzunluğunu (${wallLengthMm(host)} mm) aşıyor.`,
      'offset'
    );
  }
  if (sill.value + height.value > host.height) {
    return fail(
      'E_OPENING_BOUNDS',
      `Pencere parapet ve yükseklik toplamı (${sill.value + height.value} mm), duvar yüksekliğini (${host.height} mm) aşıyor.`,
      'height'
    );
  }
  const id = nextId(model, 'win');
  const win: WindowElement = {
    id,
    type: 'window',
    name: input.name?.trim() || 'Pencere',
    hostWallId: host.id,
    offset: offset.value,
    width: width.value,
    height: height.value,
    sill: sill.value,
    mark: input.mark?.trim() || `W-${id.slice(3).padStart(2, '0')}`,
    ...(input.typeId ? { typeId: input.typeId } : {}),
  };
  return withElement(model, win);
}

export interface CreateFloorInput {
  levelId: string;
  /** Explicit outline; omitted = outline of the level's walls. */
  boundary?: Point[];
  thickness?: number;
  name?: string;
  typeId?: string;
}

export function createFloorOp(model: BimModel, input: CreateFloorInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  if (!levelById(model, input.levelId)) {
    return fail('E_LEVEL', 'Döşeme için geçerli bir kat seçilmelidir.', 'levelId');
  }
  const boundary = input.boundary ?? wallsOutline(model, input.levelId);
  if (!boundary || boundary.length < 3) {
    return fail(
      'E_FLOOR_BOUNDARY',
      'Döşeme sınırı için bu katta en az 3 duvar gerekir (Pick Walls) ya da bir sınır çizilmelidir.',
      'boundary'
    );
  }
  const type = input.typeId ? model.types?.find((t) => t.id === input.typeId) : undefined;
  const thickness = Number(type?.params.thickness ?? input.thickness ?? 200);
  const floor: FloorElement = {
    id: nextId(model, 'f'),
    type: 'floor',
    name: input.name?.trim() || 'Döşeme',
    levelId: input.levelId,
    boundary: boundary.map(([x, z]) => [x, z] as Point),
    thickness,
    ...(input.typeId ? { typeId: input.typeId } : {}),
  };
  return withElement(model, floor);
}

export interface CreateRoomInput {
  levelId: string;
  seedPoint: Point;
  name?: string;
  number?: string;
}

export function createRoomOp(model: BimModel, input: CreateRoomInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  if (!levelById(model, input.levelId)) {
    return fail('E_LEVEL', 'Oda için geçerli bir kat seçilmelidir.', 'levelId');
  }
  const sx = parseStrictIntegerMm(input.seedPoint[0], 'startX', -100000, 100000);
  if (!sx.ok) return { ok: false, error: sx.error };
  const sz = parseStrictIntegerMm(input.seedPoint[1], 'startZ', -100000, 100000);
  if (!sz.ok) return { ok: false, error: sz.error };
  const room: RoomElement = {
    id: nextId(model, 'r'),
    type: 'room',
    name: input.name?.trim() || 'Oda',
    number: input.number?.trim() ?? '',
    levelId: input.levelId,
    seedPoint: [sx.value, sz.value],
  };
  return withElement(model, room);
}

const gridName = (model: BimModel, vertical: boolean): string => {
  const grids = model.elements.filter((e): e is GridElement => e.type === 'grid');
  const used = new Set(grids.map((g) => g.name));
  if (vertical) {
    // Vertical lines (constant x) get letters A, B, C…
    for (let i = 0; i < 26; i++) {
      const n = String.fromCharCode(65 + i);
      if (!used.has(n)) return n;
    }
  }
  for (let i = 1; i < 100; i++) {
    if (!used.has(String(i))) return String(i);
  }
  return `G${grids.length + 1}`;
};

export interface CreateGridInput {
  start: Point;
  end: Point;
  name?: string;
}

export function createGridOp(model: BimModel, input: CreateGridInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  const [a, b] = [input.start, input.end];
  if (a[0] === b[0] && a[1] === b[1]) {
    return fail('E_GRID_DEGENERATE', 'Aks çizgisinin iki ucu aynı olamaz.');
  }
  const vertical = a[0] === b[0];
  const grid: GridElement = {
    id: nextId(model, 'g'),
    type: 'grid',
    name: input.name?.trim() || gridName(model, vertical),
    start: [a[0], a[1]],
    end: [b[0], b[1]],
  };
  return withElement(model, grid);
}

export interface CreateRoofInput {
  baseLevelId: string;
  footprint?: Point[];
  slope?: number;
  overhang?: number;
  name?: string;
  typeId?: string;
}

export function createRoofOp(model: BimModel, input: CreateRoofInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  if (!levelById(model, input.baseLevelId)) {
    return fail('E_LEVEL', 'Çatı için geçerli bir taban katı seçilmelidir.', 'baseLevelId');
  }
  let footprint = input.footprint;
  if (!footprint) {
    const walls = wallsOf(model);
    if (walls.length < 3) {
      return fail('E_ROOF_FOOTPRINT', 'Çatı sınırı için en az 3 duvar gerekir (Roof by Footprint).', 'footprint');
    }
    const xs = walls.flatMap((w) => [w.start[0], w.end[0]]);
    const zs = walls.flatMap((w) => [w.start[1], w.end[1]]);
    footprint = rectPolygon(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  }
  const slope = parseStrictIntegerMm(input.slope ?? 0, 'slope', 0, 89);
  if (!slope.ok) return { ok: false, error: slope.error };
  const overhang = parseStrictIntegerMm(input.overhang ?? 0, 'overhang', 0, 5000);
  if (!overhang.ok) return { ok: false, error: overhang.error };
  const roof: RoofElement = {
    id: nextId(model, 'rf'),
    type: 'roof',
    name: input.name?.trim() || 'Çatı',
    baseLevelId: input.baseLevelId,
    footprint: footprint.map(([x, z]) => [x, z] as Point),
    slope: slope.value,
    overhang: overhang.value,
    ...(input.typeId ? { typeId: input.typeId } : {}),
  };
  return withElement(model, roof);
}

export interface CreateStairInput {
  baseLevelId: string;
  topLevelId: string;
  start: Point;
  direction: StairDirection;
  width?: number;
  riserHeight?: number;
  treadDepth?: number;
  risers?: number;
  name?: string;
}

export function createStairOp(model: BimModel, input: CreateStairInput): OpResult {
  const full = tooMany(model);
  if (full) return full;
  const lo = levelById(model, input.baseLevelId);
  const hi = levelById(model, input.topLevelId);
  if (!lo || !hi || hi.elevation <= lo.elevation) {
    return fail('E_STAIR_LEVELS', 'Merdiven için üstteki kat alttakinden yüksek olmalıdır.', 'topLevelId');
  }
  const width = parseStrictIntegerMm(input.width ?? 1000, 'width', 300, 5000);
  if (!width.ok) return { ok: false, error: width.error };
  const riser = parseStrictIntegerMm(input.riserHeight ?? 175, 'riserHeight', 50, 400);
  if (!riser.ok) return { ok: false, error: riser.error };
  const tread = parseStrictIntegerMm(input.treadDepth ?? 280, 'treadDepth', 100, 600);
  if (!tread.ok) return { ok: false, error: tread.error };
  const risers = parseStrictIntegerMm(input.risers ?? 17, 'risers', 1, 100);
  if (!risers.ok) return { ok: false, error: risers.error };
  const stair: StairElement = {
    id: nextId(model, 's'),
    type: 'stair',
    name: input.name?.trim() || 'Merdiven',
    baseLevelId: lo.id,
    topLevelId: hi.id,
    start: [input.start[0], input.start[1]],
    direction: input.direction,
    width: width.value,
    riserHeight: riser.value,
    treadDepth: tread.value,
    risers: risers.value,
  };
  return withElement(model, stair);
}

// ---- relationships ----------------------------------------------------------

/** Recomputes the stored height of walls attached to a Level via Top Constraint. */
export function syncConstrainedWalls(model: BimModel): OpResult {
  const next = cloneModelDeep(model);
  for (const w of next.elements) {
    if (w.type !== 'wall' || !w.topConstraint) continue;
    const h = constrainedWallHeight(w, next);
    if (h === null) continue;
    if (h < 1) {
      return fail(
        'E_CONSTRAINT_HEIGHT',
        `${w.id}: Top Constraint ve Top Offset, duvar yüksekliğini sıfırın altına düşürüyor.`,
        'topOffset'
      );
    }
    w.height = h;
  }
  return { ok: true, model: next };
}

/** Level elevation changes ripple into every wall constrained to the Level. */
export function setLevelElevationOp(
  model: BimModel,
  levelId: string,
  raw: unknown
): OpResult {
  const level = levelById(model, levelId);
  if (!level) return fail('E_LEVEL', `${levelId} kimlikli kat bulunamadı.`, 'elevation');
  const parsed = parseStrictIntegerMm(raw, 'elevation', 0, 100000);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const next = cloneModelDeep(model);
  next.levels = next.levels.map((l) =>
    l.id === levelId ? { ...l, elevation: parsed.value } : l
  );
  return syncConstrainedWalls(next);
}

const TYPE_TO_INSTANCE: Record<string, string[]> = {
  thickness: ['wall', 'floor'],
  width: ['door', 'window'],
  height: ['door', 'window'],
};

/** Pushes every numeric Type parameter onto the instances that use it. */
function applyTypeToInstances(model: BimModel, type: ElementType): void {
  for (const el of model.elements) {
    if ((el as { typeId?: string }).typeId !== type.id) continue;
    for (const [param, value] of Object.entries(type.params)) {
      if (typeof value !== 'number') continue;
      if (TYPE_TO_INSTANCE[param]?.includes(el.type)) {
        (el as unknown as Record<string, unknown>)[param] = value;
      }
    }
  }
}

/** Editing a Type parameter changes every instance of that Type. */
export function setTypeParamOp(
  model: BimModel,
  typeId: string,
  param: string,
  raw: unknown
): OpResult {
  const type = model.types?.find((t) => t.id === typeId);
  if (!type) return fail('E_TYPE', `${typeId} kimlikli tip bulunamadı.`, 'typeParams');
  if (!(param in type.params)) {
    return fail('E_TYPE_PARAM', `${type.name} tipinde "${param}" parametresi yok.`, 'typeParams');
  }
  const next = cloneModelDeep(model);
  const nextType = next.types!.find((t) => t.id === typeId)!;
  if (typeof type.params[param] === 'number') {
    const parsed = parseStrictIntegerMm(raw, param, 1, 20000);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    nextType.params[param] = parsed.value;
  } else {
    const norm = normalizeTextField(raw, param);
    if (!norm.ok) return { ok: false, error: norm.error };
    nextType.params[param] = norm.value;
  }
  applyTypeToInstances(next, nextType);
  return { ok: true, model: next };
}

export function assignTypeOp(
  model: BimModel,
  elementId: string,
  typeId: string
): OpResult {
  const el = model.elements.find((e) => e.id === elementId);
  const type = model.types?.find((t) => t.id === typeId);
  if (!el) return fail('E_NOT_FOUND', `${elementId} kimlikli nesne bulunamadı.`);
  if (!type || type.category !== el.type) {
    return fail('E_TYPE', 'Bu nesne için uygun bir tip seçilmelidir.', 'typeId');
  }
  const next = cloneModelDeep(model);
  const target = next.elements.find((e) => e.id === elementId)!;
  (target as { typeId?: string }).typeId = typeId;
  applyTypeToInstances(next, next.types!.find((t) => t.id === typeId)!);
  return { ok: true, model: next };
}

/** Elements that must go with a wall when it is deleted. */
export function hostedIds(model: BimModel, wallId: string): string[] {
  return model.elements
    .filter((e) => (e.type === 'door' || e.type === 'window') && e.hostWallId === wallId)
    .map((e) => e.id);
}

// ---- generic field edits for the new element kinds --------------------------

const TOP_FIELDS = new Set(['topConstraint', 'topOffset', 'typeId', 'flip']);

/** Fields handled here instead of the original wall/door code path. */
export const isExtendedEdit = (el: BimElement, field: string): boolean =>
  (el.type !== 'wall' && el.type !== 'door') || TOP_FIELDS.has(field);


export function updateExtendedFieldOp(
  model: BimModel,
  elementId: string,
  field: string,
  raw: unknown
): OpResult {
  const next = cloneModelDeep(model);
  const el = next.elements.find((e) => e.id === elementId);
  if (!el) return fail('E_NOT_FOUND', `${elementId} kimlikli nesne bulunamadı.`);
  const rec = el as unknown as Record<string, unknown>;

  const bad = (message: string): OpResult => fail('E_INVALID_FIELD', message, field);
  const int = (min: number, max: number) => parseStrictIntegerMm(raw, field, min, max);
  const setInt = (min: number, max: number): OpResult | null => {
    const p = int(min, max);
    if (!p.ok) return { ok: false, error: p.error };
    rec[field] = p.value;
    return null;
  };

  const has = (key: string) => key in rec;
  let err: OpResult | null = null;

  switch (field) {
    case 'name': {
      const n = normalizeTextField(raw, 'name');
      if (!n.ok) return { ok: false, error: n.error };
      rec.name = n.value;
      break;
    }
    case 'number': {
      if (el.type !== 'room') return bad('Numara yalnızca odalar içindir.');
      if (typeof raw !== 'string' || raw.trim().length > 20) {
        return fail('E_TEXT_LENGTH', 'Oda numarası en fazla 20 karakter olabilir.', field);
      }
      rec.number = raw.trim().normalize('NFC');
      break;
    }
    case 'height':
    case 'width':
    case 'offset':
    case 'sill':
    case 'thickness': {
      if (!has(field)) return bad(`${field} bu nesne türünde bulunmuyor.`);
      const ranges: Record<string, [number, number]> = {
        height: [1, 20000],
        width: [1, 20000],
        offset: [0, 200000],
        sill: [0, 20000],
        thickness: [1, 2000],
      };
      err = setInt(...ranges[field]);
      if (err) return err;
      break;
    }
    case 'mark': {
      if (!has('mark')) return bad('İşaret (Mark) bu nesne türünde bulunmuyor.');
      const n = normalizeTextField(raw, 'mark');
      if (!n.ok) return { ok: false, error: n.error };
      rec.mark = n.value;
      break;
    }
    case 'hostWallId': {
      if (el.type !== 'window') return bad('Taşıyıcı duvar yalnızca kapı/pencere içindir.');
      if (typeof raw !== 'string') return bad('Geçerli bir taşıyıcı duvar seçilmelidir.');
      rec.hostWallId = raw;
      break;
    }
    case 'slope':
      if (el.type !== 'roof') return bad('Eğim yalnızca çatılar içindir.');
      err = setInt(0, 89);
      if (err) return err;
      break;
    case 'overhang':
      if (el.type !== 'roof') return bad('Çıkma yalnızca çatılar içindir.');
      err = setInt(0, 5000);
      if (err) return err;
      break;
    case 'riserHeight':
      if (el.type !== 'stair') return bad('Basamak yüksekliği yalnızca merdivenler içindir.');
      err = setInt(50, 400);
      if (err) return err;
      break;
    case 'treadDepth':
      if (el.type !== 'stair') return bad('Basamak derinliği yalnızca merdivenler içindir.');
      err = setInt(100, 600);
      if (err) return err;
      break;
    case 'risers':
      if (el.type !== 'stair') return bad('Basamak sayısı yalnızca merdivenler içindir.');
      err = setInt(1, 100);
      if (err) return err;
      break;
    case 'direction':
      if (el.type !== 'stair') return bad('Yön yalnızca merdivenler içindir.');
      if (!['x+', 'x-', 'z+', 'z-'].includes(String(raw))) return bad('Yön x+, x-, z+ veya z- olmalıdır.');
      rec.direction = raw;
      break;
    case 'levelId':
    case 'baseLevelId':
    case 'topLevelId': {
      if (typeof raw !== 'string' || !levelById(model, raw)) {
        return fail('E_INVALID_LEVEL', 'Geçerli bir kat seçilmelidir.', field);
      }
      if (!has(field)) return bad('Kat referansı bu nesne türünde bulunmuyor.');
      rec[field] = raw;
      break;
    }
    case 'topConstraint': {
      if (el.type !== 'wall') return bad('Top Constraint yalnızca duvarlar içindir.');
      if (raw === null || raw === '' || raw === 'unconnected') {
        rec.topConstraint = null;
      } else if (typeof raw === 'string' && levelById(model, raw)) {
        rec.topConstraint = raw;
        if (rec.topOffset === undefined) rec.topOffset = 0;
      } else {
        return fail('E_INVALID_LEVEL', 'Geçerli bir kat seçilmelidir.', field);
      }
      const synced = syncConstrainedWalls(next);
      if (!synced.ok) return synced;
      return synced;
    }
    case 'topOffset': {
      if (el.type !== 'wall') return bad('Top Offset yalnızca duvarlar içindir.');
      err = setInt(-20000, 20000);
      if (err) return err;
      const synced = syncConstrainedWalls(next);
      return synced;
    }
    case 'flip': {
      if (el.type !== 'door') return bad('Yön çevirme yalnızca kapılar içindir.');
      rec.flip = raw === undefined ? !rec.flip : Boolean(raw);
      break;
    }
    case 'typeId': {
      if (typeof raw !== 'string') return bad('Geçerli bir tip seçilmelidir.');
      return assignTypeOp(model, elementId, raw);
    }
    case 'seedPoint': {
      if (el.type !== 'room' || !Array.isArray(raw) || raw.length !== 2) {
        return bad('Oda noktası [X, Z] olmalıdır.');
      }
      const x = parseStrictIntegerMm(raw[0], 'startX', -100000, 100000);
      const z = parseStrictIntegerMm(raw[1], 'startZ', -100000, 100000);
      if (!x.ok) return { ok: false, error: x.error };
      if (!z.ok) return { ok: false, error: z.error };
      rec.seedPoint = [x.value, z.value];
      break;
    }
    case 'start':
    case 'end': {
      if (!(has('start') && has('end'))) return bad('Koordinat bu nesne türünde bulunmuyor.');
      if (!Array.isArray(raw) || raw.length !== 2) return bad('Koordinat [X, Z] olmalıdır.');
      const x = parseStrictIntegerMm(raw[0], `${field}X`, -100000, 100000);
      const z = parseStrictIntegerMm(raw[1], `${field}Z`, -100000, 100000);
      if (!x.ok) return { ok: false, error: x.error };
      if (!z.ok) return { ok: false, error: z.error };
      rec[field] = [x.value, z.value];
      break;
    }
    default:
      return bad(`${field} alanı bu nesne türünde düzenlenemez.`);
  }
  return { ok: true, model: next };
}


/** Adds a Level 3000 mm above the highest one (Project Browser → Levels). */
export function addLevelOp(model: BimModel): OpResult {
  if (model.levels.length >= 16) {
    return fail('E_MAX_LEVELS', 'Bir modelde en fazla 16 kat olabilir.');
  }
  const used = new Set(model.levels.map((l) => l.id));
  let n = model.levels.length;
  while (used.has(`l${n}`)) n++;
  const top = Math.max(...model.levels.map((l) => l.elevation));
  const next = cloneModelDeep(model);
  next.levels.push({ id: `l${n}`, name: `Kat ${n}`, elevation: top + 3000 });
  return { ok: true, model: next, createdId: `l${n}` };
}
