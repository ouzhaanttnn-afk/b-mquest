import { type CommandError, FIELD_LABELS_TR, normalizeTextField, parseStrictIntegerMm } from './validation';
export { type CommandError, normalizeTextField, parseStrictIntegerMm } from './validation';
import { modelErrors, permissionErrors, wallLength } from './evaluator';
import {
  addLevelOp,
  assignTypeOp,
  cloneModelDeep,
  createFloorOp,
  createGridOp,
  createRoofOp,
  createRoomOp,
  createStairOp,
  createWindowOp,
  hostedIds,
  isExtendedEdit,
  setLevelElevationOp,
  setTypeParamOp,
  updateExtendedFieldOp,
  type CreateFloorInput,
  type CreateGridInput,
  type CreateRoofInput,
  type CreateRoomInput,
  type CreateStairInput,
  type CreateWindowInput,
  type OpResult,
} from './modelOps';
import { elementTypeOf } from './derived';
import {
  createDimensionOp,
  createSheetOp,
  createTagOp,
  createViewOp,
  placeOnSheetOp,
  removeFromSheetOp,
  setCropOp,
  setCropRectOp,
  type CreateViewInput,
  type DocOp,
} from './documentation';
import type {
  BimModel,
  DoorElement,
  EditableField,
  FireRating,
  MissionTask,
  SubmittedEvaluation,
  WallElement,
} from './types';

export interface MissionSessionState {
  task: MissionTask;
  model: BimModel;
  revision: number;
  past: BimModel[];
  future: BimModel[];
  revealedHints: string[];
  selectedId: string | null;
  lastEvaluation: SubmittedEvaluation | null;
  nextWallCounter: number;
  nextDoorCounter: number;
}

export interface CreateWallInput {
  id?: string;
  name: string;
  baseLevelId: string;
  startX: string | number;
  startZ: string | number;
  endX: string | number;
  endZ: string | number;
  height: string | number;
  thickness: string | number;
}

export interface CreateDoorInput {
  id?: string;
  name: string;
  hostWallId: string;
  offset: string | number;
  width: string | number;
  height: string | number;
  sill: string | number;
  mark: string;
  fireRating: string;
}

export type CommandResult =
  | { ok: true; state: MissionSessionState; createdId?: string }
  | { ok: false; state: MissionSessionState; error: CommandError };

export function cloneModel(model: BimModel): BimModel {
  return cloneModelDeep(model);
}

export function createInitialSession(
  task: MissionTask,
  draft?: { model: BimModel; revealedHints: string[] }
): MissionSessionState {
  const baseModel = draft ? cloneModel(draft.model) : cloneModel(task.initialModel);
  const existingIds = new Set(baseModel.elements.map((e) => e.id));
  let wallCounter = 1;
  while (existingIds.has(`w${wallCounter}`)) wallCounter++;
  let doorCounter = 1;
  while (existingIds.has(`d${doorCounter}`)) doorCounter++;

  return {
    task,
    model: baseModel,
    revision: 0,
    past: [],
    future: [],
    revealedHints: draft ? [...new Set(draft.revealedHints)] : [],
    selectedId: null,
    lastEvaluation: null,
    nextWallCounter: wallCounter,
    nextDoorCounter: doorCounter,
  };
}


