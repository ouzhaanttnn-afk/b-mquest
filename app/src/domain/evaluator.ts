import Ajv2020 from 'ajv/dist/2020.js';
import taskSchemaJson from '../schemas/task.schema.json';
import { checkModel, checkOptionsFor, summarizeIssues } from './modelCheck';
import { fieldValue } from './fieldValues';
import {
  isOpening,
  roomBoundary,
  wallsOf,
} from './derived';
import type {
  BimModel,
  CriterionEvidence,
  EvaluationResult,
  TaskCriterion,
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

  const typeIds = new Map((m.types ?? []).map((t) => [t.id, t]));
  if (typeIds.size !== (m.types ?? []).length) errors.push('E_DUPLICATE_ID');

  const needLevel = (id: string, levelId: string) => {
    if (!levels.has(levelId)) errors.push(`E_LEVEL:${id}`);
  };

  for (const e of m.elements) {
    const typeId = (e as { typeId?: string }).typeId;
    if (typeId !== undefined) {
      const t = typeIds.get(typeId);
      if (!t || t.category !== e.type) errors.push(`E_TYPE:${e.id}`);
    }
    if (e.type === 'wall') {
      needLevel(e.id, e.baseLevelId);
      if (e.topConstraint) needLevel(e.id, e.topConstraint);
      if (
        (e.start[0] !== e.end[0] && e.start[1] !== e.end[1]) ||
        same(e.start, e.end)
      ) {
        errors.push(`E_WALL_AXIS:${e.id}`);
      }
    } else if (e.type === 'door' || e.type === 'window') {
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
    } else if (e.type === 'floor') {
      needLevel(e.id, e.levelId);
    } else if (e.type === 'roof') {
      needLevel(e.id, e.baseLevelId);
    } else if (e.type === 'room') {
      needLevel(e.id, e.levelId);
    } else if (e.type === 'stair') {
      needLevel(e.id, e.baseLevelId);
      needLevel(e.id, e.topLevelId);
      const lo = levels.get(e.baseLevelId);
      const hi = levels.get(e.topLevelId);
      if (lo && hi && hi.elevation <= lo.elevation) {
        errors.push(`E_STAIR_LEVELS:${e.id}`);
      }
    } else if (e.type === 'grid') {
      if (same(e.start, e.end)) errors.push(`E_GRID_DEGENERATE:${e.id}`);
    } else if (e.type === 'view') {
      if (e.levelId && !levels.has(e.levelId)) errors.push(`E_LEVEL:${e.id}`);
      if (e.kind === 'section') {
        const cut = e.cutLine;
        if (!cut || (cut[0][0] !== cut[1][0] && cut[0][1] !== cut[1][1]) || same(cut[0], cut[1])) {
          errors.push(`E_SECTION_LINE:${e.id}`);
        }
      }
    } else if (e.type === 'dimension') {
      const a = elements.get(e.wallA);
      const b = elements.get(e.wallB);
      if (!a || !b || a.type !== 'wall' || b.type !== 'wall') errors.push(`E_DIM_REF:${e.id}`);
    } else if (e.type === 'tag') {
      const t = elements.get(e.targetId);
      if (!t || !(t.type === 'door' || t.type === 'window' || t.type === 'room')) {
        errors.push(`E_TAG_TARGET:${e.id}`);
      }
    } else if (e.type === 'sheet') {
      for (const pl of e.placements) {
        const v = elements.get(pl.viewId);
        if (!v || v.type !== 'view') errors.push(`E_SHEET_VIEW:${e.id}`);
      }
    }
  }

  const openings = m.elements
    .filter(isOpening)
    .sort((a, b) => a.id.localeCompare(b.id, 'en'));

  for (let i = 0; i < openings.length; i++) {
    for (let j = i + 1; j < openings.length; j++) {
      const a = openings[i];
      const b = openings[j];
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
      const numeric = [
        'height',
        'thickness',
        'width',
        'offset',
        'sill',
        'topOffset',
        'slope',
        'overhang',
        'risers',
        'riserHeight',
        'treadDepth',
        'scale',
        'cutHeight',
        'cropMinX',
        'cropMaxX',
        'cropMinZ',
        'cropMaxZ',
      ].includes(c.field);
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
  const elevationEditable = task.permissions.editableFields.includes('elevation');
  if (elevationEditable) {
    // Elevations may change and levels may be added, never removed or renamed.
    const now = new Map(model.levels.map((l) => [l.id, l.name]));
    if (task.initialModel.levels.some((l) => now.get(l.id) !== l.name)) {
      errors.push('E_LEVELS_IMMUTABLE');
    }
  } else if (!same(task.initialModel.levels, model.levels)) {
    errors.push('E_LEVELS_IMMUTABLE');
  }

  if (
    !task.permissions.editableFields.includes('typeParams') &&
    !same(task.initialModel.types ?? [], model.types ?? [])
  ) {
    errors.push('E_TYPES_IMMUTABLE');
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
    const editable = task.permissions.editableFields as string[];
    const seedEditable = task.permissions.editableSeedIds.includes(id);
    const keys = new Set([...Object.keys(oldRecord), ...Object.keys(nowRecord)]);
    for (const key of keys) {
      if (same(oldRecord[key], nowRecord[key])) continue;
      if (key === 'flip') continue; // swing side is cosmetic
      // Values that follow from an allowed relationship edit are allowed too:
      // a Top Constraint / Level change drives height, a Type edit drives
      // the numeric type parameters.
      const constrained =
        key === 'height' &&
        (now as { topConstraint?: string | null }).topConstraint &&
        ['elevation', 'topOffset', 'topConstraint'].some((f) => editable.includes(f));
      const typed =
        ['thickness', 'width', 'height'].includes(key) &&
        (now as { typeId?: string }).typeId &&
        ['typeParams', 'typeId'].some((f) => editable.includes(f));
      if (constrained || typed) continue;
      if (!seedEditable || !editable.includes(key)) {
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

const evidence = (
  c: TaskCriterion,
  pass: boolean,
  actual: unknown,
  expected: unknown,
  tolerance = 0
): CriterionEvidence => ({
  id: c.id,
  pass,
  actual,
  expected,
  tolerance,
  message: c.message,
});

/** Criteria that look at relationships between elements, not one field. */
function evaluateExtended(c: TaskCriterion, m: BimModel): CriterionEvidence | null {
  if (c.type === 'modelClean') {
    const issues = checkModel(m, checkOptionsFor([c])).filter(
      (i) => !c.codes || c.codes.includes(i.code)
    );
    const sum = summarizeIssues(issues);
    return evidence(
      c,
      issues.length === 0,
      issues.length === 0
        ? 'Sorun yok'
        : `${sum.count} sorun · ${sum.categories.join(', ')}`,
      '0 sorun'
    );
  }
  if (c.type === 'exists') {
    const where = Object.entries(c.where ?? {});
    const hits = m.elements.filter(
      (e) =>
        e.type === c.category &&
        where.every(([k, v]) => fieldValue(e, k, m) === v)
    );
    return evidence(c, hits.length >= 1, hits.length, '≥ 1 nesne');
  }
  if (c.type === 'hosted') {
    const need = c.min ?? 1;
    const ids = new Set(wallsOf(m).map((w) => w.id));
    const n = m.elements.filter(
      (e) => isOpening(e) && e.type === c.category && ids.has(e.hostWallId)
    ).length;
    return evidence(c, n >= need, n, `≥ ${need} duvara bağlı`);
  }
  if (c.type === 'constraint') {
    const targets = c.elementId
      ? wallsOf(m).filter((w) => w.id === c.elementId)
      : wallsOf(m);
    const wrong = targets.filter((w) => w.topConstraint !== c.topConstraint);
    return evidence(
      c,
      targets.length > 0 && wrong.length === 0,
      wrong.length ? `Bağlı değil: ${wrong.map((w) => w.id).join(', ')}` : 'Tamam',
      `Top Constraint = ${c.topConstraint}`
    );
  }
  if (c.type === 'roomClosed') {
    const rooms = m.elements.filter(
      (e) => e.type === 'room' && (!c.roomId || e.id === c.roomId)
    );
    const open = rooms.filter((r) => r.type === 'room' && roomBoundary(r, m).open);
    return evidence(
      c,
      rooms.length > 0 && open.length === 0,
      rooms.length === 0
        ? 'Room yok'
        : open.length
        ? `Açık: ${open.map((r) => r.id).join(', ')}`
        : 'Kapalı',
      'Kapalı sınır'
    );
  }
  if (c.type === 'typeUsage') {
    const all = m.elements.filter((e) => e.type === c.category);
    const used = all.filter((e) => (e as { typeId?: string }).typeId === c.typeId);
    const pass =
      c.count !== undefined
        ? used.length === c.count
        : all.length > 0 && used.length === all.length;
    return evidence(
      c,
      pass,
      `${used.length}/${all.length}`,
      c.count !== undefined ? `${c.count} adet ${c.typeId}` : `Hepsi ${c.typeId}`
    );
  }
  if (c.type === 'allEqual') {
    const all = m.elements.filter((e) => e.type === c.category);
    const values = [...new Set(all.map((e) => String(fieldValue(e, c.field, m))))];
    return evidence(c, all.length > 0 && values.length === 1, values.join(' / ') || '—', 'Hepsi aynı');
  }
  if (c.type === 'compare') {
    const a = m.elements.find((e) => e.id === c.elementId);
    const b = m.elements.find((e) => e.id === c.otherElementId);
    const va = a ? fieldValue(a, c.field, m) : null;
    const vb = b ? fieldValue(b, c.otherField, m) : null;
    const pass =
      va !== null && vb !== null &&
      (typeof va === 'number' && typeof vb === 'number'
        ? Math.abs(va - vb) <= c.tolerance
        : va === vb);
    return evidence(c, pass, `${c.elementId}: ${va ?? '—'}`, `${c.otherElementId}: ${vb ?? '—'}`, c.tolerance);
  }
  return null;
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
      const extended = evaluateExtended(c, m);
      if (extended) return extended;
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
