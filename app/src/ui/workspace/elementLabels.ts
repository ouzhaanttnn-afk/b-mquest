import type { BimElement } from '../../domain/types';

const LABELS: Record<BimElement['type'], string> = {
  wall: 'Duvar',
  door: 'Kapı',
  window: 'Pencere',
  floor: 'Döşeme',
  roof: 'Çatı',
  stair: 'Merdiven',
  room: 'Oda',
  grid: 'Aks',
  view: 'Görünüm',
  dimension: 'Ölçü',
  tag: 'Etiket',
  sheet: 'Pafta',
};

const ICONS: Record<BimElement['type'], string> = {
  wall: '🧱',
  door: '🚪',
  window: '🪟',
  floor: '▭',
  roof: '🏠',
  stair: '🪜',
  room: '▣',
  grid: '#',
  view: '👁',
  dimension: '↔',
  tag: '🏷',
  sheet: '📄',
};

export const elementLabelTr = (el: BimElement): string => LABELS[el.type];
export const elementIcon = (el: BimElement): string => ICONS[el.type];

/** One-line summary shown in the object list and the quick HUD. */
export function elementMetaTr(el: BimElement): string {
  switch (el.type) {
    case 'wall':
      return `Y:${el.height} · K:${el.thickness} mm${el.topConstraint ? ` · ↑${el.topConstraint}` : ''}`;
    case 'door':
      return `Host:${el.hostWallId} · ${el.mark}`;
    case 'window':
      return `Host:${el.hostWallId} · ${el.mark} · ${el.width}×${el.height}`;
    case 'floor':
      return `${el.levelId} · ${el.thickness} mm`;
    case 'roof':
      return `${el.baseLevelId} · ${el.slope}° · çıkma ${el.overhang}`;
    case 'stair':
      return `${el.baseLevelId}→${el.topLevelId} · ${el.risers}×${el.riserHeight}`;
    case 'room':
      return `${el.number || '—'} · ${el.name}`;
    case 'grid':
      return el.name;
    case 'view':
      return `${el.kind} · 1:${el.scale}`;
    case 'dimension':
      return `${el.wallA} ↔ ${el.wallB}`;
    case 'tag':
      return `→ ${el.targetId}`;
    case 'sheet':
      return `${el.number} · ${el.placements.length} görünüm`;
  }
}
