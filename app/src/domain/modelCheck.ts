import {
  enclosedRegions,
  isOpening,
  roomBoundary,
  wallLengthMm,
  wallsOf,
  wallTopElevation,
} from './derived';
import type { BimElement, BimModel, Point, RoomElement, WindowElement } from './types';

export type ModelIssueCode =
  | 'ROOM_OPEN_BOUNDARY'
  | 'ROOM_NOT_PLACED'
  | 'WALL_WRONG_LEVEL'
  | 'WALL_TOP_MISMATCH'
  | 'HOST_MISSING'
  | 'OPENING_OUT_OF_WALL'
  | 'TYPE_INCONSISTENT'
  | 'SILL_INCONSISTENT'
  | 'ROOM_DATA_MISSING'
  | 'TAG_MISSING'
  | 'DIMENSION_MISSING';

export interface ModelIssue {
  code: ModelIssueCode;
  severity: 'error' | 'warning';
  elementIds: string[];
  message: string;
  /** Where in Revit this kind of problem is found and fixed. */
  revitHint: string;
  /** Plan position of the problem when it has one. */
  at?: Point;
}

/** Plain-language category used when the exact list is hidden. */
export const ISSUE_CATEGORY_TR: Record<ModelIssueCode, string> = {
  ROOM_OPEN_BOUNDARY: 'Oda sınırı',
  ROOM_NOT_PLACED: 'Oda yerleşimi',
  WALL_WRONG_LEVEL: 'Kat bağlantısı',
  WALL_TOP_MISMATCH: 'Duvar üst kotu',
  HOST_MISSING: 'Host ilişkisi',
  OPENING_OUT_OF_WALL: 'Açıklık sınırı',
  TYPE_INCONSISTENT: 'Tip tutarlılığı',
  SILL_INCONSISTENT: 'Parapet tutarlılığı',
  ROOM_DATA_MISSING: 'Oda verisi',
  TAG_MISSING: 'Etiket',
  DIMENSION_MISSING: 'Ölçülendirme',
};

/** The element type the issue lives on (used by the middle hint tier). */
export const ISSUE_ELEMENT_KIND_TR: Record<ModelIssueCode, string> = {
  ROOM_OPEN_BOUNDARY: 'oda ve duvar',
  ROOM_NOT_PLACED: 'oda',
  WALL_WRONG_LEVEL: 'duvar',
  WALL_TOP_MISMATCH: 'duvar',
  HOST_MISSING: 'kapı/pencere',
  OPENING_OUT_OF_WALL: 'kapı/pencere',
  TYPE_INCONSISTENT: 'tipli nesne',
  SILL_INCONSISTENT: 'pencere',
  ROOM_DATA_MISSING: 'oda',
  TAG_MISSING: 'kapı/pencere/oda',
  DIMENSION_MISSING: 'görünüm',
};

/** Most frequent value; null when there is no clear majority (tie). */
function majority<T>(items: Array<{ id: string; value: T }>): T | null {
  const counts = new Map<string, { value: T; n: number }>();
  for (const it of items) {
    const key = JSON.stringify(it.value);
    const cur = counts.get(key);
    if (cur) cur.n++;
    else counts.set(key, { value: it.value, n: 1 });
  }
  const ranked = [...counts.values()].sort((a, b) => b.n - a.n);
  if (ranked.length === 0) return null;
  if (ranked.length > 1 && ranked[0].n === ranked[1].n) return null;
  return ranked[0].value;
}

const minority = <T>(items: Array<{ id: string; value: T }>): string[] => {
  const m = majority(items);
  if (m === null) return [];
  const key = JSON.stringify(m);
  return items.filter((i) => JSON.stringify(i.value) !== key).map((i) => i.id);
};

const rectContains = (rects: Array<[number, number, number, number]>, p: Point) =>
  rects.some((r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3]);

export interface CheckOptions {
  /** Every enclosed area must hold a Room (opt-in, like Revit's room schedule). */
  requireRooms?: boolean;
  /** Every door, window and room must carry a tag. */
  requireTags?: boolean;
  /** At least one dimension must exist. */
  requireDimensions?: boolean;
}