function translateIntegrityCode(code: string): string {
  if (code.startsWith('E_WALL_AXIS:')) {
    return 'Duvar başlangıç ve bitiş noktaları aynı olamaz ve yalnızca X veya Z eksenine paralel (dik açılı) olmalıdır.';
  }
  if (code.startsWith('E_OPENING_BOUNDS:')) {
    return 'Kapı açıklığı taşıyıcı duvarın uzunluğunu veya yüksekliğini aşıyor (ofset + genişlik ≤ duvar uzunluğu ve eşik + yükseklik ≤ duvar yüksekliği olmalı).';
  }
  if (code.startsWith('E_OPENING_OVERLAP:')) {
    return 'Aynı duvar üzerindeki iki kapı açıklığı birbiriyle çakışamaz.';
  }
  if (code.startsWith('E_HOST:')) {
    return 'Seçilen taşıyıcı duvar modelde bulunamadı.';
  }
  if (code.startsWith('E_LEVEL:')) {
    return 'Seçilen kat referansı modelde bulunamadı.';
  }
  if (code === 'E_DUPLICATE_ID') {
    return 'Aynı kimliğe (ID) sahip başka bir nesne zaten mevcut.';
  }
  if (code.startsWith('E_SEED_FIELD:') || code.startsWith('E_SEED_MISSING:')) {
    return 'Bu görevde başlangıç nesnesinin bu özelliğini değiştirme izniniz yok.';
  }
  if (code.startsWith('E_CREATE_TYPE:')) {
    return 'Bu görevde bu türde yeni nesne oluşturma izniniz yok.';
  }
  if (code.startsWith('E_TYPE:')) {
    return 'Nesnenin tipi modelde bulunamadı ya da kategorisi uyuşmuyor.';
  }
  if (code === 'E_TYPES_IMMUTABLE') {
    return 'Bu görevde Type parametrelerini değiştirme izniniz yok.';
  }
  if (code.startsWith('E_STAIR_LEVELS:')) {
    return 'Merdivenin üst katı alt katından yüksek olmalıdır.';
  }
  if (code === 'E_LEVELS_IMMUTABLE') {
    return 'Bu görevde kat kotlarını değiştirme izniniz yok.';
  }
  return `Model bütünlük hatası (${code}).`;
}

function commitModelTransaction(
  state: MissionSessionState,
  nextModel: BimModel,
  extra?: Partial<MissionSessionState>,
  createdId?: string
): CommandResult {
  const mErrors = modelErrors(nextModel);
  if (mErrors.length > 0) {
    return {
      ok: false,
      state,
      error: {
        code: mErrors[0],
        message: translateIntegrityCode(mErrors[0]),
      },
    };
  }

  const pErrors = permissionErrors(state.task, nextModel);
  if (pErrors.length > 0) {
    return {
      ok: false,
      state,
      error: {
        code: pErrors[0],
        message: translateIntegrityCode(pErrors[0]),
      },
    };
  }

  const nextRevision = state.revision + 1;
  const nextEvaluation: SubmittedEvaluation | null = state.lastEvaluation
    ? { ...state.lastEvaluation, stale: true }
    : null;

  return {
    ok: true,
    createdId,
    state: {
      ...state,
      ...extra,
      model: nextModel,
      revision: nextRevision,
      past: [...state.past, cloneModel(state.model)],
      future: [],
      lastEvaluation: nextEvaluation,
    },
  };
}

