import type { MissionTask, TaskCriterion } from '../domain/types';
import type { RevitLessonMeta } from './revitLessons';

/**
 * Bölüm 7 — Final Proje. One house, seven stages: every stage starts from the
 * model the previous stage finished. No tool or button is named anywhere.
 */

export const FINAL_BRIEF =
  '65–80 m² tek katlı konut: Level sistemi, Grid, dış ve iç duvarlar, kapılar, pencereler, döşeme, çatı, oda bilgileri, ölçüler, kesit, görünüş, pafta ve temiz model.';

const ALL_CODES = [
  'ROOM_OPEN_BOUNDARY',
  'ROOM_NOT_PLACED',
  'WALL_WRONG_LEVEL',
  'WALL_TOP_MISMATCH',
  'HOST_MISSING',
  'OPENING_OUT_OF_WALL',
  'TYPE_INCONSISTENT',
  'SILL_INCONSISTENT',
  'ROOM_DATA_MISSING',
  'TAG_MISSING',
  'DIMENSION_MISSING',
];

const metric = (
  id: string,
  m: string,
  message: string,
  min?: number,
  max?: number
): TaskCriterion => ({
  id,
  type: 'metric',
  metric: m,
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
  message,
});

const C = {
  levels: metric('c_levels', 'levelCount', 'Projede en az 2 kat (Level) olmalı.', 2),
  gridV: metric('c_grid_v', 'gridVertical', 'En az 2 düşey aks çiz.', 2),
  gridH: metric('c_grid_h', 'gridHorizontal', 'En az 2 yatay aks çiz.', 2),
  area: metric('c_area', 'enclosedAreaM2', 'Dış kabuk 65–80 m² alanı kapatmalı.', 65, 80),
  walls: metric('c_walls', 'wallCount', 'Kabuk için en az 4 duvar gerekli.', 4),
  inner: metric('c_inner', 'wallCount', 'En az 1 iç duvar (toplam ≥ 5 duvar) gerekli.', 5),
  floor: metric('c_floor', 'floorCovers', 'Döşeme kabuğun alanını kaplamalı.', 1),
  roof: metric('c_roof', 'roofSeated', 'Çatı, duvar üst kotuna oturmalı.', 1),
  doors: metric('c_doors', 'doorCount', 'En az 2 kapı gerekli.', 2),
  windows: metric('c_windows', 'windowCount', 'En az 3 pencere gerekli.', 3),
  rooms: metric('c_rooms', 'roomCount', 'En az 2 oda tanımla.', 2),
  section: metric('c_section', 'sectionCount', 'Binayı kesen en az 1 kesit gerekli.', 1),
  elevation: metric('c_elev', 'elevationCount', 'En az 1 cephe görünümü gerekli.', 1),
  dims: metric('c_dims', 'dimensionCount', 'En az 2 ölçü (dimension) gerekli.', 2),
  sheet: metric('c_sheet', 'sheetPlanSection', 'Plan ve kesit içeren en az 1 pafta gerekli.', 1),
  shell: {
    id: 'c_shell',
    type: 'modelClean',
    codes: ['WALL_TOP_MISMATCH', 'WALL_WRONG_LEVEL', 'ROOM_OPEN_BOUNDARY'],
    message: 'Kabukta kot ve sınır uyarısı kalmamalı.',
  } as TaskCriterion,
  spaces: {
    id: 'c_spaces',
    type: 'modelClean',
    codes: ['ROOM_OPEN_BOUNDARY', 'ROOM_DATA_MISSING', 'ROOM_NOT_PLACED', 'HOST_MISSING', 'OPENING_OUT_OF_WALL', 'SILL_INCONSISTENT'],
    message: 'Oda ve açıklık uyarıları kalmamalı.',
  } as TaskCriterion,
  tags: {
    id: 'c_tags',
    type: 'modelClean',
    codes: ['TAG_MISSING'],
    message: 'Tüm kapı, pencere ve odalar etiketli olmalı.',
  } as TaskCriterion,
  clean: {
    id: 'c_clean',
    type: 'modelClean',
    codes: ALL_CODES,
    message: 'Model kontrolünde hiç uyarı kalmamalı.',
  } as TaskCriterion,
};

const ALL_FIELDS = [
  'height', 'thickness', 'name', 'start', 'end', 'baseLevelId', 'offset', 'width', 'sill', 'mark', 'fireRating',
  'hostWallId', 'topConstraint', 'topOffset', 'typeId', 'levelId', 'slope', 'overhang', 'number', 'risers',
  'riserHeight', 'treadDepth', 'topLevelId', 'direction', 'seedPoint', 'elevation', 'footprint', 'boundary',
  'typeParams', 'flip', 'scale', 'cutHeight', 'cropMinX', 'cropMaxX', 'cropMinZ', 'cropMaxZ', 'wallA', 'wallB',
  'placements',
] as const;

const ALL_CREATABLE = [
  'wall', 'door', 'window', 'floor', 'roof', 'stair', 'room', 'grid', 'view', 'dimension', 'tag', 'sheet',
] as const;

const rem = (concept: string): RevitLessonMeta['hintLevels'] => [
  `İpucu 1 (Alan): ${concept}`,
  'İpucu 2 (Nesne): Brifteki maddelerden hangisinin eksik olduğunu Kontrol Et sonucundan oku; yol gösterilmez.',
  'İpucu 3 (Kavram): Eksik maddenin hangi BIM kavramına (kat, aks, host, tip, görünüm) dayandığını düşün.',
  'Son Rehber: Bu bölümde araç ya da menü adı verilmez; yalnızca kavram hatırlatılır. Brifi yeniden oku ve modeli kendi çözümünle tamamla.',
];

interface Stage {
  objective: string;
  concept: string;
  criteria: TaskCriterion[];
  minutes: number;
}

