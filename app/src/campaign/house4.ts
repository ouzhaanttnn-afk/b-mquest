import { createFloorCommand, createInitialSession, createRoofCommand, updateElementProperty, type MissionSessionState } from '../domain/commands';
import { createTagCommand } from '../domain/commandsDocs';
import { createRectangleWallsCommand, mirrorWallsCommand } from '../domain/commandsExtended';
import { enclosedRegions, roomBoundary } from '../domain/derived';
import type { BimModel, Point, WallElement } from '../domain/types';
import { placeOpening, placeRoomAt } from '../ui/workspace/toolActions';
import { openingCentre } from './engine';
import { CAMPAIGN_TASK, levelTap, roofLevelId, step, type HouseDef, type LevelDef } from './model';

/**
 * Dördüncü ev: "İkiz Ev". Yarım evi kur, ortak duvardan aynala (Mirror),
 * iki daireyi döşeme, çatı ve odalarla bitir.
 */

export const HOUSE4 = { w: 12000, d: 8000, half: 6000, wallH: 3000 };
const GEOM = { w: HOUSE4.w, d: HOUSE4.d, wallH: HOUSE4.wallH };
const { w: W, d: D, half: H } = HOUSE4;
export const UNIT_NAMES = { left: 'A Dairesi', right: 'B Dairesi' } as const;

const walls = (m: BimModel) => m.elements.filter((e): e is WallElement => e.type === 'wall');
const doorsAt = (m: BimModel) =>
  m.elements.filter((e) => e.type === 'door').map((e) => openingCentre(m, e.id)).filter((p): p is Point => !!p);

const area = (m: BimModel) => enclosedRegions(m, 'l0').reduce((s, r) => s + r.area, 0) / 1_000_000;

const halfDone = (m: BimModel) =>
  enclosedRegions(m, 'l0').some((r) => Math.abs(r.area / 1_000_000 - (H * D) / 1_000_000) < 0.5) &&
  walls(m).some((w) => w.start[0] === H && w.end[0] === H);
const twinDone = (m: BimModel) => {
  const regions = enclosedRegions(m, 'l0');
  return regions.length === 2 && Math.abs(area(m) - (W * D) / 1_000_000) < 0.5;
};

const roomOn = (m: BimModel, side: 'left' | 'right') =>
  m.elements.find(
    (e) => e.type === 'room' && !roomBoundary(e, m).open && (side === 'left' ? e.seedPoint[0] < H : e.seedPoint[0] > H)
  );

const front = (s: MissionSessionState) => walls(s.model).find((w) => w.start[1] === 0 && w.end[1] === 0 && Math.max(w.start[0], w.end[0]) <= H)!;