export function updateElementProperty(
  state: MissionSessionState,
  elementId: string,
  field: EditableField,
  rawValue: unknown
): CommandResult {
  const targetIndex = state.model.elements.findIndex((e) => e.id === elementId);
  if (targetIndex === -1) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_NOT_FOUND',
        message: `${elementId} kimlikli nesne bulunamadı.`,
      },
    };
  }

  const isSeed = state.task.initialModel.elements.some((e) => e.id === elementId);
  if (
    field !== 'flip' &&
    isSeed &&
    !state.task.permissions.editableSeedIds.includes(elementId)
  ) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_SEED',
        field,
        message: `${elementId} başlangıç nesnesi bu görevde kilitlidir; düzenlenemez.`,
      },
    };
  }

  if (field !== 'flip' && !state.task.permissions.editableFields.includes(field)) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_FIELD',
        field,
        message: `${FIELD_LABELS_TR[field] ?? field} alanı bu görevde düzenlenemez.`,
      },
    };
  }

  const current = state.model.elements[targetIndex];
  const updatedElement = (
    current.type === 'wall'
      ? {
          ...current,
          start: [current.start[0], current.start[1]] as [number, number],
          end: [current.end[0], current.end[1]] as [number, number],
        }
      : { ...current }
  ) as WallElement | DoorElement;

  if (current.type === 'wall' || current.type === 'door') {
    const type = elementTypeOf(state.model, current);
    if (
      type &&
      field in type.params &&
      ['thickness', 'width', 'height'].includes(field)
    ) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_TYPE_PARAMETER',
          field,
          message: `${FIELD_LABELS_TR[field] ?? field}, "${type.name}" tipinin parametresidir; nesne (Instance) üzerinden değil Edit Type ile değiştirilir.`,
        },
      };
    }
    if (current.type === 'wall' && current.topConstraint && field === 'height') {
      return {
        ok: false,
        state,
        error: {
          code: 'E_CONSTRAINED_HEIGHT',
          field,
          message:
            'Duvarın üstü bir kata bağlı (Top Constraint); yüksekliği Top Offset ile ayarla.',
        },
      };
    }
  }

  if (isExtendedEdit(current, field)) {
    const op = updateExtendedFieldOp(state.model, elementId, field, rawValue);
    if (!op.ok) return { ok: false, state, error: op.error };
    if (JSON.stringify(op.model) === JSON.stringify(state.model)) {
      return { ok: true, state };
    }
    return commitModelTransaction(state, op.model);
  }

  if (field === 'height') {
    const parsed = parseStrictIntegerMm(rawValue, 'height', 1, 20000);
    if (!parsed.ok) return { ok: false, state, error: parsed.error };
    updatedElement.height = parsed.value;
  } else if (field === 'thickness') {
    if (updatedElement.type !== 'wall') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Kalınlık yalnızca duvarlar içindir.' },
      };
    }
    const parsed = parseStrictIntegerMm(rawValue, 'thickness', 1, 2000);
    if (!parsed.ok) return { ok: false, state, error: parsed.error };
    updatedElement.thickness = parsed.value;
  } else if (field === 'width') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Genişlik yalnızca kapılar içindir.' },
      };
    }
    const parsed = parseStrictIntegerMm(rawValue, 'width', 1, 20000);
    if (!parsed.ok) return { ok: false, state, error: parsed.error };
    updatedElement.width = parsed.value;
  } else if (field === 'offset') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Ofset yalnızca kapılar içindir.' },
      };
    }
    const parsed = parseStrictIntegerMm(rawValue, 'offset', 0, 200000);
    if (!parsed.ok) return { ok: false, state, error: parsed.error };
    updatedElement.offset = parsed.value;
  } else if (field === 'sill') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Eşik yalnızca kapılar içindir.' },
      };
    }
    const parsed = parseStrictIntegerMm(rawValue, 'sill', 0, 20000);
    if (!parsed.ok) return { ok: false, state, error: parsed.error };
    updatedElement.sill = parsed.value;
  } else if (field === 'start' || field === 'end') {
    if (updatedElement.type !== 'wall') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Koordinat yalnızca duvarlar içindir.' },
      };
    }
    if (!Array.isArray(rawValue) || rawValue.length !== 2) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_INVALID_COORD',
          field,
          message: 'Koordinat [X, Z] çifti olarak girilmelidir.',
        },
      };
    }
    const px = parseStrictIntegerMm(rawValue[0], `${field}X`, -100000, 100000);
    if (!px.ok) return { ok: false, state, error: px.error };
    const pz = parseStrictIntegerMm(rawValue[1], `${field}Z`, -100000, 100000);
    if (!pz.ok) return { ok: false, state, error: pz.error };
    updatedElement[field] = [px.value, pz.value];
  } else if (field === 'name') {
    const norm = normalizeTextField(rawValue, 'name');
    if (!norm.ok) return { ok: false, state, error: norm.error };
    updatedElement.name = norm.value;
  } else if (field === 'mark') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'İşaret (Mark) yalnızca kapılar içindir.' },
      };
    }
    const norm = normalizeTextField(rawValue, 'mark');
    if (!norm.ok) return { ok: false, state, error: norm.error };
    updatedElement.mark = norm.value;
  } else if (field === 'fireRating') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Yangın sınıfı yalnızca kapılar içindir.' },
      };
    }
    if (rawValue !== 'none' && rawValue !== 'EI30' && rawValue !== 'EI60') {
      return {
        ok: false,
        state,
        error: {
          code: 'E_INVALID_ENUM',
          field,
          message: 'Yangın sınıfı yalnızca none, EI30 veya EI60 olabilir.',
        },
      };
    }
    updatedElement.fireRating = rawValue as FireRating;
  } else if (field === 'baseLevelId') {
    if (updatedElement.type !== 'wall') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Kat referansı yalnızca duvarlar içindir.' },
      };
    }
    if (
      typeof rawValue !== 'string' ||
      !state.model.levels.some((l) => l.id === rawValue)
    ) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_INVALID_LEVEL',
          field,
          message: 'Geçerli bir kat seçilmelidir.',
        },
      };
    }
    updatedElement.baseLevelId = rawValue;
  } else if (field === 'hostWallId') {
    if (updatedElement.type !== 'door') {
      return {
        ok: false,
        state,
        error: { code: 'E_INVALID_FIELD', field, message: 'Taşıyıcı duvar yalnızca kapılar içindir.' },
      };
    }
    if (typeof rawValue !== 'string') {
      return {
        ok: false,
        state,
        error: {
          code: 'E_INVALID_HOST',
          field,
          message: 'Geçerli bir taşıyıcı duvar seçilmelidir.',
        },
      };
    }
    updatedElement.hostWallId = rawValue;
  }

  // If value didn't change at all, do not add a duplicate undo entry
  if (JSON.stringify(current) === JSON.stringify(updatedElement)) {
    return { ok: true, state };
  }

  const nextModel = cloneModel(state.model);
  nextModel.elements[targetIndex] = updatedElement;

  return commitModelTransaction(state, nextModel);
}

