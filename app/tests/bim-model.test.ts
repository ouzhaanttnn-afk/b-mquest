import { describe, expect, it } from 'vitest';
import {
  createFloorCommand,
  createGridCommand,
  createInitialSession,
  createRoofCommand,
  createRoomCommand,
  createStairCommand,
  createWindowCommand,
  deleteElementCommand,
  moveWallCommand,
  redoCommand,
  setLevelElevationCommand,
  undoCommand,
  updateElementProperty,
  updateTypeParamCommand,
  type MissionSessionState,
} from '../src/domain/commands';
import {
  hostedElements,
  roomArea,
  roomBoundary,
  roomVolume,
  wallTopElevation,
} from '../src/domain/derived';
import { evaluate, modelErrors, taskErrors } from '../src/domain/evaluator';
import type {
  BimModel,
  EditableField,
  CreatableElementType,
  MissionTask,
  RoomElement,
  TaskCriterion,
  WallElement,
} from '../src/domain/types';

const wall = (
  id: string,
  start: [number, number],
  end: [number, number],
  extra: Partial<WallElement> = {}
): WallElement => ({
  id,
  type: 'wall',
  name: id,
  baseLevelId: 'l0',
  start,
  end,
  height: 3000,
  thickness: 200,
  ...extra,
});

const baseModel = (): BimModel => ({
  levels: [
    { id: 'l0', elevation: 0, name: 'Zemin' },
    { id: 'l1', elevation: 3000, name: 'Kat 1' },
  ],
  elements: [
    wall('w1', [0, 0], [6000, 0], { typeId: 'wt200' }),
    wall('w2', [6000, 0], [6000, 4000], { typeId: 'wt200' }),
    wall('w3', [6000, 4000], [0, 4000], { typeId: 'wt200' }),
    wall('w4', [0, 4000], [0, 0], { typeId: 'wt200' }),
  ],
  types: [
    { id: 'wt200', category: 'wall', family: 'Basic Wall', name: 'Generic - 200mm', params: { thickness: 200 } },
    { id: 'wt300', category: 'wall', family: 'Basic Wall', name: 'Generic - 300mm', params: { thickness: 300 } },
    { id: 'wn900', category: 'window', family: 'Fixed', name: '900 x 1200', params: { width: 900, height: 1200 } },
  ],
});

function taskWith(
  model: BimModel,
  editable: EditableField[],
  creatable: CreatableElementType[],
  criteria: TaskCriterion[] = [
    { id: 'c1', type: 'exists', category: 'wall', message: 'En az bir duvar olmalı.' },
  ]
): MissionTask {
  return {
    schemaVersion: '1.0',
    contentVersion: '1.0.0',
    id: 'm99',
    title: 'Sandbox',
    objective: 'Test',
    prerequisites: [],
    estimatedMinutes: 5,
    initialModel: model,
    permissions: {
      editableFields: editable,
      creatableTypes: creatable,
      deletableCreated: true,
      editableSeedIds: model.elements.map((e) => e.id),
    },
    hints: [
      { id: 'h1', text: 'a' },
      { id: 'h2', text: 'b' },
      { id: 'h3', text: 'c' },
    ],
    recap: 'r',
    criteria,
  };
}

const session = (
  model = baseModel(),
  editable: EditableField[] = [],
  creatable: CreatableElementType[] = [],
  criteria?: TaskCriterion[]
): MissionSessionState =>
  createInitialSession(taskWith(model, editable, creatable, criteria));

const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok, JSON.stringify((r as { error?: unknown }).error)).toBe(true);
  return r as Extract<T, { ok: true }>;
};

