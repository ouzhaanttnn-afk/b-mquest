import { createInitialSession, type CommandResult, type MissionSessionState } from '../domain/commands';
import { commitModelTransaction } from '../domain/commandCore';
import { createGridCommand } from '../domain/commandsExtended';
import { createViewOp } from '../domain/documentation';
import { createFloorOp, setLevelElevationOp } from '../domain/modelOps';
import type { BimModel, Level, Point, WallElement } from '../domain/types';
import { CURTAIN_TYPE, placeColumns, setTypeParams, tallRectangle } from './engine';
import { CAMPAIGN_TASK, levelTap, step, type HouseDef, type LevelDef } from './model';
import { createFloorCommand, createRoofCommand } from '../domain/commands';

/**
 * Final: "Gökdelen". An 18 × 18 m tower of 19 storeys and a roof, built the
 * way a Revit model of a high-rise is set up: levels (Array), grids, columns
 * at the grid crossings, a core, one typical floor pasted to every level, a
 * curtain wall facade, a flat roof — and last, the Revit 2027 assistant:
 * prompt, apply, and check what it did.
 */

const W = 18000;
const GEOM = { w: W, d: W, wallH: 3500 };
const AXES = [0, 9000, 18000];
const CORE: [Point, Point] = [[6000, 6000], [12000, 12000]];
const FOOTPRINT: Point[] = [[0, 0], [W, 0], [W, W], [0, W]];
export const TOWER_FLOORS = 20; // levels above ground: 19 floors + roof
const OLD_STOREY = 3500;
const NEW_STOREY = 4000;
/** The assistant's planted mistake: one level 50 cm short. */
const SLIP_FLOOR = 13;

const upper = (m: BimModel): Level[] => m.levels.filter((l) => l.id !== 'l0').sort((a, b) => a.elevation - b.elevation);
const top = (m: BimModel) => upper(m)[upper(m).length - 1];
const walls = (m: BimModel) => m.elements.filter((e): e is WallElement => e.type === 'wall');
const curtainWalls = (m: BimModel) => walls(m).filter((w) => w.typeId === CURTAIN_TYPE.id);
const curtainType = (m: BimModel) => m.types?.find((t) => t.id === CURTAIN_TYPE.id);
const hasGrid = (m: BimModel, vertical: boolean, at: number) =>
  m.elements.some((e) => e.type === 'grid' && (vertical ? e.start[0] === e.end[0] && e.start[0] === at : e.start[1] === e.end[1] && e.start[1] === at));
const rectWalls = (list: WallElement[], a: Point, b: Point) => {
  const xs = list.flatMap((w) => [w.start[0], w.end[0]]);
  const zs = list.flatMap((w) => [w.start[1], w.end[1]]);
  return list.length === 4 && Math.min(...xs) === a[0] && Math.max(...xs) === b[0] && Math.min(...zs) === a[1] && Math.max(...zs) === b[1];
};
const reachesTop = (m: BimModel, w: WallElement) => !!top(m) && w.topConstraint === top(m).id;

/** Renames the upper levels bottom to top: Kat 1 … and the highest one Çatı once the tower is complete. */
function renameLevels(m: BimModel): BimModel {
  const ups = upper(m);
  const names = new Map(ups.map((l, i) => [l.id, ups.length >= TOWER_FLOORS && i === ups.length - 1 ? 'Çatı' : `Kat ${i + 1}`]));
  return { ...m, levels: m.levels.map((l) => (names.has(l.id) ? { ...l, name: names.get(l.id)! } : l)) };
}

/** Modify › Array on the top level: `count` levels in all, the same storey height apart. */
export function arrayLevels(s: MissionSessionState, count: number): CommandResult {
  const ups = upper(s.model);
  const src = ups[ups.length - 1];
  if (!src) return { ok: false, state: s, error: { code: 'E_ARRAY', message: 'Önce bir kat çizgisi koy.' } };
  const below = ups.length > 1 ? ups[ups.length - 2].elevation : 0;
  const storey = src.elevation - below;
  const used = new Set(s.model.levels.map((l) => l.id));
  let n = s.model.levels.length;
  const added: Level[] = [];
  for (let i = 1; i < count; i++) {
    while (used.has(`l${n}`)) n++;
    used.add(`l${n}`);
    added.push({ id: `l${n}`, name: 'Kat', elevation: src.elevation + i * storey });
  }
  return commitModelTransaction(s, renameLevels({ ...s.model, levels: [...s.model.levels, ...added] }));
}

