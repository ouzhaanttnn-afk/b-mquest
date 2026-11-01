import { describe, expect, it } from 'vitest';
import { HOUSE, HOUSE1, HOUSE1_DEF, ROOM_NAMES } from '../src/campaign/house1';
import { HOUSE2, HOUSE2_DEF } from '../src/campaign/house2';
import { RIBBON, sessionFor, startModelFor as startModelOf, type HouseDef } from '../src/campaign/model';
import {
  nameRoom,
  newPlay,
  pasteTo,
  pickCommand,
  setDrawMode,
  starsFor,
  tap,
  undo,
  type PlayState,
} from '../src/campaign/engine';
import type { Point } from '../src/domain/types';

const startModelFor = (i: number) => startModelOf(HOUSE1_DEF, i);

type Script = Array<{ cmd?: string; taps?: Point[]; name?: string; mode?: 'line' | 'rect'; paste?: string }>;

function playHouse(house: HouseDef, index: number, script: Script): PlayState {
  const level = house.levels[index];
  let st = newPlay(sessionFor(startModelOf(house, index)));
  for (const s of script) {
    if (s.cmd) st = pickCommand(level, st, s.cmd as never).state;
    if (s.mode) st = setDrawMode(st, s.mode).state;
    if (s.paste) st = pasteTo(level, st, s.paste).state;
    for (const p of s.taps ?? []) st = tap(level, st, p).state;
    if (s.name) st = nameRoom(level, st, s.name).state;
  }
  return st;
}

const { w: W, d: D, split: S } = HOUSE;

/** Plays a level by taps, the way a player would. */
const play = (index: number, script: Script) => playHouse(HOUSE1_DEF, index, script);

const perfect: Array<Array<{ cmd?: string; taps?: Point[]; name?: string }>> = [
  [{ cmd: 'level', taps: [[0, 3100]] }],
  [{ cmd: 'grid', taps: [[0, -1000], [0, D + 1000], [W, -1000], [W, D + 1000], [-1000, 0], [W + 1000, 0], [-1000, D], [W + 1000, D]] }],
  [{ cmd: 'wall', taps: [[0, 0], [W, 0], [W, D], [0, D], [0, 0], [S, 0], [S, D]] }],
  [{ cmd: 'door', taps: [[3000, 150]] }, { cmd: 'window', taps: [[3000, D - 150], [8000, D + 100]] }],
  [{ cmd: 'floor', taps: [[5000, 3500]] }, { cmd: 'roof', taps: [[5000, 3500]] }],
  [
    { cmd: 'room', taps: [[3000, 3500], [8000, 3500]] },
    { cmd: 'tag', taps: [[3000, 3500]], name: ROOM_NAMES.left },
    { taps: [[8000, 3500]], name: ROOM_NAMES.right },
  ],
];

describe('Bahçe Evi — kampanya mantığı', () => {
  it('her bölümün referans çözümü bir sonrakinin başlangıcını kurar', () => {
    const end = startModelFor(HOUSE1.length);
    expect(end.elements.filter((e) => e.type === 'wall')).toHaveLength(5);
    expect(end.elements.filter((e) => e.type === 'tag')).toHaveLength(2);
    for (const level of HOUSE1) for (const st of level.steps) expect(st.done(end), `${level.id}/${st.id}`).toBe(true);
  });

  it('başlangıçta hiçbir bölümün adımı tamam değildir', () => {
    HOUSE1.forEach((level, i) => {
      expect(level.steps[0].done(startModelFor(i)), level.id).toBe(false);
    });
  });

  HOUSE1.forEach((level, i) => {
    it(`${level.id} ${level.title.tr}: dokunarak oynanınca biter ve 3 yıldız verir`, () => {
      const st = play(i, perfect[i]);
      expect(st.done, JSON.stringify(st.session.model.elements.map((e) => e.type))).toBe(true);
      expect(starsFor(level, st)).toBe(3);
      expect(st.taps).toBeLessThanOrEqual(level.par);
    });
  });

  it('ribbon her komutu bir kez ve gerçek Revit yoluyla içerir', () => {
    expect(new Set(RIBBON.map((c) => c.id)).size).toBe(RIBBON.length);
    const tabName = { architecture: 'Architecture', annotate: 'Annotate', view: 'View', modify: 'Modify' };
    for (const c of RIBBON) expect(c.path.startsWith(`${tabName[c.tab]} ›`)).toBe(true);
  });

  it('yanlış komut seçmek ikinci yıldızı götürür; komutsuz dokunuş bir şey yapmaz', () => {
    const level = HOUSE1[2];
    let st = newPlay(sessionFor(startModelFor(2)));
    const r0 = tap(level, st, [0, 0]);
    expect(r0.effect).toBe('error');
    expect(r0.state.session.model).toBe(st.session.model);
    st = pickCommand(level, st, 'floor').state;
    expect(st.command).toBeNull();
    const done = play(2, [{ cmd: 'floor' }, ...perfect[2]]);
    expect(done.done).toBe(true);
    expect(starsFor(level, done)).toBe(2);
  });

  it('çok dokunuş üçüncü yıldızı götürür', () => {
    const level = HOUSE1[4];
    const st = play(4, [{ cmd: 'floor', taps: [[-500, -500], [-800, 200], [20000, 1], [5000, 3500]] }, { cmd: 'roof', taps: [[5000, 3500]] }]);
    expect(st.done).toBe(true);
    expect(starsFor(level, st)).toBe(2);
  });

  it('kat bölümü: görünüşte dokunulan yükseklik 50 cm’ye yapışır', () => {
    const level = HOUSE1[0];
    let st = newPlay(sessionFor(startModelFor(0)));
    st = pickCommand(level, st, 'level').state;
    st = tap(level, st, [0, 2400]).state;
    expect(st.done).toBe(false);
    expect(st.session.model.levels.find((l) => l.id !== 'l0')!.elevation).toBe(2500);
    st = tap(level, st, [0, 2950]).state;
    expect(st.done).toBe(true);
  });

  it('oda bölümü: yanlış isim bölümü bitirmez, geri al çalışır', () => {
    const level = HOUSE1[5];
    let st = play(5, [
      { cmd: 'room', taps: [[3000, 3500], [8000, 3500]] },
      { cmd: 'tag', taps: [[3000, 3500]], name: ROOM_NAMES.right },
      { taps: [[8000, 3500]], name: ROOM_NAMES.left },
    ]);
    expect(st.done).toBe(false);
    st = undo(level, st).state;
    expect(st.done).toBe(false);
  });
});

