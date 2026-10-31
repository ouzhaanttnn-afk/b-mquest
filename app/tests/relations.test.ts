import { describe, expect, it } from 'vitest';
import { loadValidatedCatalog } from '../src/content/content';
import { elementRelations } from '../src/domain/relations';

const cat = loadValidatedCatalog();
if (!cat.ok) throw new Error(cat.diagnostic);
const m = cat.catalog.missionsById;

describe('elementRelations', () => {
  it('wall: level, top and the openings it carries', () => {
    const model = m.m28.initialModel;
    const w1 = model.elements.find((e) => e.id === 'w1')!;
    expect(elementRelations(w1, model)).toEqual([
      { label: 'Kat', value: 'Zemin Kat' },
      { label: 'Üst', value: 'bağlı değil' },
      { label: 'Taşıdığı', value: 'd1, d2' },
    ]);
  });
  it('door: its host and level', () => {
    const model = m.m28.initialModel;
    const d3 = model.elements.find((e) => e.id === 'd3')!;
    expect(elementRelations(d3, model)).toEqual([
      { label: 'Host', value: 'w3' },
      { label: 'Kat', value: 'Zemin Kat' },
    ]);
  });
  it('room: closed boundary and area', () => {
    const model = m.m53.initialModel;
    const r1 = model.elements.find((e) => e.id === 'r1')!;
    expect(elementRelations(r1, model)).toEqual([
      { label: 'Kat', value: 'Zemin Kat' },
      { label: 'Sınır', value: 'kapalı' },
      { label: 'Alan', value: '12.0 m²' },
    ]);
  });
});
