import type { BimModel } from './types';

const LABELS: Array<[string, string]> = [
  ['wall', 'duvar'],
  ['door', 'kapı'],
  ['window', 'pencere'],
  ['floor', 'döşeme'],
  ['roof', 'çatı'],
  ['stair', 'merdiven'],
  ['room', 'oda'],
  ['grid', 'aks'],
  ['view', 'görünüm'],
  ['dimension', 'ölçü'],
  ['tag', 'etiket'],
  ['sheet', 'pafta'],
];

/** One Turkish sentence a screen reader can read instead of the drawing. */
export function describeModel(model: BimModel, selectedName?: string | null): string {
  const parts: string[] = [];
  for (const [type, label] of LABELS) {
    const n = model.elements.filter((e) => e.type === type).length;
    if (n > 0) parts.push(`${n} ${label}`);
  }
  const base = parts.length ? `Modelde ${parts.join(', ')} var.` : 'Model boş.';
  return selectedName ? `${base} Seçili: ${selectedName}.` : base;
}
