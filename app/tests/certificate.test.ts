import { describe, expect, it } from 'vitest';
import { buildCertificate, certificateUnlocked, cleanName } from '../src/domain/certificate';

describe('certificate', () => {
  it('unlocks only after the final delivery (m50)', () => {
    expect(certificateUnlocked({ m49: { bestScore: 100 } })).toBe(false);
    expect(certificateUnlocked({ m50: { bestScore: 70 } })).toBe(true);
  });
  it('cleans names: control characters, spacing, length', () => {
    expect(cleanName('  Ayşe\n  Yılmaz \u0007 ')).toBe('Ayşe Yılmaz');
    expect(cleanName('x'.repeat(100))).toHaveLength(40);
  });
  it('builds the summary from the save', () => {
    const c = buildCertificate(
      { m01: { bestScore: 100 }, m02: { bestScore: 80 }, m03: { bestScore: 95 } },
      '',
      new Date('2026-10-30T12:00:00Z')
    );
    expect(c).toMatchObject({ name: 'BIM Modelleyici', missions: 3, goldCount: 2 });
    expect(c.totalXp).toBe(200 + 160 + 190);
    expect(c.dateLabel).toContain('2026');
  });
});
