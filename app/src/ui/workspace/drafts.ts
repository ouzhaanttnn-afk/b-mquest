import type { BimElement } from '../../domain/types';

/** Text drafts for every editable field of the selected element. */
export function buildDraftsForElement(
  el: BimElement | null
): Record<string, string> {
  if (!el) return {};
  if (el.type === 'wall') {
    return {
      name: el.name,
      height: String(el.height),
      thickness: String(el.thickness),
      startX: String(el.start[0]),
      startZ: String(el.start[1]),
      endX: String(el.end[0]),
      endZ: String(el.end[1]),
      baseLevelId: el.baseLevelId,
      topOffset: String(el.topOffset ?? 0),
    };
  }
  if (el.type === 'door') {
    return {
      name: el.name,
      hostWallId: el.hostWallId,
      offset: String(el.offset),
      width: String(el.width),
      height: String(el.height),
      sill: String(el.sill),
      mark: el.mark,
      fireRating: el.fireRating,
    };
  }
  // window / floor / roof / stair / room / grid: every scalar field.
  const drafts: Record<string, string> = {};
  for (const [key, value] of Object.entries(el)) {
    if (typeof value === 'number' || typeof value === 'string') {
      drafts[key] = String(value);
    }
  }
  return drafts;
}
