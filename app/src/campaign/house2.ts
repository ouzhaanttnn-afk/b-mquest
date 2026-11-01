import type { MissionSessionState } from '../domain/commands';
import { createViewCommand } from '../domain/commandsDocs';
import { copyWallsToLevelCommand, createRectangleWallsCommand, createStairCommand } from '../domain/commandsExtended';
import { createFloorCommand, createRoofCommand, createWallCommand } from '../domain/commands';
import { enclosedRegions } from '../domain/derived';
import type { BimModel, Point, WallElement } from '../domain/types';
import { placeOpening } from '../ui/workspace/toolActions';
import { floorOutlineWithOpening, stairInput, stairRect } from './engine';
import { levelTap, roofLevelId, step, type HouseDef, type LevelDef } from './model';

/**
 * İkinci ev: "İki Katlı Ev". 8 × 6 m, iki kat, sol duvar boyunca tek kollu
 * merdiven. Yeni komutlar: dikdörtgen duvar (Draw panel), Stair, Paste Aligned
 * to Selected Levels, merdiven boşluklu üst kat döşemesi ve Section.
 */

export const HOUSE2 = { w: 8000, d: 6000, split: 4000, wallH: 3000 };
const GEOM = { w: HOUSE2.w, d: HOUSE2.d, wallH: HOUSE2.wallH };
const { w: W, d: D, split: S } = HOUSE2;
const LEVELS = [
  { at: 3000, name: '1. Kat' },
  { at: 6000, name: 'Çatı' },
];
/** Stair corner: along the left wall, rising towards the back. */
const STAIR_AT: Point = [200, 600];

const wallsOn = (m: BimModel, levelId: string) =>
  m.elements.filter((e): e is WallElement => e.type === 'wall' && e.baseLevelId === levelId);
const levelId = (m: BimModel, at: number) => m.levels.find((l) => l.elevation === at)?.id ?? '';

const shellDone = (m: BimModel, splitToo: boolean) => {
  const regions = enclosedRegions(m, 'l0');
  const area = regions.reduce((s, r) => s + r.area, 0) / 1_000_000;
  const split = wallsOn(m, 'l0').some(
    (w) => w.start[0] === S && w.end[0] === S && Math.abs(w.end[1] - w.start[1]) === D
  );
  return Math.abs(area - (W * D) / 1_000_000) < 0.5 && (splitToo ? split && regions.length === 2 : regions.length >= 1);
};

const openingsOn = (m: BimModel, type: 'door' | 'window', z: number, onLevel: string): Point[] => {
  const out: Point[] = [];
  for (const o of m.elements) {
    if (o.type !== type) continue;
    const host = wallsOn(m, onLevel).find((w) => w.id === o.hostWallId);
    if (!host) continue;
    const len = Math.abs(host.end[0] - host.start[0]) + Math.abs(host.end[1] - host.start[1]);
    const k = (o.offset + o.width / 2) / len;
    const p: Point = [host.start[0] + (host.end[0] - host.start[0]) * k, host.start[1] + (host.end[1] - host.start[1]) * k];
    if (Math.abs(p[1] - z) <= 1) out.push(p);
  }
  return out;
};

const stairDone = (m: BimModel) =>
  m.elements.some((e) => {
    if (e.type !== 'stair' || e.baseLevelId !== 'l0' || e.topLevelId !== levelId(m, 3000)) return false;
    const [x0, z0, x1, z1] = stairRect(e);
    return x0 >= 100 && z0 >= 100 && x1 <= S - 100 && z1 <= D - 100 && x0 < 1500;
  });

const sectionDone = (m: BimModel) =>
  m.elements.some((e) => {
    if (e.type !== 'view' || e.kind !== 'section' || !e.cutLine) return false;
    const [[ax, az], [bx, bz]] = e.cutLine;
    return ax === bx && ax > STAIR_AT[0] && ax < STAIR_AT[0] + 1000 && Math.abs(bz - az) >= 4000;
  });

const front = (s: MissionSessionState, on: string) => wallsOn(s.model, on).find((w) => w.start[1] === 0 && w.end[1] === 0)!;

/** Upper floor outline the floor step expects (stair opening on the left). */
const UPPER_OUTLINE: Point[] = [[0, 0], [W, 0], [W, D], [0, D], [0, 5460], [1300, 5460], [1300, 500], [0, 500]];

