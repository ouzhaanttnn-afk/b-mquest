/** Commands for the newer element kinds, Levels, Types and the Modify tools. */
import {
  addLevelOp,
  assignTypeOp,
  createFloorOp,
  createGridOp,
  createRoofOp,
  createRoomOp,
  createStairOp,
  createWindowOp,
  duplicateTypeOp,
  setLevelElevationOp,
  setTypeParamOp,
  type CreateFloorInput,
  type CreateGridInput,
  type CreateRoofInput,
  type CreateRoomInput,
  type CreateStairInput,
  type CreateWindowInput,
} from './modelOps';
import {
  alignWallOp,
  copyWallsToLevelOp,
  copyWallsOp,
  mirrorWallsOp,
  offsetWallOp,
  rectangleWallsOp,
  type RectangleWallsInput,
} from './modifyOps';

import {
  commitCreate,
  commitModelTransaction,
  noPermission,
  type CommandResult,
  type MissionSessionState,
} from './commandCore';

// ---- Modify tools -----------------------------------------------------------

export function createRectangleWallsCommand(
  state: MissionSessionState,
  input: RectangleWallsInput
): CommandResult {
  return (
    noPermission(state, 'wall', 'duvar') ??
    commitCreate(state, rectangleWallsOp(state.model, input))
  );
}

export function copyWallsCommand(
  state: MissionSessionState,
  ids: string[],
  dx: unknown,
  dz: unknown
): CommandResult {
  return (
    noPermission(state, 'wall', 'duvar') ??
    commitCreate(state, copyWallsOp(state.model, ids, dx, dz))
  );
}

export function mirrorWallsCommand(
  state: MissionSessionState,
  ids: string[],
  axis: 'x' | 'z',
  at: unknown
): CommandResult {
  return (
    noPermission(state, 'wall', 'duvar') ??
    commitCreate(state, mirrorWallsOp(state.model, ids, axis, at))
  );
}

export function offsetWallCommand(
  state: MissionSessionState,
  id: string,
  distance: unknown
): CommandResult {
  return (
    noPermission(state, 'wall', 'duvar') ??
    commitCreate(state, offsetWallOp(state.model, id, distance))
  );
}

export function alignWallCommand(
  state: MissionSessionState,
  movingId: string,
  refId: string
): CommandResult {
  const isSeed = state.task.initialModel.elements.some((e) => e.id === movingId);
  if (isSeed && !state.task.permissions.editableSeedIds.includes(movingId)) {
    return {
      ok: false,
      state,
      error: {
        code: 'E_PERMISSION_SEED',
        message: `${movingId} başlangıç duvarı bu görevde sabitlenmiştir; hizalanamaz.`,
      },
    };
  }
  const op = alignWallOp(state.model, movingId, refId);
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(state, op.model);
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

/** Edit Type → Duplicate (needs the Type permission; assigning needs typeId too). */
export function duplicateTypeCommand(
  state: MissionSessionState,
  typeId: string,
  name: unknown,
  assignToId?: string
): CommandResult {
  if (!state.task.permissions.editableFields.includes('typeParams')) {
    return {
      ok: false,
      state,
      error: { code: 'E_PERMISSION_FIELD', field: 'typeParams', message: 'Bu görevde tip oluşturma izniniz yok.' },
    };
  }
  const op = duplicateTypeOp(state.model, typeId, name, assignToId);
  if (!op.ok) return { ok: false, state, error: op.error };
  return commitModelTransaction(state, op.model);
}

/** Paste Aligned to Selected Levels. */
export function copyWallsToLevelCommand(
  state: MissionSessionState,
  ids: string[],
  levelId: string
): CommandResult {
  return (
    noPermission(state, 'wall', 'duvar') ??
    commitCreate(state, copyWallsToLevelOp(state.model, ids, levelId))
  );
}
