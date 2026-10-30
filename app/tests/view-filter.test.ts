import { describe, expect, it } from 'vitest';
import { visibleModel } from '../src/domain/viewFilter';
import type { BimModel } from '../src/domain/types';

const model: BimModel = {
  levels: [{ id: 'l0', name: 'Zemin', elevation: 0 }],
  elements: [
    { id: 'w1', type: 'wall', name: 'w1', baseLevelId: 'l0', start: [0, 0], end: [1000, 0], height: 3000, thickness: 200 },
    { id: 'd1', type: 'door', name: 'd1', hostWallId: 'w1', offset: 300, width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' },
  ],
} as BimModel;

describe('visibleModel', () => {
  it('returns the same model when nothing is hidden', () => {
    expect(visibleModel(model, new Set())).toBe(model);
  });
  it('hides a category without touching the source', () => {
    expect(visibleModel(model, new Set(['door'])).elements.map((e) => e.id)).toEqual(['w1']);
    expect(model.elements).toHaveLength(2);
  });
  it('hides openings together with their wall', () => {
    expect(visibleModel(model, new Set(['wall'])).elements).toEqual([]);
  });
});