export const FINAL_STAGES: Record<string, Stage> = {
  m44: {
    objective: `Proje Brifi — ${FINAL_BRIEF} Aşama 1/7: Projenin iskeletini kur: kat sistemi ve aks ağı.`,
    concept: 'Bir proje önce referanslarla (kat ve aks) kurulur; sonraki her eleman bunlara dayanır.',
    criteria: [C.levels, C.gridV, C.gridH],
    minutes: 10,
  },
  m45: {
    objective: 'Aşama 2/7: 65–80 m² alanı kapatan dış kabuğu kur; zemini kapat, çatıyı duvarlarla aynı kotta oturt.',
    concept: 'Kabuk bir kapalı sınırdır; döşeme alanı kaplar, çatı duvarın bittiği kotta başlar.',
    criteria: [C.area, C.walls, C.floor, C.roof, C.shell],
    minutes: 15,
  },
  m46: {
    objective: 'Aşama 3/7: Kabuğu iç duvarla bölerek iki oda tanımla; kapıları ve pencereleri yerleştir; oda adı ve numaralarını gir.',
    concept: 'Odalar kapalı sınır ister; kapı ve pencereler bir duvara bağlıdır; oda verisi eksiksiz olmalıdır.',
    criteria: [C.inner, C.doors, C.windows, C.rooms, C.spaces],
    minutes: 15,
  },
  m47: {
    objective: 'Aşama 4/7: Binayı anlatan görünümleri üret: bir kesit, bir cephe ve en az iki ölçü.',
    concept: 'Kesit ve cephe model verisinden çizilir; ölçü iki referans arasındaki gerçek mesafedir.',
    criteria: [C.section, C.elevation, C.dims],
    minutes: 12,
  },
  m48: {
    objective: 'Aşama 5/7: Plan ve kesiti A3 paftaya yerleştir ve kapı, pencere, odaları etiketle.',
    concept: 'Pafta görünümleri bir araya getirir; etiketler paftada okunacak veriyi nesneden alır.',
    criteria: [C.sheet, C.tags],
    minutes: 12,
  },
  m49: {
    objective: 'Aşama 6/7: Son kalite kontrolü. Modelde hiçbir tutarsızlık kalmasın; sorunları kendin bul.',
    concept: 'Teslimden önce model, her kategoride tutarlı ve eksiksiz olmalıdır.',
    criteria: [C.clean],
    minutes: 10,
  },
  m50: {
    objective: `Aşama 7/7 — Teslim. Brifin tamamını karşıla: ${FINAL_BRIEF}`,
    concept: 'Teslim, brifteki her maddenin birlikte sağlanmasıdır.',
    criteria: [
      C.levels, C.gridV, C.gridH, C.area, C.floor, C.roof, C.shell, C.inner, C.doors, C.windows,
      C.rooms, C.section, C.elevation, C.dims, C.sheet, C.clean,
    ],
    minutes: 10,
  },
};

/** What each brief item corresponds to in real Revit (shown on the delivery report). */
export const FINAL_CRITERION_NOTES: Record<string, string> = {
  c_levels: 'Revit: Datum → Level (kat kotları)',
  c_grid_v: 'Revit: Datum → Grid (düşey akslar)',
  c_grid_h: 'Revit: Datum → Grid (yatay akslar)',
  c_area: 'Revit: Room & Area → Area / Room alanı',
  c_walls: 'Revit: Architecture → Wall',
  c_inner: 'Revit: Architecture → Wall (iç duvarlar)',
  c_floor: 'Revit: Architecture → Floor (Pick Walls)',
  c_roof: 'Revit: Architecture → Roof by Footprint · Base Level',
  c_shell: 'Revit: Wall → Properties → Constraints (Base / Top)',
  c_doors: 'Revit: Architecture → Door (host duvar)',
  c_windows: 'Revit: Architecture → Window (host duvar)',
  c_rooms: 'Revit: Architecture → Room · Identity Data',
  c_spaces: 'Revit: Manage → Warnings (oda sınırı, host, açıklık)',
  c_section: 'Revit: View → Section',
  c_elev: 'Revit: View → Elevation',
  c_dims: 'Revit: Annotate → Aligned Dimension',
  c_sheet: 'Revit: View → Sheet + Place View',
  c_tags: 'Revit: Annotate → Tag by Category',
  c_clean: 'Revit: Manage → Review Warnings',
};

export function buildFinalMissionTask(
  id: string,
  meta: RevitLessonMeta,
  prerequisite: string
): MissionTask {
  const stage = FINAL_STAGES[id];
  return {
    schemaVersion: '1.0',
    contentVersion: '1.0.0',
    id,
    title: meta.title,
    objective: stage.objective,
    prerequisites: [prerequisite],
    estimatedMinutes: stage.minutes,
    initialModel: { levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }], elements: [] },
    permissions: {
      editableFields: [...ALL_FIELDS],
      creatableTypes: [...ALL_CREATABLE],
      deletableCreated: true,
      editableSeedIds: [],
    },
    hints: [
      { id: 'h1', text: rem(stage.concept)[0] },
      { id: 'h2', text: rem(stage.concept)[1] },
      { id: 'h3', text: rem(stage.concept)[2] },
    ],
    recap: `${meta.completionExplanation.whatYouDid}`,
    criteria: stage.criteria,
  };
}

/** Lesson text overrides: no tool names, no Revit paths while building. */
export function finalLessonOverrides(id: string): Partial<RevitLessonMeta> {
  const stage = FINAL_STAGES[id];
  return {
    objective: stage.objective,
    revitPath: 'Serbest modelleme — araç seçimi sende',
    hintLevels: rem(stage.concept),
    primaryFields: [],
    secondaryFields: [],
  };
}
