import Ajv2020 from 'ajv/dist/2020.js';
import taskSchemaJson from '../schemas/task.schema.json';
import { modelErrors, permissionErrors } from './evaluator';
import type { BimModel, MissionTask, SaveEnvelopeV1 } from './types';

export const SAVE_STORAGE_KEY = 'bimquest.save.v1';
export const MAX_IMPORT_BYTES = 1024 * 1024; // 1 MiB UTF-8
export const MISSION_ID_PATTERN = '^m(0[1-9]|[1-4][0-9]|50)$';
const MISSION_ID_REGEX = /^m(0[1-9]|[1-4][0-9]|50)$/;

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(taskSchemaJson);

const saveEnvelopeSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['saveVersion', 'contentVersion', 'completed', 'drafts', 'settings'],
  properties: {
    saveVersion: { const: 1 },
    contentVersion: { const: '1.0.0' },
    completed: {
      type: 'object',
      propertyNames: { pattern: MISSION_ID_PATTERN },
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['bestScore'],
        properties: {
          bestScore: { type: 'integer', minimum: 0, maximum: 100 },
          model: { $ref: `${taskSchemaJson.$id}#/$defs/model` },
        },
      },
    },
    drafts: {
      type: 'object',
      propertyNames: { pattern: MISSION_ID_PATTERN },
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        required: ['model', 'revealedHints'],
        properties: {
          model: { $ref: `${taskSchemaJson.$id}#/$defs/model` },
          revealedHints: {
            type: 'array',
            items: { type: 'string', enum: ['h1', 'h2', 'h3'] },
            maxItems: 3,
            uniqueItems: true,
          },
        },
      },
    },
    settings: {
      type: 'object',
      additionalProperties: false,
      required: ['sound', 'reducedMotion'],
      properties: {
        sound: { type: 'boolean' },
        reducedMotion: { type: 'boolean' },
      },
    },
  },
};

const validateSaveEnvelope = ajv.compile(saveEnvelopeSchema);

export function createDefaultSaveEnvelope(): SaveEnvelopeV1 {
  return {
    saveVersion: 1,
    contentVersion: '1.0.0',
    completed: {},
    drafts: {},
    settings: {
      sound: false,
      reducedMotion: false,
    },
  };
}

export type SaveValidationResult =
  | { ok: true; save: SaveEnvelopeV1 }
  | {
      ok: false;
      reason:
        | 'E_OVERSIZE'
        | 'E_CORRUPT_JSON'
        | 'E_UNKNOWN_VERSION'
        | 'E_INVALID_ENVELOPE'
        | 'E_INVALID_DRAFT';
      message: string;
      rawText?: string;
    };

function hasForbiddenPrototypeKeys(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (
    Object.prototype.hasOwnProperty.call(obj, '__proto__') ||
    Object.prototype.hasOwnProperty.call(obj, 'constructor') ||
    Object.prototype.hasOwnProperty.call(obj, 'prototype')
  ) {
    return true;
  }
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (hasForbiddenPrototypeKeys(val)) return true;
  }
  return false;
}

