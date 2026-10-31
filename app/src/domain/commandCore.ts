/**
 * Shared plumbing for every model command: the session shape, the result
 * type and the single place where a new model is checked and committed.
 */
import { type CommandError } from './validation';
import { modelErrors, permissionErrors } from './evaluator';
import {
  cloneModelDeep,
  type OpResult,
} from './modelOps';
import type {
  BimModel,
  MissionTask,
  SubmittedEvaluation,
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

export type CommandResult =
  | { ok: true; state: MissionSessionState; createdId?: string }
  | { ok: false; state: MissionSessionState; error: CommandError };

export function cloneModel(model: BimModel): BimModel {
  return cloneModelDeep(model);
}

export function translateIntegrityCode(code: string): string {
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

export function commitModelTransaction(
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

// ---- Faz 1: yeni nesne türleri ve ilişkiler ---------------------------------

export const noPermission = (
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

export function commitCreate(state: MissionSessionState, op: OpResult): CommandResult {
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(
    state,
    op.model,
    op.createdId ? { selectedId: op.createdId } : undefined,
    op.createdId
  );
}