/** Opt-in checks are only on for missions whose goal asks for them. */
export function checkOptionsFor(
  criteria: Array<{ type: string; codes?: string[] }>
): CheckOptions {
  const codes = criteria
    .filter((c) => c.type === 'modelClean')
    .flatMap((c) => c.codes ?? []);
  return {
    requireRooms: codes.includes('ROOM_NOT_PLACED'),
    requireTags: codes.includes('TAG_MISSING'),
    requireDimensions: codes.includes('DIMENSION_MISSING'),
  };
}

/** Runs every model check; stable order (errors first, then by code). */
export function checkModel(model: BimModel, opts: CheckOptions = {}): ModelIssue[] {
  const issues: ModelIssue[] = [];
  const levels = new Set(model.levels.map((l) => l.id));
  const walls = wallsOf(model);
  const rooms = model.elements.filter((e): e is RoomElement => e.type === 'room');

  // ---- rooms -----------------------------------------------------------
  for (const room of rooms) {
    const b = roomBoundary(room, model);
    if (b.open) {
      issues.push({
        code: 'ROOM_OPEN_BOUNDARY',
        severity: 'error',
        elementIds: [room.id],
        at: b.gapAt,
        message: `${room.name} odasının sınırı kapalı değil${b.gapAt ? ` (boşluk ≈ ${b.gapAt[0]}, ${b.gapAt[1]})` : ''}.`,
        revitHint: 'Room Bounding duvarların uçlarını kontrol et: Modify → Trim/Extend to Corner.',
      });
    }
    if (room.number.trim() === '') {
      issues.push({
        code: 'ROOM_DATA_MISSING',
        severity: 'warning',
        elementIds: [room.id],
        message: `${room.id} (${room.name}) odasının numarası boş.`,
        revitHint: 'Room seç → Properties → Identity Data → Number.',
      });
    }
  }

  for (const levelId of opts.requireRooms ? levels : []) {
    const levelRooms = rooms.filter((r) => r.levelId === levelId);
    for (const region of enclosedRegions(model, levelId)) {
      const hasRoom = levelRooms.some((r) => rectContains(region.rects, r.seedPoint));
      if (!hasRoom) {
        issues.push({
          code: 'ROOM_NOT_PLACED',
          severity: 'warning',
          elementIds: [],
          at: region.seed,
          message: `Kapalı bir alan (${(region.area / 1_000_000).toFixed(1)} m²) var ama içine oda yerleştirilmemiş.`,
          revitHint: 'Architecture → Room → alanın içine tıkla.',
        });
      }
    }
  }

  // ---- walls -----------------------------------------------------------
  const wrongLevel = minority(walls.map((w) => ({ id: w.id, value: w.baseLevelId })));
  if (wrongLevel.length) {
    issues.push({
      code: 'WALL_WRONG_LEVEL',
      severity: 'error',
      elementIds: wrongLevel,
      message: `${wrongLevel.join(', ')} duvar(ları) diğerlerinden farklı bir kata bağlı.`,
      revitHint: 'Duvar seç → Properties → Constraints → Base Constraint.',
    });
  }

  for (const levelId of levels) {
    const onLevel = walls.filter((w) => w.baseLevelId === levelId);
    const bad = minority(onLevel.map((w) => ({ id: w.id, value: wallTopElevation(w, model) })));
    if (bad.length) {
      issues.push({
        code: 'WALL_TOP_MISMATCH',
        severity: 'error',
        elementIds: bad,
        message: `${bad.join(', ')} duvar(ları)nın üst kotu komşu duvarlardan farklı.`,
        revitHint: 'Duvar seç → Properties → Constraints → Top Constraint / Top Offset.',
      });
    }
  }

  // ---- openings --------------------------------------------------------
  for (const el of model.elements) {
    if (!isOpening(el)) continue;
    const host = walls.find((w) => w.id === el.hostWallId);
    if (!host) {
      issues.push({
        code: 'HOST_MISSING',
        severity: 'error',
        elementIds: [el.id],
        message: `${el.id} için taşıyıcı duvar (${el.hostWallId}) bulunamadı.`,
        revitHint: 'Kapı/pencere bir duvara bağlı olmalı: Properties → Host.',
      });
      continue;
    }
    if (el.offset + el.width > wallLengthMm(host) || el.sill + el.height > host.height) {
      issues.push({
        code: 'OPENING_OUT_OF_WALL',
        severity: 'error',
        elementIds: [el.id],
        message: `${el.id} açıklığı ${host.id} duvarının sınırları dışına taşıyor.`,
        revitHint: 'Açıklığı duvarın içine taşı: Properties → Offset / Sill / Height.',
      });
    }
  }

  // ---- type / sill consistency ------------------------------------------
  for (const kind of ['wall', 'door', 'window'] as const) {
    const typed = model.elements.filter(
      (e): e is BimElement & { typeId?: string } => e.type === kind
    );
    const withTypes = typed.filter((e) => e.typeId !== undefined);
    if (withTypes.length < 2) continue;
    const bad = minority(withTypes.map((e) => ({ id: e.id, value: e.typeId as string })));
    if (bad.length) {
      issues.push({
        code: 'TYPE_INCONSISTENT',
        severity: 'warning',
        elementIds: bad,
        message: `${bad.join(', ')} aynı işlevli diğer elemanlardan farklı tipte.`,
        revitHint: 'Eleman seç → Properties → Type Selector.',
      });
    }
  }

  const windows = model.elements.filter((e): e is WindowElement => e.type === 'window');
  const badSill = minority(windows.map((w) => ({ id: w.id, value: w.sill })));
  if (badSill.length) {
    issues.push({
      code: 'SILL_INCONSISTENT',
      severity: 'warning',
      elementIds: badSill,
      message: `${badSill.join(', ')} pencere(leri)nin parapet yüksekliği diğerlerinden farklı.`,
      revitHint: 'Pencere seç → Properties → Constraints → Sill Height.',
    });
  }

  // ---- documentation (opt-in) ----------------------------------------------
  if (opts.requireTags) {
    const tagged = new Set(
      model.elements.filter((e) => e.type === 'tag').map((e) => (e as { targetId: string }).targetId)
    );
    const missing = model.elements
      .filter((e) => (e.type === 'door' || e.type === 'window' || e.type === 'room') && !tagged.has(e.id))
      .map((e) => e.id);
    if (missing.length) {
      issues.push({
        code: 'TAG_MISSING',
        severity: 'warning',
        elementIds: missing,
        message: `${missing.join(', ')} etiketlenmemiş.`,
        revitHint: 'Annotate → Tag by Category → nesneye tıkla.',
      });
    }
  }
  if (opts.requireDimensions && !model.elements.some((e) => e.type === 'dimension')) {
    issues.push({
      code: 'DIMENSION_MISSING',
      severity: 'warning',
      elementIds: [],
      message: 'Modelde hiç ölçü (dimension) yok.',
      revitHint: 'Annotate → Aligned → iki duvara tıkla.',
    });
  }

  return issues.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) ||
      a.code.localeCompare(b.code) ||
      a.elementIds.join().localeCompare(b.elementIds.join())
  );
}

export interface IssueSummary {
  count: number;
  /** Distinct category labels in a stable order. */
  categories: string[];
  byCode: Partial<Record<ModelIssueCode, number>>;
}

export function summarizeIssues(issues: ModelIssue[]): IssueSummary {
  const byCode: Partial<Record<ModelIssueCode, number>> = {};
  for (const i of issues) byCode[i.code] = (byCode[i.code] ?? 0) + 1;
  const codes = Object.keys(byCode) as ModelIssueCode[];
  return {
    count: issues.length,
    categories: codes.map((c) => ISSUE_CATEGORY_TR[c]),
    byCode,
  };
}
