import { hostedElements, levelById, roomArea, roomBoundary } from './derived';
import type { BimElement, BimModel } from './types';

export interface Relation {
  label: string;
  value: string;
}

const levelName = (model: BimModel, id: string | null | undefined): string =>
  (id && levelById(model, id)?.name) || '—';

/**
 * The links an element has to the rest of the model (host, level, the walls
 * around a room…). BIM is these relations as much as the geometry; schedules
 * and exports often lose them, so the inspector shows them in one line.
 */
export function elementRelations(el: BimElement, model: BimModel): Relation[] {
  switch (el.type) {
    case 'wall': {
      const hosted = hostedElements(el.id, model).map((o) => o.id);
      return [
        { label: 'Kat', value: levelName(model, el.baseLevelId) },
        { label: 'Üst', value: el.topConstraint ? levelName(model, el.topConstraint) : 'bağlı değil' },
        { label: 'Taşıdığı', value: hosted.length ? hosted.join(', ') : 'yok' },
      ];
    }
    case 'door':
    case 'window': {
      const host = model.elements.find((e) => e.id === el.hostWallId);
      return [
        { label: 'Host', value: host ? host.id : 'yok!' },
        { label: 'Kat', value: host && host.type === 'wall' ? levelName(model, host.baseLevelId) : '—' },
      ];
    }
    case 'room': {
      const closed = !roomBoundary(el, model).open;
      return [
        { label: 'Kat', value: levelName(model, el.levelId) },
        { label: 'Sınır', value: closed ? 'kapalı' : 'açık!' },
        { label: 'Alan', value: closed ? `${roomArea(el, model).toFixed(1)} m²` : '—' },
      ];
    }
    case 'floor':
    case 'roof':
      return [{ label: 'Kat', value: levelName(model, el.type === 'floor' ? el.levelId : el.baseLevelId) }];
    case 'stair':
      return [
        { label: 'Alt', value: levelName(model, el.baseLevelId) },
        { label: 'Üst', value: levelName(model, el.topLevelId) },
      ];
    default:
      return [];
  }
}
