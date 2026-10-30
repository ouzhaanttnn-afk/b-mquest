import {
  levelById,
  roomArea,
  roomBoundary,
  roomVolume,
  stairRise,
  wallTopElevation,
} from './derived';
import {
  dimensionValue,
  sectionCutsModel,
  sheetViewKinds,
  tagLabel,
  viewCrop,
} from './documentation';
import type { BimElement, BimModel } from './types';

/**
 * Value of a (possibly derived) field, used by allEqual / compare criteria.
 * Derived names: topElevation, area, volume, closed.
 */
export function fieldValue(
  el: BimElement,
  field: string,
  model: BimModel
): number | string | boolean | null {
  if (field === 'topElevation' && el.type === 'wall') {
    return wallTopElevation(el, model);
  }
  if (el.type === 'dimension') {
    if (field === 'value') return dimensionValue(el, model);
  }
  if (el.type === 'tag' && field === 'label') return tagLabel(el, model);
  if (el.type === 'view') {
    if (field === 'cutsModel') return sectionCutsModel(el, model) ? 1 : 0;
    if (field === 'cropped') return viewCrop(el) ? 1 : 0;
  }
  if (el.type === 'sheet') {
    const kinds = sheetViewKinds(el, model);
    if (field === 'hasPlan') return kinds.has('plan') ? 1 : 0;
    if (field === 'hasSection') return kinds.has('section') ? 1 : 0;
    if (field === 'hasElevation') return kinds.has('elevation') ? 1 : 0;
    if (field === 'viewCount') return el.placements.length;
  }
  if (el.type === 'room') {
    if (field === 'area') return Math.round(roomArea(el, model) * 100) / 100;
    if (field === 'volume') return Math.round(roomVolume(el, model) * 100) / 100;
    if (field === 'closed') return !roomBoundary(el, model).open;
  }
  if (el.type === 'grid') {
    const vertical = el.start[0] === el.end[0];
    if (field === 'axisPos') return vertical ? el.start[0] : el.start[1];
    if (field === 'axisDir') return vertical ? 'v' : 'h';
  }
  if (el.type === 'wall') {
    const horizontal = el.start[1] === el.end[1];
    const vertical = el.start[0] === el.end[0];
    if (field === 'axisDir') return horizontal ? 'h' : vertical ? 'v' : 'd';
    if (field === 'axisPos') return horizontal ? el.start[1] : vertical ? el.start[0] : null;
    if (field === 'length') return Math.round(Math.hypot(el.end[0] - el.start[0], el.end[1] - el.start[1]));
  }
  if (el.type === 'roof' && field === 'baseElevation') {
    return levelById(model, el.baseLevelId)?.elevation ?? null;
  }
  if (el.type === 'floor' && field === 'elevation') {
    return levelById(model, el.levelId)?.elevation ?? null;
  }
  if (el.type === 'stair' && field === 'rise') return stairRise(el);
  if (el.type === 'stair' && field === 'levelRise') {
    const a = levelById(model, el.baseLevelId)?.elevation;
    const b = levelById(model, el.topLevelId)?.elevation;
    return a === undefined || b === undefined ? null : b - a;
  }
  const v = (el as unknown as Record<string, unknown>)[field];
  if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
    return v;
  }
  return null;
}