export function parseAndValidateSaveJson(
  rawText: string,
  tasksById: Record<string, MissionTask>
): SaveValidationResult {
  const byteLength = new TextEncoder().encode(rawText).byteLength;
  if (byteLength > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      reason: 'E_OVERSIZE',
      message: 'Kayıt dosyası 1 MiB sınırını aşıyor ve güvenlik nedeniyle reddedildi.',
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      reason: 'E_CORRUPT_JSON',
      message: 'Kayıt verisi bozuk (geçersiz JSON). Ham veriyi dışa aktarabilir veya sıfırlayabilirsiniz.',
      rawText,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      reason: 'E_INVALID_ENVELOPE',
      message: 'Kayıt zarfı geçerli bir nesne değil.',
      rawText,
    };
  }

  if (rawText.includes('"__proto__"') || hasForbiddenPrototypeKeys(parsed)) {
    return {
      ok: false,
      reason: 'E_INVALID_ENVELOPE',
      message: 'Güvenlik sınırına takılan geçersiz alan adları tespit edildi.',
      rawText,
    };
  }

  const record = parsed as Record<string, unknown>;
  if (
    ('saveVersion' in record && record.saveVersion !== 1) ||
    ('contentVersion' in record && record.contentVersion !== '1.0.0')
  ) {
    return {
      ok: false,
      reason: 'E_UNKNOWN_VERSION',
      message:
        'Kayıt sürümü bu uygulama sürümüyle uyumsuz (taşınma/güncelleme gerekli). Mevcut dosyayı dışa aktarabilir veya geçici oturum başlatabilirsiniz.',
      rawText,
    };
  }

  if (!validateSaveEnvelope(parsed)) {
    return {
      ok: false,
      reason: 'E_INVALID_ENVELOPE',
      message: 'Kayıt şeması doğrulanamadı (geçersiz puan, ipucu veya ayar alanı).',
      rawText,
    };
  }

  const candidate = parsed as unknown as SaveEnvelopeV1;

  for (const [missionId, draft] of Object.entries(candidate.drafts)) {
    if (!MISSION_ID_REGEX.test(missionId)) {
      return {
        ok: false,
        reason: 'E_INVALID_DRAFT',
        message: `Bilinmeyen görev kimliği: ${missionId}`,
        rawText,
      };
    }
    const task = tasksById[missionId];
    if (!task) {
      return {
        ok: false,
        reason: 'E_INVALID_DRAFT',
        message: `Görev tanımı bulunamadı: ${missionId}`,
        rawText,
      };
    }
    const mErr = modelErrors(draft.model);
    if (mErr.length > 0) {
      return {
        ok: false,
        reason: 'E_INVALID_DRAFT',
        message: `${missionId} taslak modeli bütünlük kontrolünden geçemedi (${mErr[0]}).`,
        rawText,
      };
    }
    const pErr = permissionErrors(task, draft.model);
    if (pErr.length > 0) {
      return {
        ok: false,
        reason: 'E_INVALID_DRAFT',
        message: `${missionId} taslak modeli görev izinlerine uymuyor (${pErr[0]}).`,
        rawText,
      };
    }
    const validHintIds = new Set(task.hints.map((h) => h.id));
    if (draft.revealedHints.some((h) => !validHintIds.has(h))) {
      return {
        ok: false,
        reason: 'E_INVALID_DRAFT',
        message: `${missionId} taslağında geçersiz ipucu kimliği bulundu.`,
        rawText,
      };
    }
  }

  for (const [missionId, comp] of Object.entries(candidate.completed)) {
    if (comp.model) {
      const err = modelErrors(comp.model);
      if (err.length > 0) {
        return {
          ok: false,
          reason: 'E_INVALID_DRAFT',
          message: `${missionId} tamamlanma modeli bütünlük kontrolünden geçemedi (${err[0]}).`,
          rawText,
        };
      }
    }
  }

  // Deep clone through clean assignment to avoid prototype pollution
  const cleanSave: SaveEnvelopeV1 = {
    saveVersion: 1,
    contentVersion: '1.0.0',
    completed: {},
    drafts: {},
    settings: {
      sound: Boolean(candidate.settings.sound),
      reducedMotion: Boolean(candidate.settings.reducedMotion),
    },
  };

  for (const [mId, comp] of Object.entries(candidate.completed)) {
    if (MISSION_ID_REGEX.test(mId)) {
      cleanSave.completed[mId] = {
        bestScore: comp.bestScore,
        ...(comp.model ? { model: JSON.parse(JSON.stringify(comp.model)) as BimModel } : {}),
      };
    }
  }

  for (const [mId, dr] of Object.entries(candidate.drafts)) {
    if (MISSION_ID_REGEX.test(mId)) {
      cleanSave.drafts[mId] = {
        model: JSON.parse(JSON.stringify(dr.model)),
        revealedHints: [...dr.revealedHints],
      };
    }
  }

  return { ok: true, save: cleanSave };
}

/** Final-project stages whose finished model is handed to the next stage. */
export const MODEL_CARRYING_MISSIONS = new Set(['m44', 'm45', 'm46', 'm47', 'm48', 'm49']);

export function recordPassingScore(
  save: SaveEnvelopeV1,
  missionId: string,
  newPassingScore: number,
  finishedModel?: BimModel
): SaveEnvelopeV1 {
  const prev = save.completed[missionId];
  const bestScore = Math.max(prev?.bestScore ?? 0, Math.min(100, Math.max(0, newPassingScore)));
  const carry = MODEL_CARRYING_MISSIONS.has(missionId) ? finishedModel : undefined;
  const model = carry ?? prev?.model;
  return {
    ...save,
    completed: {
      ...save.completed,
      [missionId]: { bestScore, ...(model ? { model: JSON.parse(JSON.stringify(model)) as BimModel } : {}) },
    },
  };
}

