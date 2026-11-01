import { createInitialSession, type MissionSessionState } from '../domain/commands';
import { createDimensionCommand, createSheetCommand, createTagCommand, createViewCommand, placeOnSheetCommand } from '../domain/commandsDocs';
import type { BimModel, Point, WallElement } from '../domain/types';
import { HOUSE, HOUSE1_DEF } from './house1';
import { CAMPAIGN_TASK, startModelFor, step, type HouseDef, type LevelDef } from './model';

/**
 * Üçüncü ev: "Teslim". Bahçe Evi bitti; şimdi teslim paftasını hazırlarsın:
 * ölçüler, kapı ve pencere etiketleri, cephe, kesit ve A3 pafta.
 */

const { w: W, d: D } = HOUSE;
const GEOM = { w: W, d: D, wallH: HOUSE.wallH };

const walls = (m: BimModel) => m.elements.filter((e): e is WallElement => e.type === 'wall');
const wallAt = (m: BimModel, vertical: boolean, at: number) =>
  walls(m).find((w) =>
    vertical ? w.start[0] === at && w.end[0] === at && Math.abs(w.end[1] - w.start[1]) === D : w.start[1] === at && w.end[1] === at
  );

const hasDim = (m: BimModel, a?: WallElement, b?: WallElement) =>
  !!a &&
  !!b &&
  m.elements.some((e) => e.type === 'dimension' && ((e.wallA === a.id && e.wallB === b.id) || (e.wallA === b.id && e.wallB === a.id)));

const openingsTagged = (m: BimModel) => {
  const ids = m.elements.filter((e) => e.type === 'door' || e.type === 'window').map((e) => e.id);
  return ids.length > 0 && ids.every((id) => m.elements.some((t) => t.type === 'tag' && t.targetId === id));
};

const elevation = (m: BimModel, dir: string) => m.elements.find((e) => e.type === 'view' && e.kind === 'elevation' && e.direction === dir);
const anySection = (m: BimModel) =>
  m.elements.some((e) => {
    if (e.type !== 'view' || e.kind !== 'section' || !e.cutLine) return false;
    const [[ax, az], [bx, bz]] = e.cutLine;
    // Crosses the whole house, one way or the other.
    return (az === bz && az > 0 && az < D && Math.min(ax, bx) <= 0 && Math.max(ax, bx) >= W) ||
      (ax === bx && ax > 0 && ax < W && Math.min(az, bz) <= 0 && Math.max(az, bz) >= D);
  });
const planView = (m: BimModel) => m.elements.find((e) => e.type === 'view' && e.kind === 'plan');
const sheetWith = (m: BimModel) => {
  const sheet = m.elements.find((e) => e.type === 'sheet');
  if (!sheet || sheet.type !== 'sheet') return null;
  const kinds = sheet.placements.map((p) => m.elements.find((v) => v.id === p.viewId)).map((v) => (v && v.type === 'view' ? v.kind : ''));
  return kinds;
};

/** Start: the finished Bahçe Evi with its floor plan view, as Revit has one per level. */
function base(): MissionSessionState {
  const s = createInitialSession(CAMPAIGN_TASK, { model: startModelFor(HOUSE1_DEF, HOUSE1_DEF.levels.length), revealedHints: [] });
  return step(s, createViewCommand(s, { kind: 'plan', levelId: 'l0', name: 'Kat Planı - Zemin Kat' }));
}

const LEFT: Point = [0, D / 2];
const RIGHT: Point = [W, D / 2];
const FRONT: Point = [W / 2, 0];
const BACK: Point = [W / 2, D];

