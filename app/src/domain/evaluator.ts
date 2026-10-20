import Ajv2020 from 'ajv/dist/2020.js';
import taskSchemaJson from '../schemas/task.schema.json';
import type {
  BimModel,
  CriterionEvidence,
  DoorElement,
  EvaluationResult,
  MissionTask,
  RectangleCriterion,
  WallElement,
} from './types';

const ajv = new Ajv2020({ allErrors: true, strict: true });

export const validateTaskShape = ajv.compile(taskSchemaJson);
const validateModel = ajv.compile({
  $ref: `${taskSchemaJson.$id}#/$defs/model`,
});

const same = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const near = (a: unknown, b: unknown, t: number): boolean =>
  typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= t;

export const wallLength = (w: WallElement): number =>
  Math.abs(w.end[0] - w.start[0]) + Math.abs(w.end[1] - w.start[1]);

export function modelErrors(model: unknown): string[] {
  if (!validateModel(model)) return ['E_SCHEMA'];
  const m = model as BimModel;
  const errors: string[] = [];
  const levels = new Map(m.levels.map((l) => [l.id, l]));
  const elements = new Map(m.elements.map((e) => [e.id, e]));

  if (levels.size !== m.levels.length || elements.size !== m.elements.length) {
    errors.push('E_DUPLICATE_ID');
  }

  for (const o of [...m.levels, ...m.elements]) {
    for (const value of Object.values(o)) {
      if (
        typeof value === 'string' &&
        (value !== value.trim() || value !== value.normalize('NFC'))
      ) {
        errors.push('E_TEXT_NORMALIZATION');
      }
    }
  }

  for (const e of m.elements) {
    if (e.type === 'wall') {
      if (!levels.has(e.baseLevelId)) errors.push(`E_LEVEL:${e.id}`);
      if (
        (e.start[0] !== e.end[0] && e.start[1] !== e.end[1]) ||
        same(e.start, e.end)
      ) {
        errors.push(`E_WALL_AXIS:${e.id}`);
      }
    } else {
      const host = elements.get(e.hostWallId);
      if (!host || host.type !== 'wall') {
        errors.push(`E_HOST:${e.id}`);
        continue;
      }
      if (
        e.offset + e.width > wallLength(host) ||
        e.sill + e.height > host.height
      ) {
        errors.push(`E_OPENING_BOUNDS:${e.id}`);
      }
    }
  }

  const doors = m.elements
    .filter((e): e is DoorElement => e.type === 'door')
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));

  for (let i = 0; i < doors.length; i++) {
    for (let j = i + 1; j < doors.length; j++) {
      const a = doors[i];
      const b = doors[j];
      if (
        a.hostWallId === b.hostWallId &&
        Math.max(a.offset, b.offset) <
          Math.min(a.offset + a.width, b.offset + b.width) &&
        Math.max(a.sill, b.sill) <
          Math.min(a.sill + a.height, b.sill + b.height)
      ) {
        errors.push(`E_OPENING_OVERLAP:${a.id}:${b.id}`);
      }
    }
  }

  return [...new Set(errors)].sort();
}

export function taskErrors(task: unknown): string[] {
  if (!validateTaskShape(task)) return ['E_TASK_SCHEMA'];
  const t = task as unknown as MissionTask;
  const errors = modelErrors(t.initialModel);
  const seen = new Set<string>();

  for (const group of [t.criteria, t.hints]) {
    seen.clear();
    for (const c of group) {
      if (seen.has(c.id)) errors.push('E_DUPLICATE_CONTENT_ID');
      seen.add(c.id);
    }
  }

  const seed = new Set(t.initialModel.elements.map((e) => e.id));
  if (
    new Set(t.permissions.editableSeedIds).size !==
      t.permissions.editableSeedIds.length ||
    t.permissions.editableSeedIds.some((id) => !seed.has(id))
  ) {
    errors.push('E_SEED_PERMISSION');
  }

  for (const c of t.criteria) {
    if (
      c.type === 'rectangle' &&
      !t.initialModel.levels.some((l) => l.id === c.levelId)
    ) {
      errors.push('E_CRITERION_LEVEL');
    }
    if (c.type === 'property') {
      const numeric = ['height', 'thickness', 'width', 'offset', 'sill'].includes(
        c.field
      );
      if (
        numeric !== (typeof c.expected === 'number') ||
        (!numeric && c.tolerance !== 0)
      ) {
        errors.push('E_CRITERION_VALUE');
      }
    }
  }

  if (
    new Set(t.prerequisites).size !== t.prerequisites.length ||
    t.prerequisites.includes(t.id)
  ) {
    errors.push('E_PREREQUISITE');
  }

  return [...new Set(errors)].sort();
}

