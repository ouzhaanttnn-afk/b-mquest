import { describe, expect, it } from 'vitest';
import { describeModel } from '../src/domain/summary';
import type { BimModel } from '../src/domain/types';

describe('describeModel', () => {
  it('says the model is empty', () => {
    expect(describeModel({ levels: [], elements: [] } as BimModel)).toBe('Model boş.');
  });
  it('counts elements by category and names the selection', () => {
    const m = {
      levels: [],
      elements: [
        { id: 'w1', type: 'wall' },
        { id: 'w2', type: 'wall' },
        { id: 'd1', type: 'door' },
      ],
    } as unknown as BimModel;
    expect(describeModel(m, 'w1')).toBe('Modelde 2 duvar, 1 kapı var. Seçili: w1.');
  });
});