const HOUSE3_LEVELS: LevelDef[] = [
  {
    id: 'h3-1',
    number: 1,
    title: { tr: 'Ölçü' },
    why: { tr: 'Aligned Dimension iki duvarı birbirine ölçer. Ölçü modelden gelir: duvarı taşırsan ölçü kendiliğinden değişir.' },
    bridge: { tr: "AutoCAD'deki DIMALIGNED gibi, ama ölçü duvara bağlıdır ve hiç eskimez." },
    view: 'plan',
    geom: GEOM,
    par: 5,
    steps: [
      {
        id: 'width',
        command: 'dimension',
        goal: { tr: 'Aligned’ı seç: önce sol, sonra sağ dış duvara dokun.' },
        ghost: [
          { kind: 'line', a: [0, 0], b: [0, D] },
          { kind: 'line', a: [W, 0], b: [W, D] },
        ],
        demo: [LEFT, RIGHT],
        done: (m) => hasDim(m, wallAt(m, true, 0), wallAt(m, true, W)),
        solve: (s) => step(s, createDimensionCommand(s, wallAt(s.model, true, 0)!.id, wallAt(s.model, true, W)!.id)),
        taps: 2,
      },
      {
        id: 'depth',
        command: 'dimension',
        goal: { tr: 'Şimdi derinlik: ön duvara, sonra arka duvara dokun.' },
        ghost: [
          { kind: 'line', a: [0, 0], b: [W, 0] },
          { kind: 'line', a: [0, D], b: [W, D] },
        ],
        demo: [FRONT, BACK],
        done: (m) => hasDim(m, wallAt(m, false, 0), wallAt(m, false, D)),
        solve: (s) => step(s, createDimensionCommand(s, wallAt(s.model, false, 0)!.id, wallAt(s.model, false, D)!.id)),
        taps: 2,
      },
    ],
  },
  {
    id: 'h3-2',
    number: 2,
    title: { tr: 'Kapı ve pencere etiketi' },
    why: { tr: 'Tag by Category kapıya ve pencereye etiket koyar. Etiket nesnenin numarasını (Mark) modelden okur; kapı listesi de aynı bilgiyi kullanır.' },
    bridge: { tr: "AutoCAD'de etiketi elle yazarsın; Revit'te etiket nesnenin bilgisini gösterir, elle değiştirmen gerekmez." },
    view: 'plan',
    geom: GEOM,
    par: 4,
    steps: [
      {
        id: 'tags',
        command: 'tag',
        goal: { tr: 'Annotate’ten Tag by Category’yi seç; kapıya ve iki pencereye dokun.' },
        ghost: [
          { kind: 'opening', a: [2550, 0], b: [3450, 0], label: 'Kapı' },
          { kind: 'opening', a: [2400, D], b: [3600, D], label: 'Pencere' },
          { kind: 'opening', a: [7400, D], b: [8600, D], label: 'Pencere' },
        ],
        demo: [[3000, 0], [3000, D], [8000, D]],
        done: openingsTagged,
        solve: (s) => {
          let x = s;
          for (const o of s.model.elements.filter((e) => e.type === 'door' || e.type === 'window')) x = step(x, createTagCommand(x, o.id));
          return x;
        },
        taps: 3,
      },
    ],
  },
  {
    id: 'h3-3',
    number: 3,
    title: { tr: 'Cepheler' },
    why: { tr: 'Elevation, evin bir yüzünü dışarıdan gösteren görünümdür. İşaretini evin dışına koyarsın; Revit cepheyi modelden çizer.' },
    bridge: { tr: "AutoCAD'de cepheyi plandan izdüşürerek çizersin; Revit'te cephe modelden kendiliğinden çıkar." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    reveal: 'elevation',
    steps: [
      {
        id: 'elevations',
        command: 'elevation',
        goal: { tr: 'View’dan Elevation’ı seç: evin altına (güney) ve üstüne (kuzey) dokun.' },
        ghost: [
          { kind: 'area', points: [[2000, D + 700], [8000, D + 700], [8000, D + 1700], [2000, D + 1700]], label: 'Güney' },
          { kind: 'area', points: [[2000, -1700], [8000, -1700], [8000, -700], [2000, -700]] },
        ],
        demo: [[W / 2, D + 1200], [W / 2, -1200]],
        done: (m) => !!elevation(m, 'S') && !!elevation(m, 'N'),
        solve: (s) => {
          const x = step(s, createViewCommand(s, { kind: 'elevation', direction: 'N' }));
          return step(x, createViewCommand(x, { kind: 'elevation', direction: 'S' }));
        },
        taps: 2,
      },
    ],
  },
  {
    id: 'h3-4',
    number: 4,
    title: { tr: 'Kesit' },
    why: { tr: 'Teslim paftasında en az bir kesit olur: duvar, döşeme ve çatı yüksekliklerini gösterir. Kesiti iki odadan geçir.' },
    bridge: { tr: "Kesit, modelin canlı bir görünümüdür; çatıyı değiştirirsen kesit de değişir." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    reveal: 'section',
    steps: [
      {
        id: 'section',
        command: 'section',
        goal: { tr: 'Section ile iki odadan geçen yatay bir kesit çiz.' },
        ghost: [{ kind: 'line', a: [-1000, 4000], b: [W + 1000, 4000], label: 'Kesit' }],
        demo: [[-1000, 4000], [W + 1000, 4000]],
        done: anySection,
        solve: (s) => step(s, createViewCommand(s, { kind: 'section', cutLine: [[-1000, 4000], [W + 1000, 4000]] })),
        taps: 2,
      },
    ],
  },
  {
    id: 'h3-5',
    number: 5,
    title: { tr: 'Pafta' },
    why: { tr: 'Sheet (pafta) çıktının kâğıdıdır. Görünümleri paftaya yerleştirirsin; model değişince paftadaki çizimler de güncellenir.' },
    bridge: { tr: "AutoCAD'deki Layout gibi, ama görünümler modele bağlı; ayrı ayrı güncellemen gerekmez." },
    view: 'plan',
    geom: GEOM,
    par: 4,
    reveal: 'sheet',
    steps: [
      {
        id: 'sheet',
        command: 'sheet',
        goal: { tr: 'View sekmesinde Sheet’i seç ve A3 paftayı oluştur.' },
        ghost: [],
        demo: [],
        done: (m) => m.elements.some((e) => e.type === 'sheet'),
        solve: (s) => step(s, createSheetCommand(s, { number: 'A-101', name: 'Planlar ve Cepheler' })),
        taps: 1,
      },
      {
        id: 'place',
        command: 'place',
        goal: { tr: 'Place View ile kat planını ve Güney cephesini paftaya yerleştir.' },
        ghost: [],
        demo: [],
        done: (m) => {
          const kinds = sheetWith(m);
          return !!kinds && kinds.includes('plan') && kinds.includes('elevation');
        },
        solve: (s) => {
          const sheet = s.model.elements.find((e) => e.type === 'sheet')!;
          let x = step(s, placeOnSheetCommand(s, sheet.id, planView(s.model)!.id));
          x = step(x, placeOnSheetCommand(x, sheet.id, elevation(x.model, 'S')!.id));
          return x;
        },
        taps: 2,
      },
    ],
  },
];

export const HOUSE3_DEF: HouseDef = {
  id: 'teslim',
  title: { tr: 'Teslim' },
  brief: { tr: 'Bahçe Evi’nin teslim paftası: ölçü, etiket, cephe, kesit ve A3 pafta.' },
  levels: HOUSE3_LEVELS,
  icon: 'sheet',
  nameChoices: ['Salon', 'Yatak Odası'],
  base,
};