const HOUSE2_LEVELS: LevelDef[] = [
  {
    id: 'h2-1',
    number: 1,
    title: { tr: 'İki kat' },
    why: { tr: "İki katlı bir evde her kat bir Level'dır. Üst kattaki duvar ve döşemeler 1. Kat'a, çatı en üstteki Level'a bağlanır." },
    bridge: { tr: "AutoCAD'de her kat ayrı bir çizimdir; Revit'te tek modelde üst üste duran katlardır." },
    view: 'elevation',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'levels',
        command: 'level',
        goal: { tr: '1. Kat’ı +3,00’e, Çatı’yı +6,00’ya koy.' },
        ghost: LEVELS.map((l) => ({ kind: 'elevation' as const, at: l.at, label: `+${(l.at / 1000).toFixed(2).replace('.', ',')}` })),
        demo: [[0, 0], [0, 3000], [0, 6000]],
        levels: LEVELS,
        done: (m) => LEVELS.every((t) => m.levels.some((l) => l.elevation === t.at)),
        solve: (s) => {
          let x = step(s, levelTap(s, 3000, LEVELS));
          x = step(x, levelTap(x, 6000, LEVELS));
          return x;
        },
        taps: 2,
      },
    ],
  },
  {
    id: 'h2-2',
    number: 2,
    title: { tr: 'Dikdörtgen duvar' },
    why: { tr: "Wall komutunun Draw panelinde çizim biçimleri vardır. Rectangle ile iki köşeye dokunarak dört duvarı birden çizersin; Line ile tek tek." },
    bridge: { tr: "AutoCAD'deki RECTANG gibi, ama sonuç dört gerçek duvar nesnesidir." },
    view: 'plan',
    geom: GEOM,
    par: 5,
    steps: [
      {
        id: 'rect',
        command: 'wall',
        goal: { tr: 'Wall’ı seç, Draw’dan Dikdörtgen’i seç, iki karşı köşeye dokun.' },
        ghost: [{ kind: 'area', points: [[0, 0], [W, 0], [W, D], [0, D]] }],
        demo: [[0, 0], [W, D]],
        done: (m) => shellDone(m, false),
        solve: (s) =>
          step(s, createRectangleWallsCommand(s, { x: 0, z: 0, width: W, depth: D, baseLevelId: 'l0', height: HOUSE2.wallH, thickness: 200 })),
        taps: 2,
      },
      {
        id: 'inner',
        command: 'wall',
        goal: { tr: 'Çizgi (Line) biçimine dön ve ortaya bir iç duvar çiz.' },
        ghost: [{ kind: 'line', a: [S, 0], b: [S, D] }],
        demo: [[S, 0], [S, D]],
        done: (m) => shellDone(m, true),
        solve: (s) =>
          step(s, createWallCommand(s, { name: 'Duvar', baseLevelId: 'l0', startX: S, startZ: 0, endX: S, endZ: D, height: HOUSE2.wallH, thickness: 200 })),
        taps: 2,
      },
    ],
  },
  {
    id: 'h2-3',
    number: 3,
    title: { tr: 'Merdiven' },
    why: { tr: 'Stair komutu iki kat arasını kendisi hesaplar: kat yüksekliğine göre basamak sayısını ve yüksekliğini bulur. Başlangıca ve çıkış yönüne dokunman yeter.' },
    bridge: { tr: "AutoCAD'de basamakları tek tek çizersin; Revit'te merdiven, katlara bağlı tek bir nesnedir." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'stair',
        command: 'stair',
        goal: { tr: 'Stair’i seç: sol duvarın dibindeki başlangıca, sonra çıkış yönüne (arkaya) dokun.' },
        ghost: [
          { kind: 'area', points: [[200, 600], [1200, 600], [1200, 5360], [200, 5360]], label: 'Merdiven' },
        ],
        magnet: STAIR_AT,
        demo: [[700, 600], [700, 5000]],
        done: stairDone,
        solve: (s) => step(s, createStairCommand(s, stairInput(s.model, 'l0', levelId(s.model, 3000), STAIR_AT, 'z+'))),
        taps: 2,
      },
    ],
  },
  {
    id: 'h2-4',
    number: 4,
    title: { tr: 'Üst kat' },
    why: { tr: "Aynı duvarları üst kata yeniden çizmezsin: seçip kopyalar (Copy), sonra Paste › Aligned to Selected Levels ile başka bir kata aynı yere yapıştırırsın. Üst kat döşemesinde merdiven boşluğu bırakılır." },
    bridge: { tr: "AutoCAD'de katı kopyalayıp yeni dosyaya taşırsın; Revit'te aynı modelde başka bir Level'a hizalı yapıştırırsın." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    steps: [
      {
        id: 'paste',
        command: 'paste',
        goal: { tr: 'Zemin kat duvarları seçili ve kopyalandı. Modify sekmesinden Paste Aligned’ı seç, 1. Kat’ı işaretle.' },
        ghost: [{ kind: 'area', points: [[0, 0], [W, 0], [W, D], [0, D]], label: '1. Kat' }],
        demo: [],
        from: 'l0',
        on: 'l0',
        done: (m) => wallsOn(m, levelId(m, 3000)).length >= 5,
        solve: (s) => step(s, copyWallsToLevelCommand(s, wallsOn(s.model, 'l0').map((w) => w.id), levelId(s.model, 3000))),
        taps: 1,
      },
      {
        id: 'floor',
        command: 'floor',
        goal: { tr: '1. Kat planındasın. İçeri dokun: döşeme otursun, merdiven boşluğu açık kalsın.' },
        ghost: [{ kind: 'area', points: UPPER_OUTLINE, label: 'Döşeme' }],
        demo: [[5000, 3000]],
        on: 'l1',
        done: (m) => m.elements.some((e) => e.type === 'floor' && e.levelId === levelId(m, 3000)),
        solve: (s) =>
          step(s, createFloorCommand(s, { levelId: levelId(s.model, 3000), boundary: floorOutlineWithOpening(GEOM, s.model, levelId(s.model, 3000)) })),
        taps: 1,
      },
    ],
  },
  {
    id: 'h2-5',
    number: 5,
    title: { tr: 'Kesit' },
    why: { tr: 'Section, modeli bir çizgiden keser ve içini yandan gösterir. Kesiti sen çizmezsin: Revit modelden üretir; model değişince kesit de değişir.' },
    bridge: { tr: "AutoCAD'de kesiti ayrıca çizersin; Revit'te kesit modelin canlı bir görünümüdür." },
    view: 'plan',
    geom: GEOM,
    par: 3,
    reveal: 'section',
    steps: [
      {
        id: 'section',
        command: 'section',
        goal: { tr: 'View sekmesinden Section’ı seç; merdivenin ortasından geçen bir çizgi çiz.' },
        ghost: [{ kind: 'line', a: [1000, -1000], b: [1000, D + 1000], label: 'Kesit' }],
        demo: [[1000, -1000], [1000, D + 1000]],
        done: sectionDone,
        solve: (s) => step(s, createViewCommand(s, { kind: 'section', cutLine: [[1000, -1000], [1000, D + 1000]] })),
        taps: 2,
      },
    ],
  },
  {
    id: 'h2-6',
    number: 6,
    title: { tr: 'Kapı, pencere, çatı' },
    why: { tr: 'Her kat kendi planında çalışılır: kapıyı Zemin Kat planında, pencereleri 1. Kat planında koyarsın. Çatı en üstteki Level’a, yani Çatı’ya oturur.' },
    bridge: { tr: "AutoCAD'de katlar arasında dosya değiştirirsin; Revit'te Project Browser'dan kat planını seçersin." },
    view: 'plan',
    geom: GEOM,
    par: 5,
    steps: [
      {
        id: 'door',
        command: 'door',
        goal: { tr: 'Zemin Kat: salonun ön duvarına giriş kapısını koy.' },
        ghost: [{ kind: 'opening', a: [2050, 0], b: [2950, 0], label: 'Kapı' }],
        demo: [[2500, 900], [2500, 0]],
        done: (m) => openingsOn(m, 'door', 0, 'l0').some((p) => p[0] > 1600 && p[0] < S - 400),
        solve: (s) => step(s, placeOpening(s, 'door', front(s, 'l0'), 2500, { width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' })),
        taps: 1,
      },
      {
        id: 'windows',
        command: 'window',
        goal: { tr: '1. Kat: ön duvara iki pencere koy, her odaya bir tane.' },
        ghost: [
          { kind: 'opening', a: [1400, 0], b: [2600, 0], label: 'Pencere' },
          { kind: 'opening', a: [5400, 0], b: [6600, 0], label: 'Pencere' },
        ],
        demo: [[2000, 900], [2000, 0]],
        on: 'l1',
        done: (m) => {
          const ps = openingsOn(m, 'window', 0, levelId(m, 3000));
          return ps.some((p) => p[0] < S) && ps.some((p) => p[0] > S);
        },
        solve: (s) => {
          const on = levelId(s.model, 3000);
          let x = step(s, placeOpening(s, 'window', front(s, on), 2000, { width: 1200, height: 1200, sill: 900 }));
          x = step(x, placeOpening(x, 'window', front(x, on), 6000, { width: 1200, height: 1200, sill: 900 }));
          return x;
        },
        taps: 2,
      },
      {
        id: 'roof',
        command: 'roof',
        goal: { tr: 'Evin içine dokun: çatı en üst kata otursun.' },
        ghost: [{ kind: 'area', points: [[-500, -500], [W + 500, -500], [W + 500, D + 500], [-500, D + 500]], label: 'Çatı' }],
        demo: [[W / 2, D / 2]],
        on: 'l1',
        done: (m) => m.elements.some((e) => e.type === 'roof' && e.baseLevelId === roofLevelId(m)),
        solve: (s) => step(s, createRoofCommand(s, { baseLevelId: roofLevelId(s.model), slope: 30, overhang: 500 })),
        taps: 1,
      },
    ],
  },
];

export const HOUSE2_DEF: HouseDef = {
  id: 'iki-katli-ev',
  title: { tr: 'İki Katlı Ev' },
  brief: { tr: '8 × 6 m, iki kat, merdivenli. Katları, merdiveni, kat kopyalamayı ve kesiti öğren.' },
  levels: HOUSE2_LEVELS,
  icon: 'double',
  nameChoices: ['Salon', 'Mutfak', 'Yatak Odası', 'Banyo'],
};
