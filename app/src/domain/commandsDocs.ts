/** Commands for views, dimensions, tags and sheets. */
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

import {
  commitModelTransaction,
  noPermission,
  type CommandResult,
  type MissionSessionState,
} from './commandCore';

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

