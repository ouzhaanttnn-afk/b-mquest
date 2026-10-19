import { modelErrors, permissionErrors, wallLength } from './evaluator';
import type {
  BimElement,
  BimModel,
  DoorElement,
  EditableField,
  FireRating,
  MissionTask,
  SubmittedEvaluation,
  WallElement,
} from './types';

export interface CommandError {
  code: string;
  field?: string;
  message: string;
}

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
  return {
    levels: model.levels.map((l) => ({ ...l })),
    elements: model.elements.map((e) =>
      e.type === 'wall'
        ? { ...e, start: [e.start[0], e.start[1]], end: [e.end[0], e.end[1]] }
        : { ...e }
    ),
  };
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

const FIELD_LABELS_TR: Record<string, string> = {
  height: 'Yükseklik',
  thickness: 'Kalınlık',
  width: 'Genişlik',
  offset: 'Başlangıç Ofseti',
  sill: 'Eşik Yüksekliği',
  startX: 'Başlangıç X',
  startZ: 'Başlangıç Z',
  endX: 'Bitiş X',
  endZ: 'Bitiş Z',
  start: 'Başlangıç Koordinatı',
  end: 'Bitiş Koordinatı',
  name: 'Ad',
  mark: 'Kapı İşareti (Mark)',
  fireRating: 'Yangın Sınıfı',
  baseLevelId: 'Kat Referansı',
  hostWallId: 'Taşıyıcı Duvar',
};

export function parseStrictIntegerMm(
  raw: unknown,
  fieldKey: string,
  min: number,
  max: number
): { ok: true; value: number } | { ok: false; error: CommandError } {
  const label = FIELD_LABELS_TR[fieldKey] ?? fieldKey;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
      return {
        ok: false,
        error: {
          code: 'E_INVALID_INTEGER',
          field: fieldKey,
          message: `${label} alanı tam sayı (mm) olmalıdır.`,
        },
      };
    }
    if (raw < min || raw > max) {
      return {
        ok: false,
        error: {
          code: 'E_OUT_OF_RANGE',
          field: fieldKey,
          message: `${label} alanı ${min} ile ${max} mm arasında olmalıdır.`,
        },
      };
    }
    return { ok: true, value: raw };
  }

  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_INTEGER',
        field: fieldKey,
        message: `${label} alanı geçerli bir tam sayı (mm) olmalıdır.`,
      },
    };
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: {
        code: 'E_EMPTY_FIELD',
        field: fieldKey,
        message: `${label} alanı boş bırakılamaz.`,
      },
    };
  }

  if (
    trimmed.includes(',') ||
    trimmed.includes('.') ||
    trimmed.toLowerCase().includes('e') ||
    !/^-?\d+$/.test(trimmed)
  ) {
    return {
      ok: false,
      error: {
        code: 'E_NON_INTEGER',
        field: fieldKey,
        message: `${label} alanı ondalık veya bilimsel gösterim içeremez; tam sayı mm girin.`,
      },
    };
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_INTEGER',
        field: fieldKey,
        message: `${label} alanı geçerli sınırlar dışında.`,
      },
    };
  }

  if (parsed < min || parsed > max) {
    return {
      ok: false,
      error: {
        code: 'E_OUT_OF_RANGE',
        field: fieldKey,
        message: `${label} alanı ${min} ile ${max} mm arasında olmalıdır.`,
      },
    };
  }

  return { ok: true, value: parsed };
}

export function normalizeTextField(
  raw: unknown,
  fieldKey: string
): { ok: true; value: string } | { ok: false; error: CommandError } {
  const label = FIELD_LABELS_TR[fieldKey] ?? fieldKey;
  if (typeof raw !== 'string') {
    return {
      ok: false,
      error: {
        code: 'E_INVALID_TEXT',
        field: fieldKey,
        message: `${label} alanı metin olmalıdır.`,
      },
    };
  }
  const normalized = raw.trim().normalize('NFC');
  if (normalized.length < 1 || normalized.length > 80) {
    return {
      ok: false,
      error: {
        code: 'E_TEXT_LENGTH',
        field: fieldKey,
        message: `${label} alanı 1–80 karakter arasında olmalıdır.`,
      },
    };
  }
  return { ok: true, value: normalized };
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
  if (isSeed && !state.task.permissions.editableSeedIds.includes(elementId)) {
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

  if (!state.task.permissions.editableFields.includes(field)) {
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
  ) as BimElement;

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
  elementId: string
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
      (e): e is DoorElement => e.type === 'door' && e.hostWallId === elementId
    );
    if (dependentDoor) {
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
  nextModel.elements = nextModel.elements.filter((e) => e.id !== elementId);

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
