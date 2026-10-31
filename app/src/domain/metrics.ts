import { enclosedRegions, levelById, polygonArea, roomArea, roomBoundary, wallsOf, wallTopElevation } from './derived';
import { sectionCutsModel, sheetViewKinds } from './documentation';
import type { BimModel, ViewElement } from './types';

export const METRIC_NAMES = [
  'levelCount',
  'maxLevelElevation',
  'upperWallCount',
  'stairBlondel',
  'minBedroomArea',
  'windowFloorRatio',
  'gridVertical',
  'gridHorizontal',
  'wallCount',
  'doorCount',
  'windowCount',
  'floorCount',
  'roofCount',
  'roomCount',
  'sectionCount',
  'elevationCount',
  'dimensionCount',
  'tagCount',
  'sheetCount',
  'enclosedAreaM2',
  'floorCovers',
  'roofSeated',
  'sheetPlanSection',
] as const;

export type MetricName = (typeof METRIC_NAMES)[number];

const count = (m: BimModel, type: string) => m.elements.filter((e) => e.type === type).length;

/** Total area (m²) the walls of the first level fully enclose. */
export function enclosedAreaM2(m: BimModel): number {
  const level = m.levels[0]?.id;
  if (!level) return 0;
  const area = enclosedRegions(m, level).reduce((s, r) => s + r.area, 0);
  return Math.round(area / 100_000) / 10;
}

const isBedroom = (name: string) => /yatak/i.test(name.replace(/İ/g, 'i'));

/**
 * Rule-check helpers (Bölüm 11). The limits used by missions are teaching
 * values, not a statement of any specific regulation.
 */
export function stairBlondel(m: BimModel): number {
  const st = m.elements.find((e) => e.type === 'stair');
  return st && st.type === 'stair' ? 2 * st.riserHeight + st.treadDepth : 0;
}

/** Smallest bedroom area (m², 1 decimal); 0 when no room is named as a bedroom. */
export function minBedroomArea(m: BimModel): number {
  const rooms = m.elements.filter((e) => e.type === 'room' && isBedroom(e.name));
  if (rooms.length === 0) return 0;
  const areas = rooms.map((r) => (r.type === 'room' && !roomBoundary(r, m).open ? roomArea(r, m) : 0));
  return Math.round(Math.min(...areas) * 10) / 10;
}

/** Total window area as a percentage of total closed room area (1 decimal). */
export function windowFloorRatio(m: BimModel): number {
  const glass = m.elements.reduce((s, e) => (e.type === 'window' ? s + (e.width * e.height) / 1_000_000 : s), 0);
  const floor = m.elements.reduce(
    (s, e) => (e.type === 'room' && !roomBoundary(e, m).open ? s + roomArea(e, m) : s),
    0
  );
  return floor > 0 ? Math.round((glass / floor) * 1000) / 10 : 0;
}

/** A model-level number that a mission criterion can bound. */
export function modelMetric(m: BimModel, name: MetricName): number {
  switch (name) {
    case 'levelCount':
      return m.levels.length;
    case 'stairBlondel':
      return stairBlondel(m);
    case 'minBedroomArea':
      return minBedroomArea(m);
    case 'windowFloorRatio':
      return windowFloorRatio(m);
    case 'upperWallCount': {
      const lowest = [...m.levels].sort((a, b) => a.elevation - b.elevation)[0]?.id;
      return m.elements.filter((e) => e.type === 'wall' && e.baseLevelId !== lowest).length;
    }
    case 'maxLevelElevation':
      return Math.max(...m.levels.map((l) => l.elevation));
    case 'gridVertical':
      return m.elements.filter((e) => e.type === 'grid' && e.start[0] === e.end[0]).length;
    case 'gridHorizontal':
      return m.elements.filter((e) => e.type === 'grid' && e.start[1] === e.end[1]).length;
    case 'wallCount':
      return count(m, 'wall');
    case 'doorCount':
      return count(m, 'door');
    case 'windowCount':
      return count(m, 'window');
    case 'floorCount':
      return count(m, 'floor');
    case 'roofCount':
      return count(m, 'roof');
    case 'roomCount':
      return count(m, 'room');
    case 'sectionCount':
      return m.elements.filter(
        (e): e is ViewElement => e.type === 'view' && e.kind === 'section' && sectionCutsModel(e, m)
      ).length;
    case 'elevationCount':
      return m.elements.filter((e) => e.type === 'view' && e.kind === 'elevation').length;
    case 'dimensionCount':
      return count(m, 'dimension');
    case 'tagCount':
      return count(m, 'tag');
    case 'sheetCount':
      return count(m, 'sheet');
    case 'enclosedAreaM2':
      return enclosedAreaM2(m);
    case 'floorCovers': {
      const area = enclosedAreaM2(m) * 1_000_000;
      if (area === 0) return 0;
      return m.elements.some(
        (e) => e.type === 'floor' && Math.abs(polygonArea(e.boundary) - area) / area <= 0.06
      )
        ? 1
        : 0;
    }
    case 'roofSeated': {
      const tops = wallsOf(m).map((w) => wallTopElevation(w, m));
      if (tops.length === 0) return 0;
      const top = Math.max(...tops);
      return m.elements.some(
        (e) => e.type === 'roof' && (levelById(m, e.baseLevelId)?.elevation ?? -1) === top
      )
        ? 1
        : 0;
    }
    case 'sheetPlanSection':
      return m.elements.filter((e) => {
        if (e.type !== 'sheet') return false;
        const kinds = sheetViewKinds(e, m);
        return kinds.has('plan') && kinds.has('section');
      }).length;
  }
}