describe('Faz 1 — BIM nesne modeli', () => {
  it('task + model with the new element kinds pass schema + integrity', () => {
    expect(taskErrors(taskWith(baseModel(), [], []))).toEqual([]);
  });

  describe('room boundary', () => {
    const room = (): RoomElement => ({
      id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [3000, 2000],
    });

    it('closed rectangle: 24 m² and 72 m³', () => {
      const m = baseModel();
      m.elements.push(room());
      const r = m.elements[4] as RoomElement;
      expect(roomBoundary(r, m).open).toBe(false);
      expect(roomArea(r, m)).toBeCloseTo(24, 5);
      expect(roomVolume(r, m)).toBeCloseTo(72, 5);
    });

    it('open when a wall is missing, reporting where the gap is', () => {
      const m = baseModel();
      m.elements = m.elements.filter((e) => e.id !== 'w3');
      m.elements.push(room());
      const b = roomBoundary(m.elements[3] as RoomElement, m);
      expect(b.open).toBe(true);
      expect(b.gapAt).toBeDefined();
      expect(b.area).toBe(0);
    });

    it('a wall that stops short leaves a gap', () => {
      const m = baseModel();
      (m.elements[2] as WallElement).start = [6000, 4000];
      (m.elements[2] as WallElement).end = [1000, 4000];
      m.elements.push(room());
      expect(roomBoundary(m.elements[4] as RoomElement, m).open).toBe(true);
    });
  });

  describe('Level / Top Constraint', () => {
    it('Level elevation change moves every constrained wall', () => {
      const m = baseModel();
      for (const w of m.elements) {
        if (w.type === 'wall') {
          w.topConstraint = 'l1';
          w.topOffset = 0;
          w.typeId = undefined;
        }
      }
      m.types = [];
      const s = session(m, ['elevation'], []);
      expect(wallTopElevation(m.elements[0] as WallElement, m)).toBe(3000);
      const res = ok(setLevelElevationCommand(s, 'l1', 3500));
      for (const w of res.state.model.elements) {
        if (w.type === 'wall') {
          expect(w.height).toBe(3500);
          expect(wallTopElevation(w, res.state.model)).toBe(3500);
        }
      }
      expect(undoCommand(res.state).model.elements[0]).toMatchObject({ height: 3000 });
    });

    it('setting Top Constraint syncs the stored height; direct height edit is refused', () => {
      const m = baseModel();
      m.types = [];
      m.elements.forEach((e) => ((e as WallElement).typeId = undefined));
      const s = session(m, ['topConstraint', 'topOffset', 'height'], []);
      const a = ok(updateElementProperty(s, 'w1', 'topConstraint', 'l1'));
      expect(a.state.model.elements[0]).toMatchObject({ topConstraint: 'l1', height: 3000 });
      const b = ok(updateElementProperty(a.state, 'w1', 'topOffset', -200));
      expect(b.state.model.elements[0]).toMatchObject({ height: 2800 });
      const c = updateElementProperty(b.state, 'w1', 'height', 3200);
      expect(c.ok).toBe(false);
    });
  });

  describe('Type vs Instance', () => {
    it('Edit Type changes every instance of that Type', () => {
      const s = session(baseModel(), ['typeParams'], []);
      const res = ok(updateTypeParamCommand(s, 'wt200', 'thickness', 250));
      for (const w of res.state.model.elements) {
        expect(w).toMatchObject({ thickness: 250 });
      }
    });

    it('Instance thickness edit on a typed wall is refused', () => {
      const s = session(baseModel(), ['thickness'], []);
      const res = updateElementProperty(s, 'w1', 'thickness', 250);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('E_TYPE_PARAMETER');
    });

    it('assigning another Type applies its parameters', () => {
      const s = session(baseModel(), ['typeId'], []);
      const res = ok(updateElementProperty(s, 'w2', 'typeId', 'wt300'));
      expect(res.state.model.elements[1]).toMatchObject({ typeId: 'wt300', thickness: 300 });
      expect(res.state.model.elements[0]).toMatchObject({ thickness: 200 });
    });

    it('Type edits need the typeParams permission', () => {
      expect(updateTypeParamCommand(session(), 'wt200', 'thickness', 250).ok).toBe(false);
    });
  });

  describe('hosted elements', () => {
    const withWindow = () => {
      const s = session(baseModel(), ['offset', 'start', 'end'], ['window']);
      return ok(createWindowCommand(s, { hostWallId: 'w1', offset: 1000, width: 900, height: 1200, sill: 900 }));
    };

    it('creates a window hosted on a wall', () => {
      const res = withWindow();
      expect(res.createdId).toBe('win1');
      expect(hostedElements('w1', res.state.model)).toHaveLength(1);
    });

    it('rejects a window beyond the wall', () => {
      const s = session(baseModel(), [], ['window']);
      const r = createWindowCommand(s, { hostWallId: 'w1', offset: 5500, width: 900, height: 1200, sill: 900 });
      expect(r.ok).toBe(false);
    });

    it('moving the host wall carries the window along (offset is relative)', () => {
      const s = withWindow().state;
      const moved = ok(moveWallCommand({ ...s, task: { ...s.task, permissions: { ...s.task.permissions, editableSeedIds: ['w1', 'w2', 'w3', 'w4'] } } }, 'w1', 500, 0));
      const w = moved.state.model.elements.find((e) => e.id === 'win1');
      expect(w).toMatchObject({ hostWallId: 'w1', offset: 1000 });
    });

    it('deleting a host with a window asks first; cascade removes both; undo restores', () => {
      const s0 = withWindow().state;
      const s: MissionSessionState = {
        ...s0,
        task: { ...s0.task, initialModel: { ...s0.task.initialModel, elements: [] }, permissions: { ...s0.task.permissions, editableSeedIds: [], creatableTypes: ['wall', 'door', 'window'] } },
      };
      expect(deleteElementCommand(s, 'w1').ok).toBe(false);
      const del = ok(deleteElementCommand(s, 'w1', { cascade: true }));
      expect(del.state.model.elements.some((e) => e.id === 'w1' || e.id === 'win1')).toBe(false);
      const back = redoCommand(undoCommand(del.state));
      expect(back.model.elements.some((e) => e.id === 'win1')).toBe(false);
      expect(undoCommand(del.state).model.elements.some((e) => e.id === 'win1')).toBe(true);
    });

    it('window and door overlap on the same wall is an integrity error', () => {
      const m = baseModel();
      m.elements.push(
        { id: 'd1', type: 'door', name: 'D', hostWallId: 'w1', offset: 1000, width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' },
        { id: 'win1', type: 'window', name: 'W', hostWallId: 'w1', offset: 1200, width: 900, height: 1000, sill: 500, mark: 'W-01' }
      );
      expect(modelErrors(m).some((e) => e.startsWith('E_OPENING_OVERLAP'))).toBe(true);
    });
  });

  describe('creation commands', () => {
    it('floor from walls, room, grid, roof, stair — each undoable', () => {
      let s = session(baseModel(), [], ['floor', 'room', 'grid', 'roof', 'stair']);
      s = ok(createFloorCommand(s, { levelId: 'l0' })).state;
      expect(s.model.elements.find((e) => e.type === 'floor')).toMatchObject({ id: 'f1', thickness: 200 });
      s = ok(createRoomCommand(s, { levelId: 'l0', seedPoint: [3000, 2000], name: 'Salon', number: '101' })).state;
      s = ok(createGridCommand(s, { start: [0, -1000], end: [0, 5000] })).state;
      s = ok(createGridCommand(s, { start: [-1000, 0], end: [7000, 0] })).state;
      const names = s.model.elements.filter((e) => e.type === 'grid').map((g) => g.name);
      expect(names).toEqual(['A', '1']);
      s = ok(createRoofCommand(s, { baseLevelId: 'l1', slope: 30, overhang: 500 })).state;
      s = ok(createStairCommand(s, { baseLevelId: 'l0', topLevelId: 'l1', start: [1000, 1000], direction: 'x+', riserHeight: 176, risers: 17 })).state;
      expect(s.model.elements.filter((e) => ['floor', 'room', 'grid', 'roof', 'stair'].includes(e.type))).toHaveLength(6);
      const undone = undoCommand(s);
      expect(undone.model.elements.some((e) => e.type === 'stair')).toBe(false);
    });

    it('creation needs permission', () => {
      expect(createFloorCommand(session(), { levelId: 'l0' }).ok).toBe(false);
    });

    it('stair with top level below base is rejected', () => {
      const s = session(baseModel(), [], ['stair']);
      expect(createStairCommand(s, { baseLevelId: 'l1', topLevelId: 'l0', start: [0, 0], direction: 'x+' }).ok).toBe(false);
    });
  });

  describe('new criteria', () => {
    const run = (m: BimModel, criteria: TaskCriterion[]) =>
      evaluate(taskWith(JSON.parse(JSON.stringify(m)) as BimModel, [], [], criteria), m, 0);

    it('constraint / allEqual(topElevation) / compare with a roof', () => {
      const m = baseModel();
      m.types = [];
      m.elements.forEach((e) => {
        const w = e as WallElement;
        w.typeId = undefined;
        w.topConstraint = 'l1';
        w.topOffset = 0;
      });
      m.elements.push({ id: 'rf1', type: 'roof', name: 'R', baseLevelId: 'l1', footprint: [[0, 0], [6000, 0], [6000, 4000]], slope: 20, overhang: 300 });
      const good = run(m, [
        { id: 'c1', type: 'constraint', topConstraint: 'l1', message: 'x' },
        { id: 'c2', type: 'allEqual', category: 'wall', field: 'topElevation', message: 'x' },
        { id: 'c3', type: 'compare', elementId: 'w1', field: 'topElevation', otherElementId: 'rf1', otherField: 'baseElevation', tolerance: 0, message: 'x' },
      ]);
      expect(good.pass).toBe(true);
      (m.elements[1] as WallElement).topOffset = -200;
      (m.elements[1] as WallElement).height = 2800;
      const bad = run(m, [
        { id: 'c2', type: 'allEqual', category: 'wall', field: 'topElevation', message: 'x' },
      ]);
      expect(bad.pass).toBe(false);
    });

    it('hosted / exists / typeUsage / roomClosed', () => {
      const m = baseModel();
      m.elements.push(
        { id: 'win1', type: 'window', name: 'W', hostWallId: 'w1', offset: 1000, width: 900, height: 1200, sill: 900, mark: 'W-01', typeId: 'wn900' },
        { id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [3000, 2000] }
      );
      const res = run(m, [
        { id: 'c1', type: 'hosted', category: 'window', hostCategory: 'wall', message: 'x' },
        { id: 'c2', type: 'exists', category: 'room', where: { number: '101' }, message: 'x' },
        { id: 'c3', type: 'typeUsage', category: 'wall', typeId: 'wt200', message: 'x' },
        { id: 'c4', type: 'roomClosed', message: 'x' },
      ]);
      expect(res.criteria.map((c) => c.pass)).toEqual([true, true, true, true]);
      m.elements = m.elements.filter((e) => e.id !== 'w3');
      const open = run(m, [{ id: 'c4', type: 'roomClosed', message: 'x' }]);
      expect(open.pass).toBe(false);
    });
  });
});