export function createWallCommand(
  state: MissionSessionState,
  input: CreateWallInput
): CommandResult {
  if (!state.task.permissions.creatableTypes.includes('wall')) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_CREATE_WALL',
        message: 'Bu görevde yeni duvar oluşturma izniniz yok.',
      },
    };
  }

  if (state.model.elements.length >= 500) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_MAX_ELEMENTS',
        message: 'Model en fazla 500 nesne içerebilir.',
      },
    };
  }

  const sx = parseStrictIntegerMm(input.startX, 'startX', -100000, 100000);
  if (!sx.ok) return { ok: false, state, error: sx.error };
  const sz = parseStrictIntegerMm(input.startZ, 'startZ', -100000, 100000);
  if (!sz.ok) return { ok: false, state, error: sz.error };
  const ex = parseStrictIntegerMm(input.endX, 'endX', -100000, 100000);
  if (!ex.ok) return { ok: false, state, error: ex.error };
  const ez = parseStrictIntegerMm(input.endZ, 'endZ', -100000, 100000);
  if (!ez.ok) return { ok: false, state, error: ez.error };
  const h = parseStrictIntegerMm(input.height, 'height', 1, 20000);
  if (!h.ok) return { ok: false, state, error: h.error };
  const t = parseStrictIntegerMm(input.thickness, 'thickness', 1, 2000);
  if (!t.ok) return { ok: false, state, error: t.error };
  const nameRes = normalizeTextField(input.name, 'name');
  if (!nameRes.ok) return { ok: false, state, error: nameRes.error };

  const existingIds = new Set(state.model.elements.map((e) => e.id));
  let counter = state.nextWallCounter;
  let assignedId = input.id?.trim();
  if (assignedId) {
    if (existingIds.has(assignedId)) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_DUPLICATE_ID',
          message: `${assignedId} kimliği zaten kullanımda.`,
        },
      };
    }
  } else {
    while (existingIds.has(`w${counter}`)) {
      counter++;
    }
    assignedId = `w${counter}`;
    counter++;
  }

  const newWall: WallElement = {
    id: assignedId,
    type: 'wall',
    name: nameRes.value,
    baseLevelId: input.baseLevelId,
    start: [sx.value, sz.value],
    end: [ex.value, ez.value],
    height: h.value,
    thickness: t.value,
  };

  const nextModel = cloneModel(state.model);
  nextModel.elements.push(newWall);

  return commitModelTransaction(
    state,
    nextModel,
    {
      nextWallCounter: counter,
      selectedId: assignedId,
    },
    assignedId
  );
}

