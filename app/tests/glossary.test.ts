import { describe, expect, it } from 'vitest';
import { buildGlossary, fold, searchGlossary, shortcutList } from '../src/content/glossary';

describe('glossary', () => {
  const entries = buildGlossary();
  it('has one entry per mission plus the BIM concepts, all with unique keys', () => {
    expect(entries.filter((e) => e.missionId).length).toBeGreaterThanOrEqual(61);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });
  it('finds the research concepts and credits the source', () => {
    const hit = searchGlossary(entries, 'dijital ikiz');
    expect(hit.some((e) => e.id === 'k-field2bim')).toBe(true);
    expect(hit.find((e) => e.id === 'k-field2bim')!.source).toContain('Sacks');
    expect(searchGlossary(entries, 'IFC').some((e) => e.id === 'k-ifc')).toBe(true);
  });
  it('folds Turkish letters', () => {
    expect(fold('IŞIK İNCE')).toBe(fold('ışık ince'));
    expect(fold('Çatı')).toBe(fold('cati'));
  });
  it('finds concepts regardless of case and accents', () => {
    expect(searchGlossary(entries, 'LEVEL').length).toBeGreaterThan(0);
    expect(searchGlossary(entries, 'kesit').some((e) => e.missionId === 'm31')).toBe(true);
    expect(searchGlossary(entries, 'zzzzqq')).toEqual([]);
    expect(searchGlossary(entries, '')).toHaveLength(entries.length);
  });
  it('lists the Revit shortcuts', () => {
    const keys = shortcutList().map((s) => s.keys);
    expect(keys).toEqual(expect.arrayContaining(['WA', 'DR', 'WN']));
  });
});