const HOUSE4_LEVELS: LevelDef[] = [
  {
    id: 'h4-1',
    number: 1,
    title: { tr: 'Yarım ev' },
    why: { tr: 'İkiz evin bir yarısını kurarsın; öbür yarısı bunun ayna görüntüsüdür. Ortak duvar iki daireyi ayırır.' },
    bridge: { tr: "Revit'te aynı işi iki kez yapmazsın: bir yarıyı kurar, sonra aynalarsın." },
    view: 'plan',
    geom: GEOM,
    par: 4,
    steps: [
      {
        id: 'rect',
        command: 'wall',
        goal: { tr: 'Dikdörtgen duvarla sol yarıyı çiz (6 × 8 m).' },
        ghost: [{ kind: 'area', points: [[0, 0], [H, 0], [H, D], [0, D]], label: 'A Dairesi' }],
        demo: [[0, 0], [H, D]],
        done: halfDone,
        solve: (s) => step(s, createRectangleWallsCommand(s, { x: 0, z: 0, width: H, depth: D, baseLevelId: 'l0', height: HOUSE4.wallH, thickness: 200 })),
        taps: 2,
      },
      {
        id: 'door',
        command: 'door',
        goal: { tr: 'Ön duvara giriş kapısını koy.' },
        ghost: [{ kind: 'opening', a: [1550, 0], b: [2450, 0], label: 'Kapı' }],
        demo: [[2000, 900], [2000, 0]],
        done: (m) => doorsAt(m).some((p) => p[1] === 0 && p[0] > 800 && p[0] < H - 800),
        solve: (s) => step(s, placeOpening(s, 'door', front(s), 2000, { width: 900, height: 2100, sill: 0, mark: 'D-01', fireRating: 'none' })),
        taps: 1,
      },
    ],
  },
  {
    id: 'h4-2',
    number: 2,
    title: { tr: 'Ayna' },
    why: { tr: 'Mirror - Pick Axis seçili nesnelerin ayna kopyasını çıkarır; ekseni bir duvara ya da çizgiye dokunarak seçersin. Kapı da duvarıyla birlikte aynalanır.' },
    bridge: { tr: "AutoCAD'deki MIRROR gibi; ama kapılar ve pencereler duvarlarıyla birlikte gider." },
    view: 'plan',
    geom: GEOM,
    par: 2,
    steps: [
      {
        id: 'mirror',
        command: 'mirror',
        goal: { tr: 'Yarım ev seçili. Modify’dan Mirror’ı seç ve ayna ekseni olarak ortak duvara dokun.' },
        ghost: [
          { kind: 'line', a: [H, -1000], b: [H, D + 1000], label: 'Eksen' },
          { kind: 'area', points: [[H, 0], [W, 0], [W, D], [H, D]], label: 'B Dairesi' },
        ],
        demo: [[H, D / 2]],
        done: (m) => twinDone(m) && doorsAt(m).some((p) => p[0] > H),
        solve: (s) => {
          const ids = walls(s.model).filter((w) => !(w.start[0] === H && w.end[0] === H)).map((w) => w.id);
          return step(s, mirrorWallsCommand(s, ids, 'x', H));
        },
        taps: 1,
      },
    ],
  },
  {
    id: 'h4-3',
    number: 3,
    title: { tr: 'Döşeme ve çatı' },
    why: { tr: 'Döşeme ve çatı tüm dış duvarları birlikte izler; iki daire tek döşeme ve tek çatı altında birleşir.' },
    bridge: { tr: "Bir dış hat, iki daire: Revit sınırı duvarlardan kendisi bulur." },
    view: 'plan',
    geom: GEOM,
    par: 5,
    steps: [
      {
        id: 'floor',
        command: 'floor',
        goal: { tr: 'Floor: evin içine dokun, sonra ✓ ile bitir.' },
        ghost: [{ kind: 'area', points: [[0, 0], [W, 0], [W, D], [0, D]], label: 'Döşeme' }],
        demo: [[W / 2, D / 2]],
        done: (m) => m.elements.some((e) => e.type === 'floor'),
        solve: (s) => step(s, createFloorCommand(s, { levelId: 'l0' })),
        taps: 2,
      },
      {
        id: 'roof',
        command: 'roof',
        goal: { tr: 'Roof: evin içine dokun, sonra ✓ ile bitir.' },
        ghost: [{ kind: 'area', points: [[-500, -500], [W + 500, -500], [W + 500, D + 500], [-500, D + 500]], label: 'Çatı' }],
        demo: [[W / 2, D / 2]],
        done: (m) =>
          m.elements.some(
            (e) => e.type === 'roof' && (m.levels.find((l) => l.id === e.baseLevelId)?.elevation ?? 0) === HOUSE4.wallH
          ),
        solve: (s) => step(s, createRoofCommand(s, { baseLevelId: roofLevelId(s.model), slope: 30, overhang: 500 })),
        taps: 2,
      },
    ],
  },
  {
    id: 'h4-4',
    number: 4,
    title: { tr: 'Daireler' },
    why: { tr: 'Her daire burada bir Room olur: alanını Revit hesaplar. Etiketle ve adını ver. (Satış ve kira için gerçek projede bir Area Plan da çizilir; Room ise iç mekân bilgisini taşır.)' },
    bridge: { tr: "AutoCAD'de alanı ölçüp yazarsın; Revit'te alan ve ad odanın kendisinde durur." },
    view: 'plan',
    geom: GEOM,
    par: 7,
    steps: [
      {
        id: 'rooms',
        command: 'room',
        goal: { tr: 'İki dairenin içine dokun: Revit odaları tanısın.' },
        ghost: [
          { kind: 'area', points: [[0, 0], [H, 0], [H, D], [0, D]] },
          { kind: 'area', points: [[H, 0], [W, 0], [W, D], [H, D]] },
        ],
        demo: [[H / 2, D / 2], [H + H / 2, D / 2]],
        done: (m) => !!roomOn(m, 'left') && !!roomOn(m, 'right'),
        solve: (s) => {
          let x = step(s, placeRoomAt(s, 'l0', [H / 2, D / 2]).result!);
          x = step(x, placeRoomAt(x, 'l0', [H + H / 2, D / 2]).result!);
          return x;
        },
        taps: 2,
      },
      {
        id: 'names',
        command: 'tag',
        goal: { tr: 'Daireleri etiketle: solda A Dairesi, sağda B Dairesi.' },
        ghost: [
          { kind: 'area', points: [[0, 0], [H, 0], [H, D], [0, D]], label: UNIT_NAMES.left },
          { kind: 'area', points: [[H, 0], [W, 0], [W, D], [H, D]], label: UNIT_NAMES.right },
        ],
        demo: [[H / 2, D / 2]],
        done: (m) => {
          const l = roomOn(m, 'left');
          const r = roomOn(m, 'right');
          const tagged = (id: string) => m.elements.some((e) => e.type === 'tag' && e.targetId === id);
          return !!l && !!r && l.name === UNIT_NAMES.left && r.name === UNIT_NAMES.right && tagged(l.id) && tagged(r.id);
        },
        solve: (s) => {
          let x = s;
          for (const side of ['left', 'right'] as const) {
            const room = roomOn(x.model, side)!;
            x = step(x, createTagCommand(x, room.id));
            x = step(x, updateElementProperty(x, room.id, 'name', UNIT_NAMES[side]));
          }
          return x;
        },
        taps: 4,
      },
    ],
  },
];

/** The project starts with its roof level in place, so the roof sits on the walls. */
function base(): MissionSessionState {
  const s = createInitialSession(CAMPAIGN_TASK);
  return step(s, levelTap(s, HOUSE4.wallH, [{ at: HOUSE4.wallH, name: 'Çatı' }]));
}

export const HOUSE4_DEF: HouseDef = {
  base,
  id: 'ikiz-ev',
  title: { tr: 'İkiz Ev' },
  brief: { tr: '12 × 8 m, iki daire. Yarısını kur, Mirror ile aynala, sonra döşeme, çatı ve daireler.' },
  levels: HOUSE4_LEVELS,
  icon: 'twin',
  nameChoices: [UNIT_NAMES.left, UNIT_NAMES.right, 'Salon', 'Mutfak'],
};