export function createDoorCommand(
  state: MissionSessionState,
  input: CreateDoorInput
): CommandResult {
  if (!state.task.permissions.creatableTypes.includes('door')) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_CREATE_DOOR',
        message: 'Bu görevde yeni kapı oluşturma izniniz yok.',
      },
    };
  }

  if (state.model.elements.length >= 500) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_MAX_ELEMENTS',
        message: 'Model en fazla 500 nesne içerebilir.',
      },
    };
  }

  const hostWall = state.model.elements.find(
    (e): e is WallElement => e.id === input.hostWallId && e.type === 'wall'
  );
  if (!hostWall) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_HOST_MISSING',
        field: 'hostWallId',
        message: 'Kapı için geçerli bir taşıyıcı duvar seçilmelidir.',
      },
    };
  }

  const offsetRes = parseStrictIntegerMm(input.offset, 'offset', 0, 200000);
  if (!offsetRes.ok) return { ok: false, state, error: offsetRes.error };
  const widthRes = parseStrictIntegerMm(input.width, 'width', 1, 20000);
  if (!widthRes.ok) return { ok: false, state, error: widthRes.error };
  const heightRes = parseStrictIntegerMm(input.height, 'height', 1, 20000);
  if (!heightRes.ok) return { ok: false, state, error: heightRes.error };
  const sillRes = parseStrictIntegerMm(input.sill, 'sill', 0, 20000);
  if (!sillRes.ok) return { ok: false, state, error: sillRes.error };
  const nameRes = normalizeTextField(input.name, 'name');
  if (!nameRes.ok) return { ok: false, state, error: nameRes.error };
  const markRes = normalizeTextField(input.mark, 'mark');
  if (!markRes.ok) return { ok: false, state, error: markRes.error };

  if (
    input.fireRating !== 'none' &&
    input.fireRating !== 'EI30' &&
    input.fireRating !== 'EI60'
  ) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_INVALID_FIRE_RATING',
        field: 'fireRating',
        message: 'Yangın sınıfı yalnızca none, EI30 veya EI60 olabilir.',
      },
    };
  }

  const hostLen = wallLength(hostWall);
  if (offsetRes.value + widthRes.value > hostLen) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_OPENING_BOUNDS',
        field: 'offset',
        message: `Kapı genişliği ve ofset toplamı (${offsetRes.value + widthRes.value} mm), taşıyıcı duvar uzunluğunu (${hostLen} mm) aşıyor.`,
      },
    };
  }

  if (sillRes.value + heightRes.value > hostWall.height) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_OPENING_BOUNDS',
        field: 'height',
        message: `Kapı eşik ve yükseklik toplamı (${sillRes.value + heightRes.value} mm), taşıyıcı duvar yüksekliğini (${hostWall.height} mm) aşıyor.`,
      },
    };
  }

  const existingIds = new Set(state.model.elements.map((e) => e.id));
  let counter = state.nextDoorCounter;
  let assignedId = input.id?.trim();

  if (assignedId) {
    if (existingIds.has(assignedId)) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_DUPLICATE_ID',
          message: `${assignedId} kimlikli kapı zaten mevcut.`,
        },
      };
    }
  } else if (state.task.id === 'm03' && !existingIds.has('d1')) {
    // Mission 3 reserves d1 (reuse after deleting draft door is allowed only if no live d1 exists)
    assignedId = 'd1';
    if (counter <= 1) counter = 2;
  } else {
    while (existingIds.has(`d${counter}`)) {
      counter++;
    }
    assignedId = `d${counter}`;
    counter++;
  }

  const newDoor: DoorElement = {
    id: assignedId,
    type: 'door',
    name: nameRes.value,
    hostWallId: input.hostWallId,
    offset: offsetRes.value,
    width: widthRes.value,
    height: heightRes.value,
    sill: sillRes.value,
    mark: markRes.value,
    fireRating: input.fireRating as FireRating,
  };

  const nextModel = cloneModel(state.model);
  nextModel.elements.push(newDoor);

  return commitModelTransaction(
    state,
    nextModel,
    {
      nextDoorCounter: counter,
      selectedId: assignedId,
    },
    assignedId
  );
}

export function deleteElementCommand(
  state: MissionSessionState,
  elementId: string,
  opts?: { cascade?: boolean }
): CommandResult {
  const target = state.model.elements.find((e) => e.id === elementId);
  if (!target) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_NOT_FOUND',
        message: `${elementId} kimlikli nesne bulunamadı.`,
      },
    };
  }

  const isSeed = state.task.initialModel.elements.some((e) => e.id === elementId);
  if (isSeed) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_DELETE_SEED',
        message: 'Başlangıç modeline ait nesneler silinemez.',
      },
    };
  }

  if (!state.task.permissions.deletableCreated) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_DELETE_FORBIDDEN',
        message: 'Bu görevde nesne silme işlemi kapalıdır.',
      },
    };
  }

  if (target.type === 'wall') {
    const dependentDoor = state.model.elements.find(
      (e) =>
        (e.type === 'door' || e.type === 'window') &&
        e.hostWallId === elementId
    );
    if (dependentDoor && !opts?.cascade) {
      return {
        ok: false,
        state,
        error: {
          code: 'E_DELETE_HOST_WITH_DOOR',
          message: `Bu duvar üzerinde bağlı bir kapı (${dependentDoor.id}) bulunuyor. Önce bağlı kapıyı silmelisiniz.`,
        },
      };
    }
  }

  const nextModel = cloneModel(state.model);
  const removed = new Set([
    elementId,
    ...(opts?.cascade ? hostedIds(state.model, elementId) : []),
  ]);
  nextModel.elements = nextModel.elements.filter((e) => !removed.has(e.id));

  return commitModelTransaction(state, nextModel, {
    selectedId: state.selectedId === elementId ? null : state.selectedId,
  });
}

