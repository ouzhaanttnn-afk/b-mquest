import type { BimModel, DoorElement, WallElement, WindowElement } from '../domain/types';

export interface WallSegmentSpan {
  fromOffset: number;
  toOffset: number;
}

export interface WallBox3D {
  key: string;
  wallId: string;
  /** Center in mm: [x, y, z] where Y is vertical up */
  centerMm: [number, number, number];
  /** Size in mm: [sizeX, sizeY, sizeZ] */
  sizeMm: [number, number, number];
}

export function getWallLengthMm(wall: WallElement): number {
  return (
    Math.abs(wall.end[0] - wall.start[0]) +
    Math.abs(wall.end[1] - wall.start[1])
  );
}

export function getWallDirection(wall: WallElement): [number, number] {
  const len = getWallLengthMm(wall);
  if (len === 0) return [1, 0];
  return [
    (wall.end[0] - wall.start[0]) / len,
    (wall.end[1] - wall.start[1]) / len,
  ];
}

/**
 * Splits a wall along its length around hosted doors for 2D plan rendering.
 */
export function computeWallPlanSegments(
  wall: WallElement,
  doorsOnWall: Array<{ offset: number; width: number }>
): WallSegmentSpan[] {
  const totalLen = getWallLengthMm(wall);
  if (totalLen <= 0) return [];
  if (doorsOnWall.length === 0) {
    return [{ fromOffset: 0, toOffset: totalLen }];
  }

  const sorted = [...doorsOnWall]
    .filter((d) => d.offset >= 0 && d.offset + d.width <= totalLen)
    .sort((a, b) => a.offset - b.offset);

  const spans: WallSegmentSpan[] = [];
  let cursor = 0;
  for (const d of sorted) {
    if (d.offset > cursor) {
      spans.push({ fromOffset: cursor, toOffset: d.offset });
    }
    cursor = Math.max(cursor, d.offset + d.width);
  }
  if (cursor < totalLen) {
    spans.push({ fromOffset: cursor, toOffset: totalLen });
  }
  return spans;
}

/**
 * Deterministically builds 3D boxes for a wall and its hosted door openings (no CSG needed).
 * Each opening cuts the wall into left/right full-height strips, lintel above, and sill below if sill > 0.
 */
export function buildWallBoxes3D(
  wall: WallElement,
  model: BimModel
): WallBox3D[] {
  const totalLen = getWallLengthMm(wall);
  if (totalLen <= 0) return [];

  const level = model.levels.find((l) => l.id === wall.baseLevelId);
  const baseElevation = level ? level.elevation : 0;
  const [dx, dz] = getWallDirection(wall);
  const isHorizontalX = Math.abs(dx) >= Math.abs(dz);

  const hostedDoors = model.elements
    .filter(
      (e): e is DoorElement | WindowElement =>
        (e.type === 'door' || e.type === 'window') &&
        e.hostWallId === wall.id &&
        e.offset >= 0 &&
        e.offset + e.width <= totalLen &&
        e.sill >= 0 &&
        e.sill + e.height <= wall.height
    )
    .sort((a, b) => a.offset - b.offset);

  // Reject overlapping intervals before projecting geometry
  for (let i = 0; i < hostedDoors.length; i++) {
    for (let j = i + 1; j < hostedDoors.length; j++) {
      const a = hostedDoors[i];
      const b = hostedDoors[j];
      if (
        Math.max(a.offset, b.offset) <
          Math.min(a.offset + a.width, b.offset + b.width) &&
        Math.max(a.sill, b.sill) <
          Math.min(a.sill + a.height, b.sill + b.height)
      ) {
        // Fallback to single solid wall if invalid overlap
        return [makeSpanBox(wall, baseElevation, 0, totalLen, 0, wall.height, isHorizontalX, dx, dz, `${wall.id}:full`)];
      }
    }
  }

  if (hostedDoors.length === 0) {
    return [
      makeSpanBox(
        wall,
        baseElevation,
        0,
        totalLen,
        0,
        wall.height,
        isHorizontalX,
        dx,
        dz,
        `${wall.id}:full`
      ),
    ];
  }

  const boxes: WallBox3D[] = [];
  let cursor = 0;

  for (const door of hostedDoors) {
    // Left strip before door
    if (door.offset > cursor) {
      boxes.push(
        makeSpanBox(
          wall,
          baseElevation,
          cursor,
          door.offset,
          0,
          wall.height,
          isHorizontalX,
          dx,
          dz,
          `${wall.id}:left:${door.id}`
        )
      );
    }

    // Below-sill strip if sill > 0
    if (door.sill > 0) {
      boxes.push(
        makeSpanBox(
          wall,
          baseElevation,
          door.offset,
          door.offset + door.width,
          0,
          door.sill,
          isHorizontalX,
          dx,
          dz,
          `${wall.id}:sill:${door.id}`
        )
      );
    }

    // Lintel strip above door
    const topOfDoor = door.sill + door.height;
    if (topOfDoor < wall.height) {
      boxes.push(
        makeSpanBox(
          wall,
          baseElevation,
          door.offset,
          door.offset + door.width,
          topOfDoor,
          wall.height,
          isHorizontalX,
          dx,
          dz,
          `${wall.id}:lintel:${door.id}`
        )
      );
    }

    cursor = door.offset + door.width;
  }

  // Right strip after last door
  if (cursor < totalLen) {
    boxes.push(
      makeSpanBox(
        wall,
        baseElevation,
        cursor,
        totalLen,
        0,
        wall.height,
        isHorizontalX,
        dx,
        dz,
        `${wall.id}:right`
      )
    );
  }

  return boxes;
}

function makeSpanBox(
  wall: WallElement,
  baseElevation: number,
  fromOffset: number,
  toOffset: number,
  bottomY: number,
  topY: number,
  isHorizontalX: boolean,
  dx: number,
  dz: number,
  key: string
): WallBox3D {
  const spanLen = toOffset - fromOffset;
  const midOffset = (fromOffset + toOffset) / 2;
  const spanHeight = topY - bottomY;

  const cx = wall.start[0] + dx * midOffset;
  const cz = wall.start[1] + dz * midOffset;
  const cy = baseElevation + bottomY + spanHeight / 2;

  const sizeX = isHorizontalX ? spanLen : wall.thickness;
  const sizeZ = isHorizontalX ? wall.thickness : spanLen;

  return {
    key,
    wallId: wall.id,
    centerMm: [cx, cy, cz],
    sizeMm: [sizeX, spanHeight, sizeZ],
  };
}
