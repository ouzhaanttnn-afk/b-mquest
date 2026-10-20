import type { BadgeType, CriterionEvidence } from '../../domain/types';

export const WALL_QUICK_PRESETS: Array<{
  label: string;
  name: string;
  startX: string;
  startZ: string;
  endX: string;
  endZ: string;
}> = [
  {
    label: 'Güney (0,0 → 6000,0)',
    name: 'w_south',
    startX: '0',
    startZ: '0',
    endX: '6000',
    endZ: '0',
  },
  {
    label: 'Doğu (6000,0 → 6000,4000)',
    name: 'w_east',
    startX: '6000',
    startZ: '0',
    endX: '6000',
    endZ: '4000',
  },
  {
    label: 'Kuzey (6000,4000 → 0,4000)',
    name: 'w_north',
    startX: '6000',
    startZ: '4000',
    endX: '0',
    endZ: '4000',
  },
  {
    label: 'Batı (0,4000 → 0,0)',
    name: 'w_west',
    startX: '0',
    startZ: '4000',
    endX: '0',
    endZ: '0',
  },
];

export function badgeLabelTr(badge: BadgeType): string {
  if (badge === 'gold') return 'Altın Rozet';
  if (badge === 'silver') return 'Gümüş Rozet';
  if (badge === 'bronze') return 'Bronz Rozet';
  return 'Yok';
}

export function formatCriterionEvidenceTr(c: CriterionEvidence): string {
  if (typeof c.expected === 'number') {
    const actualStr =
      c.actual === null || c.actual === undefined
        ? 'Eksik (yok)'
        : `${c.actual}${c.id.startsWith('c_count') || c.id.startsWith('c_doors') ? ' adet' : ' mm'}`;
    const expectedStr = `${c.expected}${
      c.id.startsWith('c_count') || c.id.startsWith('c_doors') ? ' adet' : ' mm'
    }`;
    const tolStr = c.tolerance > 0 ? ` (±${c.tolerance} mm)` : '';
    return `Gerçek: ${actualStr} · Hedef: ${expectedStr}${tolStr}`;
  }
  if (typeof c.expected === 'string') {
    const actualStr =
      c.actual === null || c.actual === undefined ? 'Eksik (yok)' : String(c.actual);
    return `Gerçek: "${actualStr}" · Hedef: "${c.expected}"`;
  }
  if (c.expected && typeof c.expected === 'object') {
    const exp = c.expected as {
      origin: [number, number];
      width: number;
      depth: number;
      wallHeight: number;
      thickness: number;
    };
    return `Durum: ${
      c.actual ? 'Kapalı dikdörtgen eşleşti' : 'Kapalı dikdörtgen eşleşmedi'
    } · Hedef: ${exp.width}×${exp.depth} mm, Y:${exp.wallHeight} mm, K:${exp.thickness} mm (±${c.tolerance} mm)`;
  }
  return '';
}
