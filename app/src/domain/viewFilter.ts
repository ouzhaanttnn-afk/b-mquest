import type { BimElement, BimModel } from './types';

/** Categories the player can switch off, like Visibility/Graphics in Revit. */
export const VG_CATEGORIES: Array<{ id: BimElement['type']; label: string }> = [
  { id: 'wall', label: 'Duvarlar' },
  { id: 'door', label: 'Kapılar' },
  { id: 'window', label: 'Pencereler' },
  { id: 'floor', label: 'Döşemeler' },
  { id: 'roof', label: 'Çatılar' },
  { id: 'stair', label: 'Merdivenler' },
  { id: 'room', label: 'Odalar' },
  { id: 'grid', label: 'Akslar' },
  { id: 'dimension', label: 'Ölçüler' },
  { id: 'tag', label: 'Etiketler' },
];

/**
 * A display-only copy of the model with the hidden categories removed.
 * Doors and windows disappear with their host wall so nothing is left floating.
 * Never use it for evaluation or editing.
 */
export function visibleModel(model: BimModel, hidden: ReadonlySet<string>): BimModel {
  if (hidden.size === 0) return model;
  const wallsHidden = hidden.has('wall');
  return {
    ...model,
    elements: model.elements.filter((e) => {
      if (hidden.has(e.type)) return false;
      if (wallsHidden && (e.type === 'door' || e.type === 'window')) return false;
      return true;
    }),
  };
}
