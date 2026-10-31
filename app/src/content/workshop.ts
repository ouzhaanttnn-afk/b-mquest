import type { BimModel, EditableField, MissionTask } from '../domain/types';
import { modelErrors } from '../domain/evaluator';

/**
 * Serbest Atölye: a task-less sandbox. Every tool is open, nothing is graded
 * except an optional "is the model clean?" check, and the model is kept in its
 * own storage key so it never touches the mission save file.
 */

export const WORKSHOP_ID = 'atolye';
export const WORKSHOP_STORAGE_KEY = 'bimquest.workshop.v1';
export const WORKSHOP_UNLOCK_MISSION = 'm02';

const ALL_FIELDS: EditableField[] = [
  'height', 'thickness', 'name', 'start', 'end', 'baseLevelId', 'offset', 'width', 'sill',
  'mark', 'fireRating', 'hostWallId', 'topConstraint', 'topOffset', 'typeId', 'levelId',
  'slope', 'overhang', 'number', 'risers', 'riserHeight', 'treadDepth', 'topLevelId',
  'direction', 'seedPoint', 'elevation', 'footprint', 'boundary', 'typeParams', 'flip',
  'scale', 'cutHeight', 'cropMinX', 'cropMaxX', 'cropMinZ', 'cropMaxZ', 'wallA', 'wallB',
  'placements',
];

export const isWorkshop = (taskId: string): boolean => taskId === WORKSHOP_ID;

export function workshopUnlocked(completed: Record<string, unknown>): boolean {
  return WORKSHOP_UNLOCK_MISSION in completed;
}

export function emptyWorkshopModel(): BimModel {
  return {
    levels: [
      { id: 'l0', name: 'Zemin Kat', elevation: 0 },
      { id: 'l1', name: '1. Kat', elevation: 3000 },
    ],
    elements: [],
  };
}

export function buildWorkshopTask(model: BimModel = emptyWorkshopModel()): MissionTask {
  return {
    schemaVersion: '1.0',
    contentVersion: '1.0.0',
    id: WORKSHOP_ID,
    title: 'Serbest Atölye',
    objective:
      'Serbest modelleme alanı: istediğin aracı kullan, istediğin evi kur. Kontrol et yalnızca modelde hata var mı diye bakar.',
    prerequisites: [],
    estimatedMinutes: 60,
    initialModel: { levels: model.levels, elements: [] },
    permissions: {
      editableFields: ALL_FIELDS,
      creatableTypes: [
        'wall', 'door', 'window', 'floor', 'roof', 'stair', 'room', 'grid', 'view', 'dimension', 'tag', 'sheet',
      ],
      deletableCreated: true,
      editableSeedIds: [],
    },
    hints: [
      { id: 'h1', text: 'Üstteki araç çubuğundan bir araç seç ve plana dokun.' },
      { id: 'h2', text: 'Duvarlardan sonra kapı ve pencere ekle; oda için kapalı bir alan gerekir.' },
      { id: 'h3', text: 'Kontrol et, modeldeki tutarsızlıkları (açık oda, eksik host vb.) listeler.' },
    ],
    recap: 'Atölyede kurduğun model yalnızca bu cihazda saklanır.',
    criteria: [
      { id: 'c_clean', type: 'modelClean', message: 'Modelde uyarı kalmamalı.' },
    ],
  };
}

/** The saved workshop model, or null when none exists or it is damaged. */
export function loadWorkshopModel(): BimModel | null {
  try {
    const raw = window.localStorage.getItem(WORKSHOP_STORAGE_KEY);
    if (!raw) return null;
    const model = JSON.parse(raw) as BimModel;
    if (!model || !Array.isArray(model.levels) || !Array.isArray(model.elements)) return null;
    return modelErrors(model).length === 0 ? model : null;
  } catch {
    return null;
  }
}

export function saveWorkshopModel(model: BimModel): void {
  try {
    window.localStorage.setItem(WORKSHOP_STORAGE_KEY, JSON.stringify(model));
  } catch {
    // Storage full or blocked: the session keeps working, it just will not persist.
  }
}

export function clearWorkshopModel(): void {
  try {
    window.localStorage.removeItem(WORKSHOP_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