export function moveWallCommand(
  state: MissionSessionState,
  elementId: string,
  dxRaw: string | number,
  dzRaw: string | number
): CommandResult {
  const targetIndex = state.model.elements.findIndex((e) => e.id === elementId);
  if (targetIndex === -1) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_NOT_FOUND',
        message: `${elementId} kimlikli duvar bulunamadı.`,
      },
    };
  }

  const target = state.model.elements[targetIndex];
  if (target.type !== 'wall') {
    return {
      ok: false,
      state,
      error: {
        code: 'E_INVALID_TYPE',
        message: 'Taşıma işlemi yalnızca duvar nesneleri için kullanılabilir; kapılar taşıyıcı duvar üzerindeki Ofset (mm) değeriyle kaydırılır.',
      },
    };
  }

  const isSeed = state.task.initialModel.elements.some((e) => e.id === elementId);
  if (isSeed && !state.task.permissions.editableSeedIds.includes(elementId)) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_SEED',
        message: `${elementId} başlangıç duvarı bu görevde sabitlenmiştir; taşınamaz.`,
      },
    };
  }

  if (
    !state.task.permissions.editableFields.includes('start') ||
    !state.task.permissions.editableFields.includes('end')
  ) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_MOVE',
        message: 'Bu görevde duvar koordinatlarını taşıma izniniz yok.',
      },
    };
  }

  const dxParsed = parseStrictIntegerMm(dxRaw, 'startX', -100000, 100000);
  if (!dxParsed.ok) return { ok: false, state, error: dxParsed.error };
  const dzParsed = parseStrictIntegerMm(dzRaw, 'startZ', -100000, 100000);
  if (!dzParsed.ok) return { ok: false, state, error: dzParsed.error };

  if (dxParsed.value === 0 && dzParsed.value === 0) {
    return { ok: true, state };
  }

  const nextStartX = target.start[0] + dxParsed.value;
  const nextStartZ = target.start[1] + dzParsed.value;
  const nextEndX = target.end[0] + dxParsed.value;
  const nextEndZ = target.end[1] + dzParsed.value;

  for (const [val, key] of [
    [nextStartX, 'startX'],
    [nextStartZ, 'startZ'],
    [nextEndX, 'endX'],
    [nextEndZ, 'endZ'],
  ] as const) {
    const check = parseStrictIntegerMm(val, key, -100000, 100000);
    if (!check.ok) return { ok: false, state, error: check.error };
  }

  const nextModel = cloneModel(state.model);
  nextModel.elements[targetIndex] = {
    ...target,
    start: [nextStartX, nextStartZ],
    end: [nextEndX, nextEndZ],
  };

  return commitModelTransaction(state, nextModel);
}


export function undoCommand(state: MissionSessionState): MissionSessionState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const nextPast = state.past.slice(0, -1);
  const nextFuture = [cloneModel(state.model), ...state.future];
  const stillExists =
    state.selectedId && previous.elements.some((e) => e.id === state.selectedId);

  return {
    ...state,
    model: cloneModel(previous),
    revision: state.revision + 1,
    past: nextPast,
    future: nextFuture,
    selectedId: stillExists ? state.selectedId : null,
    lastEvaluation: state.lastEvaluation
      ? { ...state.lastEvaluation, stale: true }
      : null,
  };
}

