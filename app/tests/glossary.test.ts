import { describe, expect, it } from 'vitest';
import { buildGlossary, fold, searchGlossary, shortcutList } from '../src/content/glossary';

describe('glossary', () => {
  const entries = buildGlossary();
  it('has one entry per mission', () => {
    expect(entries.length).toBeGreaterThanOrEqual(58);
    expect(new Set(entries.map((e) => e.missionId)).size).toBe(entries.length);
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
