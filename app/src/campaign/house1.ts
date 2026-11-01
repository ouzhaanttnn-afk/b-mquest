import {
  createFloorCommand,
  createGridCommand,
  createRoofCommand,
  createTagCommand,
  createWallCommand,
  updateElementProperty,
  type MissionSessionState,
} from '../domain/commands';
import { enclosedRegions, roomBoundary } from '../domain/derived';
import type { BimModel, Point, WallElement } from '../domain/types';
import { placeOpening, placeRoomAt } from '../ui/workspace/toolActions';
import { levelTap, roofLevelId, step, type HouseDef, type LevelDef } from './model';

/**
 * İlk ev: "Bahçe Evi". Tek katlı, 10 × 7 m (70 m²), bir iç duvarla salon ve
 * yatak odası. Altı bölüm, her biri tek bir Revit komutu ailesini öğretir.
 * Revit menü yolları İngilizce arayüze göredir (Revit 2022 ve sonrası).
 */

// ---- House geometry (mm) --------------------------------------------------
export const HOUSE = { w: 10000, d: 7000, split: 6000, wallH: 3000, roofLevel: 3000 };
const GEOM = { w: HOUSE.w, d: HOUSE.d, wallH: HOUSE.wallH };
export const ROOM_NAMES = { left: 'Salon', right: 'Yatak Odası' } as const;

// ---- Predicates ------------------------------------------------------------
const walls = (m: BimModel) => m.elements.filter((e): e is WallElement => e.type === 'wall');
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

const hasGrid = (m: BimModel, vertical: boolean, pos: number) =>
  m.elements.some(
    (e) =>
      e.type === 'grid' &&
      (vertical ? e.start[0] === e.end[0] && e.start[0] === pos : e.start[1] === e.end[1] && e.start[1] === pos)
  );

const shellDone = (m: BimModel) => {
  const regions = enclosedRegions(m, 'l0');
  const area = regions.reduce((s, r) => s + r.area, 0) / 1_000_000;
  const split = walls(m).some(
    (w) => w.start[0] === HOUSE.split && w.end[0] === HOUSE.split && Math.abs(w.end[1] - w.start[1]) === HOUSE.d
  );
  return regions.length === 2 && near(area, 70, 0.5) && split;
};

const openingCentre = (m: BimModel, id: string): Point | null => {
  const o = m.elements.find((e) => e.id === id);
  if (!o || (o.type !== 'door' && o.type !== 'window')) return null;
  const host = walls(m).find((w) => w.id === o.hostWallId);
  if (!host) return null;
  const len = Math.abs(host.end[0] - host.start[0]) + Math.abs(host.end[1] - host.start[1]);
  const k = (o.offset + o.width / 2) / len;
  return [host.start[0] + (host.end[0] - host.start[0]) * k, host.start[1] + (host.end[1] - host.start[1]) * k];
};

const openingsOnFront = (m: BimModel, type: 'door' | 'window', z: number) =>
  m.elements
    .filter((e) => e.type === type)
    .map((e) => openingCentre(m, e.id))
    .filter((p): p is Point => !!p && near(p[1], z, 1));

const roomAtSide = (m: BimModel, side: 'left' | 'right') =>
  m.elements.find(
    (e) =>
      e.type === 'room' &&
      !roomBoundary(e, m).open &&
      (side === 'left' ? e.seedPoint[0] < HOUSE.split : e.seedPoint[0] > HOUSE.split)
  );

// ---- Reference solutions ---------------------------------------------------
const wallCmd = (s: MissionSessionState, a: Point, b: Point) =>
  step(s, createWallCommand(s, { name: 'Duvar', baseLevelId: 'l0', startX: a[0], startZ: a[1], endX: b[0], endZ: b[1], height: HOUSE.wallH, thickness: 200 }));
const wallById = (s: MissionSessionState, a: Point, b: Point) =>
  walls(s.model).find((w) => w.start[0] === a[0] && w.start[1] === a[1] && w.end[0] === b[0] && w.end[1] === b[1])!;

const { w: W, d: D, split: S } = HOUSE;