/** Paste Aligned to Selected Levels for the typical floor slab. */
function pasteFloorToAll(s: MissionSessionState): CommandResult {
  const src = s.model.elements.find((e) => e.type === 'floor');
  if (!src || src.type !== 'floor') return { ok: false, state: s, error: { code: 'E_PASTE', message: 'Önce Kat 1 döşemesini koy.' } };
  let m = s.model;
  const roof = top(m);
  for (const l of upper(m)) {
    if (l.id === src.levelId || l.id === roof.id) continue;
    if (m.elements.some((e) => e.type === 'floor' && e.levelId === l.id)) continue;
    const op = createFloorOp(m, { levelId: l.id, boundary: src.boundary, thickness: src.thickness, name: 'Tipik döşeme' });
    if (!op.ok) return { ok: false, state: s, error: op.error };
    m = op.model;
  }
  return commitModelTransaction(s, m);
}

/** Assistant: "Her kat için bir kat planı oluştur". */
function planEveryLevel(s: MissionSessionState): CommandResult {
  let m = s.model;
  for (const l of [m.levels[0], ...upper(m)]) {
    if (m.elements.some((e) => e.type === 'view' && e.kind === 'plan' && e.levelId === l.id)) continue;
    const op = createViewOp(m, { kind: 'plan', levelId: l.id, name: `Kat Planı - ${l.name}` });
    if (!op.ok) return { ok: false, state: s, error: op.error };
    m = op.model;
  }
  return commitModelTransaction(s, m);
}

/** Assistant: "Bütün katları 4 m yap" — and it slips on one level, as assistants do. */
function raiseStoreys(s: MissionSessionState): CommandResult {
  let m = s.model;
  // Top down, so no level ever passes the one above it.
  const ups = upper(m);
  for (let i = ups.length; i >= 1; i--) {
    const want = i * NEW_STOREY - (i === SLIP_FLOOR ? 500 : 0);
    const op = setLevelElevationOp(m, ups[i - 1].id, want);
    if (!op.ok) return { ok: false, state: s, error: op.error };
    m = op.model;
  }
  return commitModelTransaction(s, m);
}

const storeysRight = (m: BimModel) => upper(m).every((l, i) => l.elevation === (i + 1) * NEW_STOREY);

const fmt = (mm: number) => `+${(mm / 1000).toFixed(2).replace('.', ',')}`;

/** Grids A and 1 are in the project already, as an office template would have them. */
function base(): MissionSessionState {
  let s = createInitialSession(CAMPAIGN_TASK);
  s = step(s, createGridCommand(s, { start: [0, -1500], end: [0, W + 1500] }));
  s = step(s, createGridCommand(s, { start: [-1500, 0], end: [W + 1500, 0] }));
  return s;
}