export function permissionErrors(task: MissionTask, model: BimModel): string[] {
  const errors: string[] = [];
  if (!same(task.initialModel.levels, model.levels)) {
    errors.push('E_LEVELS_IMMUTABLE');
  }

  const initial = new Map(task.initialModel.elements.map((e) => [e.id, e]));
  const current = new Map(model.elements.map((e) => [e.id, e]));

  for (const [id, old] of initial) {
    const now = current.get(id);
    if (!now) {
      errors.push(`E_SEED_MISSING:${id}`);
      continue;
    }
    const oldRecord = old as unknown as Record<string, unknown>;
    const nowRecord = now as unknown as Record<string, unknown>;
    for (const key of Object.keys(oldRecord)) {
      if (
        !same(oldRecord[key], nowRecord[key]) &&
        (!task.permissions.editableSeedIds.includes(id) ||
          !task.permissions.editableFields.includes(key as never))
      ) {
        errors.push(`E_SEED_FIELD:${id}:${key}`);
      }
    }
  }

  for (const e of model.elements) {
    if (
      !initial.has(e.id) &&
      !task.permissions.creatableTypes.includes(e.type)
    ) {
      errors.push(`E_CREATE_TYPE:${e.id}`);
    }
  }

  return errors.sort();
}

function rectangle(model: BimModel, c: RectangleCriterion): boolean {
  const [x, z] = c.origin;
  const w = c.width;
  const d = c.depth;
  const edges: [[[number, number], [number, number]], [[number, number], [number, number]], [[number, number], [number, number]], [[number, number], [number, number]]] = [
    [
      [x, z],
      [x + w, z],
    ],
    [
      [x + w, z],
      [x + w, z + d],
    ],
    [
      [x + w, z + d],
      [x, z + d],
    ],
    [
      [x, z + d],
      [x, z],
    ],
  ];
  const walls = model.elements.filter(
    (e): e is WallElement => e.type === 'wall'
  );
  if (walls.length !== 4) return false;

  const p = (a: [number, number], b: [number, number]): boolean =>
    a.every((v, i) => near(v, b[i], c.tolerance));

  const matches = (
    wall: WallElement,
    edge: [[number, number], [number, number]]
  ): boolean =>
    wall.baseLevelId === c.levelId &&
    near(wall.height, c.wallHeight, c.tolerance) &&
    near(wall.thickness, c.thickness, c.tolerance) &&
    ((p(wall.start, edge[0]) && p(wall.end, edge[1])) ||
      (p(wall.end, edge[0]) && p(wall.start, edge[1])));

  function match(i: number, used: Set<number>): boolean {
    if (i === 4) return true;
    return walls.some(
      (wall, j) =>
        !used.has(j) &&
        matches(wall, edges[i]) &&
        match(i + 1, new Set([...used, j]))
    );
  }

  return match(0, new Set());
}

export function evaluate(
  task: unknown,
  model: unknown,
  hintCount = 0
): EvaluationResult {
  const te = taskErrors(task);
  if (te.length) throw new Error(`Invalid authored task: ${te.join(',')}`);
  const t = task as MissionTask;
  if (
    !Number.isInteger(hintCount) ||
    hintCount < 0 ||
    hintCount > t.hints.length
  ) {
    throw new Error('Invalid hint count');
  }

  const errors = modelErrors(model);
  if (!errors.length) {
    errors.push(...permissionErrors(t, model as BimModel));
  }
  if (errors.length) {
    return { pass: false, score: 0, badge: null, errors, criteria: [] };
  }

  const m = model as BimModel;
  const results: CriterionEvidence[] = [...t.criteria]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((c) => {
      let actual: unknown;
      let pass: boolean;
      if (c.type === 'count') {
        actual = m.elements.filter((e) => e.type === c.elementType).length;
        pass = actual === c.expected;
      } else if (c.type === 'property') {
        const target = m.elements.find((e) => e.id === c.elementId) as
          | Record<string, unknown>
          | undefined;
        actual = target?.[c.field] ?? null;
        pass =
          typeof c.expected === 'number'
            ? near(actual, c.expected, c.tolerance)
            : actual === c.expected;
      } else if (c.type === 'rectangle') {
        actual = rectangle(m, c);
        pass = Boolean(actual);
      } else {
        throw new Error('Unsupported criterion');
      }
      return {
        id: c.id,
        pass,
        actual,
        expected:
          'expected' in c
            ? c.expected
            : {
                origin: c.origin,
                width: c.width,
                depth: c.depth,
                wallHeight: c.wallHeight,
                thickness: c.thickness,
              },
        tolerance: 'tolerance' in c ? c.tolerance : 0,
        message: c.message,
      };
    });

  const passed = results.filter((r) => r.pass).length;
  const pass = passed === results.length;
  const score = Math.max(
    0,
    Math.floor((100 * passed) / results.length) - 5 * hintCount
  );

  return {
    pass,
    score,
    badge: pass ? (score >= 90 ? 'gold' : score >= 75 ? 'silver' : 'bronze') : null,
    errors: [],
    criteria: results,
  };
}

/**
 * Using the final step-by-step walkthrough caps the reward at two stars
 * (silver), so the answer path never earns a gold badge.
 */
export function capBadgeForWalkthrough(
  result: EvaluationResult,
  walkthroughUsed: boolean
): EvaluationResult {
  if (!walkthroughUsed || result.badge !== 'gold') return result;
  return { ...result, badge: 'silver' };
}