export function redoCommand(state: MissionSessionState): MissionSessionState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const nextFuture = state.future.slice(1);
  const nextPast = [...state.past, cloneModel(state.model)];
  const stillExists =
    state.selectedId && next.elements.some((e) => e.id === state.selectedId);

  return {
    ...state,
    model: cloneModel(next),
    revision: state.revision + 1,
    past: nextPast,
    future: nextFuture,
    selectedId: stillExists ? state.selectedId : null,
    lastEvaluation: state.lastEvaluation
      ? { ...state.lastEvaluation, stale: true }
      : null,
  };
}

export function revealNextHintCommand(
  state: MissionSessionState,
  hintId?: string
): MissionSessionState {
  const targetId =
    hintId ??
    state.task.hints.find((h) => !state.revealedHints.includes(h.id))?.id;
  if (!targetId) return state;

  const isKnown = state.task.hints.some((h) => h.id === targetId);
  if (!isKnown) return state;

  if (state.revealedHints.includes(targetId)) {
    return state;
  }

  // Enforce sequential reveal order
  const targetIdx = state.task.hints.findIndex((h) => h.id === targetId);
  for (let i = 0; i < targetIdx; i++) {
    if (!state.revealedHints.includes(state.task.hints[i].id)) {
      return state;
    }
  }

  return {
    ...state,
    revealedHints: [...state.revealedHints, targetId],
  };
}

export function resetMissionSession(
  state: MissionSessionState
): MissionSessionState {
  return createInitialSession(state.task);
}

// ---- Faz 1: yeni nesne türleri ve ilişkiler ---------------------------------

const noPermission = (
  state: MissionSessionState,
  type: string,
  label: string
): CommandResult | null =>
  state.task.permissions.creatableTypes.includes(type as never)
    ? null
    : {
        ok: false,
        state,
        error: {
          code: `E_PERMISSION_CREATE_${type.toUpperCase()}`,
          message: `Bu görevde yeni ${label} oluşturma izniniz yok.`,
        },
      };

function commitCreate(state: MissionSessionState, op: OpResult): CommandResult {
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(
    state,
    op.model,
    op.createdId ? { selectedId: op.createdId } : undefined,
    op.createdId
  );
}

export function createWindowCommand(
  state: MissionSessionState,
  input: CreateWindowInput
): CommandResult {
  return (
    noPermission(state, 'window', 'pencere') ??
    commitCreate(state, createWindowOp(state.model, input))
  );
}

export function createFloorCommand(
  state: MissionSessionState,
  input: CreateFloorInput
): CommandResult {
  return (
    noPermission(state, 'floor', 'döşeme') ??
    commitCreate(state, createFloorOp(state.model, input))
  );
}

export function createRoomCommand(
  state: MissionSessionState,
  input: CreateRoomInput
): CommandResult {
  return (
    noPermission(state, 'room', 'oda') ??
    commitCreate(state, createRoomOp(state.model, input))
  );
}

export function createGridCommand(
  state: MissionSessionState,
  input: CreateGridInput
): CommandResult {
  return (
    noPermission(state, 'grid', 'aks') ??
    commitCreate(state, createGridOp(state.model, input))
  );
}

export function createRoofCommand(
  state: MissionSessionState,
  input: CreateRoofInput
): CommandResult {
  return (
    noPermission(state, 'roof', 'çatı') ??
    commitCreate(state, createRoofOp(state.model, input))
  );
}

export function createStairCommand(
  state: MissionSessionState,
  input: CreateStairInput
): CommandResult {
  return (
    noPermission(state, 'stair', 'merdiven') ??
    commitCreate(state, createStairOp(state.model, input))
  );
}

/** Level elevation edit; constrained walls follow automatically. */
export function setLevelElevationCommand(
  state: MissionSessionState,
  levelId: string,
  rawElevation: unknown
): CommandResult {
  if (!state.task.permissions.editableFields.includes('elevation')) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_FIELD',
        field: 'elevation',
        message: 'Bu görevde kat kotunu değiştirme izniniz yok.',
      },
    };
  }
  const op = setLevelElevationOp(state.model, levelId, rawElevation);
  if (!op.ok) return { ok: false, state, error: op.error };
  if (JSON.stringify(op.model) === JSON.stringify(state.model)) {
    return { ok: true, state };
  }
  return commitModelTransaction(state, op.model);
}