const { w: W2, d: D2, split: S2 } = HOUSE2;
const H2 = HOUSE2_DEF.levels;
const perfect2: Script[] = [
  [{ cmd: 'level', taps: [[0, 3000], [0, 6100]] }],
  [{ cmd: 'wall', mode: 'rect', taps: [[0, 0], [W2, D2]] }, { cmd: 'wall', mode: 'line', taps: [[S2, 0], [S2, D2]] }],
  [{ cmd: 'stair', taps: [[700, 700], [700, 5000]] }],
  [{ cmd: 'paste', paste: 'l1' }, { cmd: 'floor', taps: [[5000, 3000]] }],
  [{ cmd: 'section', taps: [[1000, -1000], [1000, D2 + 1000]] }],
  [{ cmd: 'door', taps: [[2500, 100]] }, { cmd: 'window', taps: [[2000, 0], [6000, -100]] }, { cmd: 'roof', taps: [[4000, 3000]] }],
];

describe('İki Katlı Ev — kampanya mantığı', () => {
  it('referans çözüm iki katlı evi kurar', () => {
    const end = startModelOf(HOUSE2_DEF, H2.length);
    expect(end.levels.map((l) => [l.name, l.elevation])).toEqual([['Zemin Kat', 0], ['1. Kat', 3000], ['Çatı', 6000]]);
    expect(end.elements.filter((e) => e.type === 'wall')).toHaveLength(10);
    expect(end.elements.filter((e) => e.type === 'stair')).toHaveLength(1);
    const upper = end.elements.find((e) => e.type === 'floor' && e.levelId === 'l1');
    expect(upper && upper.type === 'floor' && upper.boundary.length).toBe(8);
    for (const level of H2) for (const st of level.steps) expect(st.done(end), `${level.id}/${st.id}`).toBe(true);
  });

  it('başlangıçta hiçbir bölümün adımı tamam değildir', () => {
    H2.forEach((level, i) => expect(level.steps[0].done(startModelOf(HOUSE2_DEF, i)), level.id).toBe(false));
  });

  H2.forEach((level, i) => {
    it(`${level.id} ${level.title.tr}: dokunarak oynanınca biter ve 3 yıldız verir`, () => {
      const st = playHouse(HOUSE2_DEF, i, perfect2[i]);
      expect(st.done, JSON.stringify(st.session.model.elements.map((e) => e.type))).toBe(true);
      expect(starsFor(level, st)).toBe(3);
    });
  });

  it('dikdörtgen yerine çizgiyle duvar çizmek de biter ama hamle yıldızını götürür', () => {
    const st = playHouse(HOUSE2_DEF, 1, [
      { cmd: 'wall', taps: [[0, 0], [W2, 0], [W2, D2], [0, D2], [0, 0]] },
      { cmd: 'wall', taps: [[S2, 0], [S2, D2]] },
    ]);
    expect(st.done).toBe(true);
    expect(starsFor(H2[1], st)).toBe(2);
  });

  it('merdiven kat yüksekliğine göre boyutlanır (Blondel aralığında)', () => {
    const st = playHouse(HOUSE2_DEF, 2, perfect2[2]);
    const s = st.session.model.elements.find((e) => e.type === 'stair');
    expect(s && s.type === 'stair' && s.risers * s.riserHeight).toBeGreaterThanOrEqual(2990);
    const blondel = s && s.type === 'stair' ? 2 * s.riserHeight + s.treadDepth : 0;
    expect(blondel).toBeGreaterThanOrEqual(600);
    expect(blondel).toBeLessThanOrEqual(650);
  });

  it('duvarları Çatı’ya yapıştırmak bölümü bitirmez', () => {
    const st = playHouse(HOUSE2_DEF, 3, [{ cmd: 'paste', paste: 'l2' }]);
    expect(st.stepIndex).toBe(0);
    expect(st.done).toBe(false);
  });

  it('merdivenden geçmeyen kesit bölümü bitirmez', () => {
    const st = playHouse(HOUSE2_DEF, 4, [{ cmd: 'section', taps: [[5000, -1000], [5000, D2 + 1000]] }]);
    expect(st.done).toBe(false);
  });
});
