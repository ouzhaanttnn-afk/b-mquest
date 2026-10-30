import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WORKSHOP_ID,
  WORKSHOP_STORAGE_KEY,
  buildWorkshopTask,
  clearWorkshopModel,
  isWorkshop,
  loadWorkshopModel,
  saveWorkshopModel,
  workshopUnlocked,
} from '../src/content/workshop';
import { createDoorCommand, createInitialSession, createRectangleWallsCommand } from '../src/domain/commands';
import { evaluate, taskErrors } from '../src/domain/evaluator';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

afterEach(() => vi.unstubAllGlobals());

describe('Serbest Atölye', () => {
  it('is a valid task and unlocks after m02', () => {
    expect(taskErrors(buildWorkshopTask())).toEqual([]);
    expect(isWorkshop(WORKSHOP_ID)).toBe(true);
    expect(isWorkshop('m01')).toBe(false);
    expect(workshopUnlocked({ m01: 1 })).toBe(false);
    expect(workshopUnlocked({ m01: 1, m02: 1 })).toBe(true);
  });

  it('lets the player build freely and the model check passes on a clean house', () => {
    let s = createInitialSession(buildWorkshopTask());
    const r = createRectangleWallsCommand(s, {
      x: 0, z: 0, width: 6000, depth: 4000, baseLevelId: 'l0', height: 3000, thickness: 200,
    });
    expect(r.ok).toBe(true);
    if (r.ok) s = r.state;
    const wall = s.model.elements.find((e) => e.type === 'wall')!;
    const d = createDoorCommand(s, {
      hostWallId: wall.id, offset: 2000, width: 900, height: 2100, sill: 0, name: 'Kapı', mark: 'D-01', fireRating: 'none',
    } as never);
    expect(d.ok, JSON.stringify(!d.ok && d.error)).toBe(true);
    if (d.ok) s = d.state;
    expect(evaluate(s.task, s.model, 0).pass).toBe(true);
  });

  it('keeps the model in its own storage key, not in the mission save', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    expect(loadWorkshopModel()).toBeNull();
    const s = createInitialSession(buildWorkshopTask());
    const r = createRectangleWallsCommand(s, {
      x: 0, z: 0, width: 3000, depth: 3000, baseLevelId: 'l0', height: 3000, thickness: 200,
    });
    if (!r.ok) throw new Error('rect');
    saveWorkshopModel(r.state.model);
    expect(loadWorkshopModel()?.elements).toHaveLength(4);
    expect(window.localStorage.getItem('bimquest.save.v1')).toBeNull();
    clearWorkshopModel();
    expect(loadWorkshopModel()).toBeNull();
  });

  it('ignores a damaged saved model', () => {
    const store = memoryStorage();
    vi.stubGlobal('window', { localStorage: store });
    store.setItem(WORKSHOP_STORAGE_KEY, '{"levels":[],"elements":[{"id":"x"}]}');
    expect(loadWorkshopModel()).toBeNull();
    store.setItem(WORKSHOP_STORAGE_KEY, 'not json');
    expect(loadWorkshopModel()).toBeNull();
  });
});