/** Edit Type: one change, every instance of the Type follows. */
export function updateTypeParamCommand(
  state: MissionSessionState,
  typeId: string,
  param: string,
  rawValue: unknown
): CommandResult {
  if (!state.task.permissions.editableFields.includes('typeParams')) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_FIELD',
        field: 'typeParams',
        message: 'Bu görevde Type parametrelerini değiştirme izniniz yok.',
      },
    };
  }
  const op = setTypeParamOp(state.model, typeId, param, rawValue);
  if (!op.ok) return { ok: false, state, error: op.error };
  if (JSON.stringify(op.model) === JSON.stringify(state.model)) {
    return { ok: true, state };
  }
  return commitModelTransaction(state, op.model);
}

export { assignTypeOp };

/** Adds a new Level (needs the elevation permission). */
export function addLevelCommand(state: MissionSessionState): CommandResult {
  if (!state.task.permissions.editableFields.includes('elevation')) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_FIELD',
        field: 'elevation',
        message: 'Bu görevde yeni kat ekleme izniniz yok.',
      },
    };
  }
  const op = addLevelOp(state.model);
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(state, op.model);
}

// ---- Faz 4: görünümler ve dokümantasyon -------------------------------------

function commitDoc(state: MissionSessionState, op: DocOp): CommandResult {
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(
    state,
    op.model,
    op.createdId ? { selectedId: op.createdId } : undefined,
    op.createdId
  );
}

export function createViewCommand(state: MissionSessionState, input: CreateViewInput): CommandResult {
  return noPermission(state, 'view', 'görünüm') ?? commitDoc(state, createViewOp(state.model, input));
}

export function createDimensionCommand(
  state: MissionSessionState,
  wallA: string,
  wallB: string
): CommandResult {
  return noPermission(state, 'dimension', 'ölçü') ?? commitDoc(state, createDimensionOp(state.model, wallA, wallB));
}

export function createTagCommand(state: MissionSessionState, targetId: string): CommandResult {
  return noPermission(state, 'tag', 'etiket') ?? commitDoc(state, createTagOp(state.model, targetId));
}

export function createSheetCommand(
  state: MissionSessionState,
  input: { number?: string; name?: string } = {}
): CommandResult {
  return noPermission(state, 'sheet', 'pafta') ?? commitDoc(state, createSheetOp(state.model, input));
}

const needPlacements = (state: MissionSessionState): CommandResult | null =>
  state.task.permissions.editableFields.includes('placements')
    ? null
    : {
        ok: false,
        state,
        error: {
          code: 'E_PERMISSION_FIELD',
          field: 'placements',
          message: 'Bu görevde paftaya görünüm yerleştirme izniniz yok.',
        },
      };

export function placeOnSheetCommand(
  state: MissionSessionState,
  sheetId: string,
  viewId: string,
  x?: number,
  z?: number
): CommandResult {
  const blocked = needPlacements(state);
  if (blocked) return blocked;
  const op = placeOnSheetOp(state.model, sheetId, viewId, x, z);
  if (!op.ok) return { ok: false, state, error: op.error };
  if (JSON.stringify(op.model) === JSON.stringify(state.model)) return { ok: true, state };
  return commitModelTransaction(state, op.model);
}

export function removeFromSheetCommand(
  state: MissionSessionState,
  sheetId: string,
  viewId: string
): CommandResult {
  const blocked = needPlacements(state);
  if (blocked) return blocked;
  return commitDoc(state, removeFromSheetOp(state.model, sheetId, viewId));
}

export function setCropCommand(state: MissionSessionState, viewId: string, on: boolean): CommandResult {
  if (!state.task.permissions.editableFields.includes('cropMinX')) {
    return {
      ok: false,
      state,
      error: { code: 'E_PERMISSION_FIELD', field: 'cropMinX', message: 'Bu görevde kadraj düzenleme izniniz yok.' },
    };
  }
  return commitDoc(state, setCropOp(state.model, viewId, on));
}

export function setCropRectCommand(
  state: MissionSessionState,
  viewId: string,
  rect: { minX: number; maxX: number; minZ: number; maxZ: number }
): CommandResult {
  if (!state.task.permissions.editableFields.includes('cropMinX')) {
    return {
      ok: false,
      state,
      error: { code: 'E_PERMISSION_FIELD', field: 'cropMinX', message: 'Bu görevde kadraj düzenleme izniniz yok.' },
    };
  }
  return commitDoc(state, setCropRectOp(state.model, viewId, rect));
}