const HOUSE5_LEVELS: LevelDef[] = [
  {
    id: 'h5-1',
    number: 1,
    title: { tr: 'Yirmi kat' },
    why: { tr: 'Gökdelende katları tek tek çizmezsin: ilk kat çizgisini koyar, Array (AR) ile aynı aralıkla çoğaltırsın. Number, ilk kat dahil toplam sayıdır.' },
    bridge: { tr: "AutoCAD'deki ARRAY gibi; ama her kopya Revit'te gerçek bir kattır ve kendi kat planı açılabilir." },
    view: 'elevation',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'first',
        command: 'level',
        goal: { tr: 'Level ile ilk katı +3,50’ye koy.' },
        ghost: [{ kind: 'elevation', at: OLD_STOREY, label: '+3,50' }],
        demo: [[0, 0], [0, OLD_STOREY]],
        levels: [{ at: OLD_STOREY, name: 'Kat 1' }],
        // The assistant later raises the storeys to 4 m; the first level still counts.
        done: (m) => [OLD_STOREY, NEW_STOREY].includes(upper(m)[0]?.elevation ?? -1),
        solve: (s) => step(s, levelTap(s, OLD_STOREY, [{ at: OLD_STOREY, name: 'Kat 1' }])),
        taps: 1,
      },
      {
        id: 'array',
        command: 'array',
        goal: { tr: 'Modify › Array ile Kat 1’i çoğalt: toplam 20 kat (Number: 20).' },
        ghost: [],
        demo: [],
        choices: () => [5, 10, 20].map((n) => ({ id: String(n), label: `Number: ${n}` })),
        choose: (s, id) => arrayLevels(s, Number(id)),
        done: (m) => upper(m).length >= TOWER_FLOORS,
        solve: (s) => step(s, arrayLevels(s, TOWER_FLOORS)),
        taps: 1,
      },
    ],
  },
  {
    id: 'h5-2',
    number: 2,
    title: { tr: 'Aks ağı' },
    why: { tr: 'Kolonlar aks kesişimlerine oturur. Gökdelende akslar yapının iskeletidir: 9 m açıklıklı, 3 × 3 bir ağ.' },
    bridge: { tr: 'A ve 1 aksı şablonda hazır; sen B, C, 2 ve 3’ü çiz.' },
    view: 'plan',
    geom: GEOM,
    par: 10,
    steps: [
      {
        id: 'grids',
        command: 'grid',
        goal: { tr: 'Dört aksı daha çiz: B, C (dikey) ve 2, 3 (yatay).' },
        ghost: [
          { kind: 'line', a: [9000, -1000], b: [9000, W + 1000], label: 'B' },
          { kind: 'line', a: [W, -1000], b: [W, W + 1000], label: 'C' },
          { kind: 'line', a: [-1000, 9000], b: [W + 1000, 9000], label: '2' },
          { kind: 'line', a: [-1000, W], b: [W + 1000, W], label: '3' },
        ],
        demo: [[9000, -1000], [9000, W + 1000]],
        done: (m) => AXES.every((a) => hasGrid(m, true, a) && hasGrid(m, false, a)),
        solve: (s) => {
          let x = s;
          for (const [a, b] of [
            [[9000, -1000], [9000, W + 1000]],
            [[W, -1000], [W, W + 1000]],
            [[-1000, 9000], [W + 1000, 9000]],
            [[-1000, W], [W + 1000, W]],
          ] as Array<[Point, Point]>) x = step(x, createGridCommand(x, { start: a, end: b }));
          return x;
        },
        taps: 8,
      },
    ],
  },
  {
    id: 'h5-3',
    number: 3,
    title: { tr: 'Kolonlar' },
    why: { tr: 'Structure › Column ile kolon konur. "At Grids" seçeneği seçili aksların bütün kesişimlerine tek seferde kolon koyar. Kolon zeminden çatıya kadar yükselir.' },
    bridge: { tr: "AutoCAD'de kolon bloğunu tek tek kopyalarsın; Revit'te kolonlar akslara ve katlara bağlı nesnelerdir." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'columns',
        command: 'column',
        goal: { tr: 'Structure sekmesinden Column’u seç, At Grids’e geç ve plana dokun.' },
        ghost: AXES.flatMap((x) => AXES.map((z) => ({ kind: 'area' as const, points: [[x - 500, z - 500], [x + 500, z - 500], [x + 500, z + 500], [x - 500, z + 500]] as Point[] }))),
        demo: [[9000, 9000]],
        done: (m) => AXES.every((x) => AXES.every((z) => m.elements.some((e) => e.type === 'column' && e.at[0] === x && e.at[1] === z))),
        solve: (s) => step(s, placeColumns(s, 'l0', AXES.flatMap((x) => AXES.map((z) => [x, z] as Point)))),
        taps: 1,
      },
    ],
  },
  {
    id: 'h5-4',
    number: 4,
    title: { tr: 'Çekirdek' },
    why: { tr: 'Çekirdek asansörleri ve merdivenleri taşıyan beton perdedir; binayı rüzgâra karşı da tutar. Duvarın üstünü en üst kata bağlarsın (Top Constraint): kule yükselirse çekirdek de uzar.' },
    bridge: { tr: "AutoCAD'de her katta çekirdeği yeniden çizersin; Revit'te tek bir duvar zeminden çatıya çıkar." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'core',
        command: 'wall',
        goal: { tr: 'Wall › Rectangle ile ortadaki çekirdeği çiz; duvarlar çatıya kadar yükselir.' },
        ghost: [{ kind: 'area', points: [CORE[0], [CORE[1][0], CORE[0][1]], CORE[1], [CORE[0][0], CORE[1][1]]], label: 'Çekirdek' }],
        demo: [CORE[0], CORE[1]],
        fullHeight: true,
        done: (m) => {
          const core = walls(m).filter((w) => !w.typeId && reachesTop(m, w));
          return rectWalls(core, CORE[0], CORE[1]);
        },
        solve: (s) => step(s, tallRectangle(s, 'l0', CORE[0], CORE[1], 'generic', true)),
        taps: 2,
      },
    ],
  },
  {
    id: 'h5-5',
    number: 5,
    title: { tr: 'Tipik kat' },
    why: { tr: 'Gökdelenin katları birbirinin aynısıdır (tipik kat). Bir döşemeyi çizer, sonra Paste › Aligned to Selected Levels ile bütün katlara aynı yere yapıştırırsın.' },
    bridge: { tr: "AutoCAD'de katları ayrı dosyalara kopyalarsın; Revit'te tek döşeme bütün katlara hizalı yapıştırılır." },
    view: 'plan',
    geom: GEOM,
    par: 4,
    steps: [
      {
        id: 'slab',
        command: 'floor',
        goal: { tr: 'Kat 1 planındasın. Floor ile içeri dokun, ✓ ile bitir.' },
        ghost: [{ kind: 'area', points: FOOTPRINT, label: 'Tipik döşeme' }],
        demo: [[W / 2, 3000]],
        on: 'l1',
        outline: FOOTPRINT,
        done: (m) => m.elements.some((e) => e.type === 'floor' && e.levelId === 'l1'),
        solve: (s) => step(s, createFloorCommand(s, { levelId: 'l1', boundary: FOOTPRINT })),
        taps: 2,
      },
      {
        id: 'paste',
        command: 'paste',
        goal: { tr: 'Döşeme seçili. Paste Aligned ile bütün katlara yapıştır.' },
        ghost: [],
        demo: [],
        on: 'l1',
        choices: () => [
          { id: 'all', label: 'Bütün katlar (Kat 2 – Kat 19)' },
          { id: 'one', label: 'Yalnız Kat 2' },
        ],
        choose: (s, id) => {
          if (id !== 'all') return { error: 'Yalnız bir kat yetmez: tipik kat bütün katlara gider.' };
          return pasteFloorToAll(s);
        },
        done: (m) => m.elements.filter((e) => e.type === 'floor').length >= TOWER_FLOORS - 1,
        solve: (s) => step(s, pasteFloorToAll(s)),
        taps: 1,
      },
    ],
  },
  {
    id: 'h5-6',
    number: 6,
    title: { tr: 'Cam cephe' },
    why: { tr: 'Gökdelenin cephesi bir Curtain Wall’dur: Wall komutunda Type Selector’dan seçilir. Curtain Grid camı böler, Mullion çerçeveleri ekler. Izgarayı tipte değiştirirsen bütün cepheler birden değişir.' },
    bridge: { tr: "AutoCAD'de her camı ayrı çizersin; Revit'te cephe tek bir nesnedir, ızgarası tipinden gelir." },
    view: 'plan',
    geom: GEOM,
    par: 6,
    steps: [
      {
        id: 'curtain',
        command: 'wall',
        goal: { tr: 'Wall’ı seç, tipi Curtain Wall yap, Rectangle ile binanın dışına dokun.' },
        ghost: [{ kind: 'area', points: FOOTPRINT, label: 'Cam cephe' }],
        demo: [[0, 0], [W, W]],
        fullHeight: true,
        done: (m) => rectWalls(curtainWalls(m).filter((w) => reachesTop(m, w)), [0, 0], [W, W]),
        solve: (s) => step(s, tallRectangle(s, 'l0', [0, 0], [W, W], 'curtain', true)),
        taps: 2,
      },
      {
        id: 'grid',
        command: 'curtaingrid',
        goal: { tr: 'Curtain Grid ile bir cepheye dokun: cam 1,5 m’de bölünsün.' },
        ghost: [{ kind: 'line', a: [0, 0], b: [W, 0], label: 'Cepheye dokun' }],
        demo: [[W / 2, 0]],
        done: (m) => Number(curtainType(m)?.params.gridU ?? 0) > 0,
        solve: (s) => step(s, setTypeParams(s, CURTAIN_TYPE.id, { gridU: 1500 })),
        taps: 1,
      },
      {
        id: 'mullion',
        command: 'mullion',
        goal: { tr: 'Mullion ile cepheye dokun: çerçeveler eklensin.' },
        ghost: [{ kind: 'line', a: [0, 0], b: [W, 0] }],
        demo: [[W / 2, 0]],
        done: (m) => Number(curtainType(m)?.params.mullion ?? 0) === 1,
        solve: (s) => step(s, setTypeParams(s, CURTAIN_TYPE.id, { mullion: 1 })),
        taps: 1,
      },
    ],
  },
  {
    id: 'h5-7',
    number: 7,
    title: { tr: 'Düz çatı' },
    why: { tr: 'Gökdelenin çatısı düzdür: Roof by Footprint’te eğimi kapatırsın (Defines Slope kapalı). Çatı en üst kata, Çatı seviyesine oturur.' },
    bridge: { tr: "Eğimsiz çatı da bir Roof nesnesidir; Revit'te ayrı bir döşeme gibi çizilmez." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'roof',
        command: 'roof',
        goal: { tr: 'Roof ile içeri dokun, ✓ ile bitir: düz çatı otursun.' },
        ghost: [{ kind: 'area', points: FOOTPRINT, label: 'Düz çatı' }],
        demo: [[W / 2, W / 2]],
        roofSlope: 0,
        done: (m) => m.elements.some((e) => e.type === 'roof' && e.slope === 0 && e.baseLevelId === top(m)?.id),
        solve: (s) => step(s, createRoofCommand(s, { baseLevelId: top(s.model).id, footprint: FOOTPRINT, slope: 0, overhang: 0 })),
        taps: 2,
      },
    ],
  },
  {
    id: 'h5-8',
    number: 8,
    title: { tr: 'Asistan' },
    why: { tr: 'Revit 2027’deki Autodesk Assistant, yazdığın isteği Revit komutlarına çevirir. Hızlıdır ama tasarım yapmaz ve hata yapabilir: sonucu modelde sen kontrol edersin.' },
    bridge: { tr: 'Asistan bir çırak gibidir: net iş ver, sonra işini kontrol et.' },
    view: 'plan',
    geom: GEOM,
    par: 4,
    steps: [
      {
        id: 'plans',
        command: 'assistant',
        goal: { tr: 'Assistant sekmesini aç ve asistana işe yarar bir istek ver.' },
        ghost: [],
        demo: [],
        choices: () => [
          { id: 'design', label: '“Benim için bir gökdelen tasarla.”' },
          { id: 'plans', label: '“Her kat için bir kat planı oluştur.”' },
          { id: 'hundred', label: '“Kuleyi 100 kata çıkar.”' },
        ],
        choose: (s, id) =>
          id === 'plans'
            ? planEveryLevel(s)
            : id === 'design'
              ? { error: 'Asistan tasarımı senin yerine yapmaz; net ve tek bir iş ister.', wrong: true }
              : { error: 'Kat sayısı tasarım kararıdır; asistan bunu kendi başına değiştirmemeli.', wrong: true },
        done: (m) => m.elements.filter((e) => e.type === 'view' && e.kind === 'plan').length >= m.levels.length,
        solve: (s) => step(s, planEveryLevel(s)),
        taps: 1,
      },
      {
        id: 'raise',
        command: 'assistant',
        goal: { tr: 'Müşteri katları 4 m istiyor. Asistana söyle.' },
        ghost: [],
        demo: [],
        choices: () => [
          { id: 'raise', label: '“Bütün kat yüksekliklerini 3,5 m’den 4 m’ye çıkar.”' },
          { id: 'walls', label: '“Duvarları 4 m yap.”' },
        ],
        choose: (s, id) =>
          id === 'raise'
            ? raiseStoreys(s)
            : { error: 'Duvarlar katlara bağlı; değişmesi gereken kat yükseklikleri (Level).', wrong: true },
        done: (m) => upper(m)[0]?.elevation === NEW_STOREY,
        solve: (s) => step(s, raiseStoreys(s)),
        taps: 1,
      },
      {
        id: 'review',
        command: 'review',
        goal: { tr: 'Asistan bir katı yanlış koydu. Review’u aç, listede hatalı katı bul.' },
        ghost: [],
        demo: [],
        choices: (m) => upper(m).map((l) => ({ id: l.id, label: `${l.name} · ${fmt(l.elevation)}` })),
        choose: (s, id) => {
          const ups = upper(s.model);
          const i = ups.findIndex((l) => l.id === id) + 1;
          const l = ups[i - 1];
          if (!l) return { error: 'Bir kat seç.' };
          if (l.elevation === i * NEW_STOREY) return { error: `${l.name} doğru: ${i} × 4 m = ${i * 4} m.`, wrong: true };
          const op = setLevelElevationOp(s.model, id, i * NEW_STOREY);
          if (!op.ok) return { ok: false, state: s, error: op.error };
          return commitModelTransaction(s, op.model);
        },
        done: storeysRight,
        solve: (s) => {
          const ups = upper(s.model);
          const l = ups[SLIP_FLOOR - 1];
          const op = setLevelElevationOp(s.model, l.id, SLIP_FLOOR * NEW_STOREY);
          if (!op.ok) throw new Error('review');
          return step(s, commitModelTransaction(s, op.model));
        },
        taps: 1,
      },
    ],
  },
];

export const HOUSE5_DEF: HouseDef = {
  id: 'gokdelen',
  title: { tr: 'Gökdelen' },
  brief: { tr: 'Final: 20 katlı cam kule. Array, kolon, çekirdek, tipik kat, cam cephe ve Revit 2027 asistanı.' },
  levels: HOUSE5_LEVELS,
  icon: 'tower',
  finale: true,
  nameChoices: [],
  base,
};