export const HOUSE1: LevelDef[] = [
  {
    id: 'h1-1',
    number: 1,
    title: { tr: 'Katlar' },
    why: { tr: "Revit'te her duvar, döşeme ve çatı bir kata (Level) bağlıdır. Katı yükseltirsen ona bağlı her şey birlikte yükselir. Katlar bir görünüşte (elevation) çizilir." },
    bridge: { tr: "AutoCAD'de kat diye bir şey yoktur; Revit'te her şey bir kata bağlıdır." },
    view: 'elevation',
    geom: GEOM,
    par: 2,
    steps: [
      {
        id: 'level',
        command: 'level',
        goal: { tr: 'Çatı seviyesini +3,00 m’ye koy.' },
        ghost: [{ kind: 'elevation', at: HOUSE.roofLevel, label: '+3,00' }],
        demo: [[0, 0], [0, HOUSE.roofLevel]],
        levels: [{ at: HOUSE.roofLevel, name: 'Çatı' }],
        done: (m) => m.levels.some((l) => l.id !== 'l0' && l.elevation === HOUSE.roofLevel),
        solve: (s) => step(s, levelTap(s, HOUSE.roofLevel, [{ at: HOUSE.roofLevel, name: 'Çatı' }])),
        taps: 1,
      },
    ],
  },
  {
    id: 'h1-2',
    number: 2,
    title: { tr: 'Akslar' },
    why: { tr: 'Akslar (Grid) planın iskeletidir. Duvarlar akslara oturur; aksı taşırsan ona bağlı duvarlar da taşınabilir. Revit aks adlarını kendisi verir: A, B… ve 1, 2…' },
    bridge: { tr: 'Aks çizgisi gibi görünür, ama Revit’te duvarlar ona yapışır ve projede referans olarak kalır.' },
    view: 'plan',
    geom: GEOM,
    par: 10,
    steps: [
      {
        id: 'grid',
        command: 'grid',
        goal: { tr: 'Dört aksı çiz: iki dikey, iki yatay.' },
        ghost: [
          { kind: 'line', a: [0, -1000], b: [0, D + 1000], label: 'A' },
          { kind: 'line', a: [W, -1000], b: [W, D + 1000], label: 'B' },
          { kind: 'line', a: [-1000, 0], b: [W + 1000, 0], label: '1' },
          { kind: 'line', a: [-1000, D], b: [W + 1000, D], label: '2' },
        ],
        demo: [[0, -1000], [0, D + 1000]],
        done: (m) => hasGrid(m, true, 0) && hasGrid(m, true, W) && hasGrid(m, false, 0) && hasGrid(m, false, D),
        solve: (s) => {
          let x = s;
          for (const [a, b] of [
            [[0, -1000], [0, D + 1000]],
            [[W, -1000], [W, D + 1000]],
            [[-1000, 0], [W + 1000, 0]],
            [[-1000, D], [W + 1000, D]],
          ] as Array<[Point, Point]>) x = step(x, createGridCommand(x, { start: a, end: b }));
          return x;
        },
        taps: 8,
      },
    ],
  },
  {
    id: 'h1-3',
    number: 3,
    title: { tr: 'Duvarlar' },
    why: { tr: 'Revit’te duvar bir nesnedir: yüksekliği, kalınlığı ve tipi vardır. Uç uca çizdiğin duvarlar köşelerde kendiliğinden birleşir ve kapalı bir oda oluşturur.' },
    bridge: { tr: "AutoCAD'de duvar iki paralel çizgidir; Revit'te yüksekliği ve kalınlığı olan tek bir nesne." },
    view: 'plan',
    geom: GEOM,
    par: 9,
    steps: [
      {
        id: 'walls',
        command: 'wall',
        goal: { tr: 'Dış duvarları köşe köşe çiz, ortaya bir iç duvar koy.' },
        ghost: [
          { kind: 'area', points: [[0, 0], [W, 0], [W, D], [0, D]] },
          { kind: 'line', a: [S, 0], b: [S, D] },
        ],
        demo: [[0, 0], [W, 0], [W, D]],
        done: shellDone,
        solve: (s) => {
          let x = s;
          const loop: Point[] = [[0, 0], [W, 0], [W, D], [0, D], [0, 0]];
          for (let i = 0; i < 4; i++) x = wallCmd(x, loop[i], loop[i + 1]);
          return wallCmd(x, [S, 0], [S, D]);
        },
        taps: 7,
      },
    ],
  },
  {
    id: 'h1-4',
    number: 4,
    title: { tr: 'Kapı ve pencereler' },
    why: { tr: 'Kapı ve pencere bir duvara bağlıdır (host). Duvarı deler; duvar taşınırsa onunla gider, silinirse onunla silinir.' },
    bridge: { tr: "AutoCAD'deki blok gibi görünür, ama Revit'te duvarı gerçekten deler ve duvara bağlı kalır." },
    view: 'plan',
    geom: GEOM,
    par: 5,
    steps: [
      {
        id: 'door',
        command: 'door',
        goal: { tr: 'Salonun ön duvarına giriş kapısını koy.' },
        ghost: [{ kind: 'opening', a: [2550, 0], b: [3450, 0], label: 'Kapı' }],
        demo: [[3000, 900], [3000, 0]],
        done: (m) => openingsOnFront(m, 'door', 0).some((p) => p[0] > 1000 && p[0] < S - 500),
        solve: (s) => step(s, placeOpening(s, 'door', wallById(s, [0, 0], [W, 0]), 3000, { width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' })),
        taps: 1,
      },
      {
        id: 'windows',
        command: 'window',
        goal: { tr: 'Arka duvara iki pencere koy: biri salona, biri yatak odasına.' },
        ghost: [
          { kind: 'opening', a: [2400, D], b: [3600, D], label: 'Pencere' },
          { kind: 'opening', a: [7400, D], b: [8600, D], label: 'Pencere' },
        ],
        demo: [[3000, D - 900], [3000, D]],
        done: (m) => {
          const ps = openingsOnFront(m, 'window', D);
          return ps.some((p) => p[0] < S) && ps.some((p) => p[0] > S);
        },
        solve: (s) => {
          const back = wallById(s, [W, D], [0, D]);
          let x = step(s, placeOpening(s, 'window', back, W - 3000, { width: 1200, height: 1200, sill: 900 }));
          x = step(x, placeOpening(x, 'window', wallById(x, [W, D], [0, D]), W - 8000, { width: 1200, height: 1200, sill: 900 }));
          return x;
        },
        taps: 2,
      },
    ],
  },
  {
    id: 'h1-5',
    number: 5,
    title: { tr: 'Döşeme ve çatı' },
    why: { tr: 'Döşeme ve çatı duvarlardan oluşturulur: Revit duvarları seçince sınırı kendisi bulur. Çatı en üst kata (Level) oturur.' },
    bridge: { tr: "AutoCAD'deki tarama gibi değil: Revit'te döşemenin kalınlığı ve malzemesi olan gerçek bir nesne." },
    view: 'plan',
    geom: GEOM,
    par: 4,
    steps: [
      {
        id: 'floor',
        command: 'floor',
        goal: { tr: 'Evin içine dokun: zemin döşemesi oluşsun.' },
        ghost: [{ kind: 'area', points: [[0, 0], [W, 0], [W, D], [0, D]], label: 'Döşeme' }],
        demo: [[W / 2, D / 2]],
        done: (m) => m.elements.some((e) => e.type === 'floor' && e.levelId === 'l0'),
        solve: (s) => step(s, createFloorCommand(s, { levelId: 'l0' })),
        taps: 1,
      },
      {
        id: 'roof',
        command: 'roof',
        goal: { tr: 'Evin içine dokun: çatı otursun.' },
        ghost: [{ kind: 'area', points: [[-500, -500], [W + 500, -500], [W + 500, D + 500], [-500, D + 500]], label: 'Çatı' }],
        demo: [[W / 2, D / 2]],
        done: (m) => m.elements.some((e) => e.type === 'roof'),
        solve: (s) => step(s, createRoofCommand(s, { baseLevelId: roofLevelId(s.model), slope: 30, overhang: 500 })),
        taps: 1,
      },
    ],
  },
  {
    id: 'h1-6',
    number: 6,
    title: { tr: 'Odalar' },
    why: { tr: 'Oda (Room) duvarların çevrelediği alanı tanır; alanını ve hacmini Revit hesaplar. Etiket (Tag) odanın adını ve alanını planda yazar; bilgi modelden gelir.' },
    bridge: { tr: "AutoCAD'de alanı sen ölçersin; Revit'te oda alanı modelden kendiliğinden hesaplanır." },
    view: 'plan',
    geom: GEOM,
    par: 8,
    steps: [
      {
        id: 'rooms',
        command: 'room',
        goal: { tr: 'İki odanın içine dokun: Revit odaları tanısın.' },
        ghost: [
          { kind: 'area', points: [[0, 0], [S, 0], [S, D], [0, D]] },
          { kind: 'area', points: [[S, 0], [W, 0], [W, D], [S, D]] },
        ],
        demo: [[S / 2, D / 2]],
        done: (m) => !!roomAtSide(m, 'left') && !!roomAtSide(m, 'right'),
        solve: (s) => {
          let x = step(s, placeRoomAt(s, 'l0', [S / 2, D / 2]).result!);
          x = step(x, placeRoomAt(x, 'l0', [(S + W) / 2, D / 2]).result!);
          return x;
        },
        taps: 2,
      },
      {
        id: 'tags',
        command: 'tag',
        goal: { tr: 'Odaları etiketle ve adlarını seç: Salon, Yatak Odası.' },
        ghost: [
          { kind: 'area', points: [[0, 0], [S, 0], [S, D], [0, D]], label: ROOM_NAMES.left },
          { kind: 'area', points: [[S, 0], [W, 0], [W, D], [S, D]], label: ROOM_NAMES.right },
        ],
        demo: [[S / 2, D / 2]],
        done: (m) => {
          const l = roomAtSide(m, 'left');
          const r = roomAtSide(m, 'right');
          const tagged = (id: string) => m.elements.some((e) => e.type === 'tag' && e.targetId === id);
          return !!l && !!r && l.name === ROOM_NAMES.left && r.name === ROOM_NAMES.right && tagged(l.id) && tagged(r.id);
        },
        solve: (s) => {
          let x = s;
          for (const side of ['left', 'right'] as const) {
            const room = roomAtSide(x.model, side)!;
            x = step(x, createTagCommand(x, room.id));
            x = step(x, updateElementProperty(x, room.id, 'name', ROOM_NAMES[side]));
          }
          return x;
        },
        taps: 4,
      },
    ],
  },
];

export const HOUSE1_DEF: HouseDef = {
  id: 'bahce-evi',
  title: { tr: 'Bahçe Evi' },
  brief: { tr: '10 × 7 m, tek katlı, iki oda. Revit’in temel komutlarıyla kur.' },
  levels: HOUSE1,
  nameChoices: ['Salon', 'Yatak Odası', 'Mutfak', 'Banyo'],
};