/**
 * Final-project stages continue the same house: a stage that has no draft of
 * its own starts from the model the previous stage finished.
 */
export function carryOverDraft(
  task: MissionTask,
  save: SaveEnvelopeV1
): { model: BimModel; revealedHints: string[] } | undefined {
  const prev = task.prerequisites[0];
  if (!prev || !MODEL_CARRYING_MISSIONS.has(prev)) return undefined;
  const model = save.completed[prev]?.model;
  if (!model) return undefined;
  return { model: JSON.parse(JSON.stringify(model)) as BimModel, revealedHints: [] };
}

export function isMissionUnlocked(
  task: MissionTask,
  completed: Record<string, { bestScore: number }>
): { unlocked: boolean; missingPrerequisites: string[] } {
  const missing = task.prerequisites.filter((preId) => !(preId in completed));
  return {
    unlocked: missing.length === 0,
    missingPrerequisites: missing,
  };
}

export interface StorageLoadOutcome {
  save: SaveEnvelopeV1;
  storageWarning: string | null;
  recoveryIssue: {
    reason: string;
    message: string;
    rawText: string;
  } | null;
}

export function loadFromBrowserStorage(
  tasksById: Record<string, MissionTask>,
  storage?: Pick<Storage, 'getItem'> | null
): StorageLoadOutcome {
  let targetStorage = storage;
  if (targetStorage === undefined) {
    try {
      targetStorage = typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return {
        save: createDefaultSaveEnvelope(),
        storageWarning:
          'Tarayıcı yerel depolama (localStorage) erişimi engellendi. İlerlemeniz oturum boyunca bellekte tutulacak; JSON olarak dışa aktarabilirsiniz.',
        recoveryIssue: null,
      };
    }
  }

  if (!targetStorage) {
    return {
      save: createDefaultSaveEnvelope(),
      storageWarning:
        'Yerel depolama kullanılamıyor. Çalışmanız bellekte tutuluyor; JSON olarak dışa aktarabilirsiniz.',
      recoveryIssue: null,
    };
  }

  let raw: string | null = null;
  try {
    raw = targetStorage.getItem(SAVE_STORAGE_KEY);
  } catch {
    return {
      save: createDefaultSaveEnvelope(),
      storageWarning:
        'Yerel depolama okunamadı. Çalışmanız bellekte tutuluyor; JSON olarak dışa aktarabilirsiniz.',
      recoveryIssue: null,
    };
  }

  if (!raw) {
    return {
      save: createDefaultSaveEnvelope(),
      storageWarning: null,
      recoveryIssue: null,
    };
  }

  const validated = parseAndValidateSaveJson(raw, tasksById);
  if (!validated.ok) {
    // Never overwrite corrupt/unknown save before user recovery choice!
    return {
      save: createDefaultSaveEnvelope(),
      storageWarning: null,
      recoveryIssue: {
        reason: validated.reason,
        message: validated.message,
        rawText: validated.rawText ?? raw,
      },
    };
  }

  return {
    save: validated.save,
    storageWarning: null,
    recoveryIssue: null,
  };
}

export function writeToBrowserStorage(
  save: SaveEnvelopeV1,
  storage?: Pick<Storage, 'setItem'> | null
): { ok: true } | { ok: false; warning: string } {
  let targetStorage = storage;
  if (targetStorage === undefined) {
    try {
      targetStorage = typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return {
        ok: false,
        warning:
          'Yerel kayıt alanı (localStorage) kullanılamıyor. Değişiklikler bellekte korundu; kaybolmaması için Dışa Aktar butonunu kullanın.',
      };
    }
  }

  if (!targetStorage) {
    return {
      ok: false,
      warning:
        'Yerel kayıt alanı kullanılamıyor. Değişiklikler bellekte korundu; kaybolmaması için Dışa Aktar butonunu kullanın.',
    };
  }

  try {
    targetStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch {
    return {
      ok: false,
      warning:
        'Tarayıcı depolama alanı dolu veya yazma izni yok. Çalışmanız bellekte devam ediyor; JSON olarak dışa aktarabilirsiniz.',
    };
  }
}
