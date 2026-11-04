import { describe, expect, it } from 'vitest';
import { HOUSE, HOUSE1, HOUSE1_DEF, ROOM_NAMES } from '../src/campaign/house1';
import { HOUSE2, HOUSE2_DEF } from '../src/campaign/house2';
import { RIBBON, sessionFor, startModelFor as startModelOf, type HouseDef } from '../src/campaign/model';
import { HOUSE3_DEF } from '../src/campaign/house3';
import { HOUSE4, HOUSE4_DEF, UNIT_NAMES } from '../src/campaign/house4';
import {
  choicesFor,
  choose,
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

type Script = Array<{ cmd?: string; taps?: Point[]; name?: string; mode?: 'line' | 'rect'; paste?: string; pick?: string[] }>;

function playHouse(house: HouseDef, index: number, script: Script): PlayState {
  const level = house.levels[index];
  let st = newPlay(sessionFor(startModelOf(house, index)));
  for (const s of script) {
    if (s.cmd) st = pickCommand(level, st, s.cmd as never).state;
    if (s.mode) st = setDrawMode(st, s.mode).state;
    if (s.paste) st = pasteTo(level, st, s.paste).state;
    for (const label of s.pick ?? []) {
      const c = choicesFor(level, st).find((x) => x.label.startsWith(label));
      if (!c) throw new Error(`no choice ${label} in ${JSON.stringify(choicesFor(level, st))}`);
      st = choose(level, st, c.id).state;
    }
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

  it('reddedilen dokunuş hamle saymaz; fazla çizim üçüncü yıldızı götürür', () => {
    const level4 = HOUSE1[4];
    const free = play(4, [{ cmd: 'floor', taps: [[-500, -500], [-800, 200], [20000, 1], [5000, 3500]] }, { cmd: 'roof', taps: [[5000, 3500]] }]);
    expect(free.done).toBe(true);
    expect(free.taps).toBe(2);
    expect(starsFor(level4, free)).toBe(3);

    const level = HOUSE1[1];
    const extra: Point[] = [[2000, -1000], [2000, D + 1000], [5000, -1000], [5000, D + 1000]];
    const st = play(1, [{ cmd: 'grid', taps: [...extra, ...perfect[1][0].taps!] }]);
    expect(st.done).toBe(true);
    expect(starsFor(level, st)).toBe(2);
  });

  it('geri al hamle saymaz ve önceki adıma dönünce komutu bırakır', () => {
    const level = HOUSE1[3];
    let st = play(3, [{ cmd: 'door', taps: [[3000, 150]] }, { cmd: 'window' }]);
    expect(st.stepIndex).toBe(1);
    expect(st.command).toBe('window');
    const before = st.taps;
    st = undo(level, st).state;
    expect(st.stepIndex).toBe(0);
    expect(st.command).toBeNull();
    expect(st.taps).toBe(before);
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

const H3 = HOUSE3_DEF.levels;
const perfect3: Script[] = [
  [{ cmd: 'dimension', taps: [[100, 3500], [9900, 3500]] }, { cmd: 'dimension', taps: [[5000, 100], [5000, 6900]] }],
  [{ cmd: 'tag', taps: [[3000, 0], [3000, 7000], [8000, 7100]] }],
  [{ cmd: 'elevation', taps: [[5000, 8200], [5000, -1200]] }],
  [{ cmd: 'section', taps: [[-1000, 4000], [11000, 4000]] }],
  [{ cmd: 'sheet', pick: ['A3'] }, { cmd: 'place', pick: ['Kat Planı', 'Cephe - Güney'] }],
];

describe('Teslim — kampanya mantığı', () => {
  it('Bahçe Evi’nin bitmiş modeliyle ve kat planı görünümüyle başlar', () => {
    const start = startModelOf(HOUSE3_DEF, 0);
    expect(start.elements.filter((e) => e.type === 'wall')).toHaveLength(5);
    expect(start.elements.some((e) => e.type === 'view' && e.kind === 'plan')).toBe(true);
  });

  it('referans çözüm paftayı kurar', () => {
    const end = startModelOf(HOUSE3_DEF, H3.length);
    const sheet = end.elements.find((e) => e.type === 'sheet');
    expect(sheet && sheet.type === 'sheet' && sheet.placements.length).toBe(2);
    for (const level of H3) for (const st of level.steps) expect(st.done(end), `${level.id}/${st.id}`).toBe(true);
  });

  H3.forEach((level, i) => {
    it(`${level.id} ${level.title.tr}: dokunarak oynanınca biter ve 3 yıldız verir`, () => {
      expect(level.steps[0].done(startModelOf(HOUSE3_DEF, i))).toBe(false);
      const st = playHouse(HOUSE3_DEF, i, perfect3[i]);
      expect(st.done, JSON.stringify(st.session.model.elements.filter((e) => e.type === 'view' || e.type === 'dimension'))).toBe(true);
      expect(starsFor(level, st)).toBe(3);
    });
  });

  it('iç duvara ölçü bölümü bitirmez', () => {
    const st = playHouse(HOUSE3_DEF, 0, [{ cmd: 'dimension', taps: [[100, 3500], [6000, 3500]] }]);
    expect(st.stepIndex).toBe(0);
  });
});

const { w: W4, d: D4, half: HF } = HOUSE4;
const H4 = HOUSE4_DEF.levels;
const perfect4: Script[] = [
  [{ cmd: 'wall', mode: 'rect', taps: [[0, 0], [HF, D4]] }, { cmd: 'door', taps: [[2000, 100]] }],
  [{ cmd: 'mirror', taps: [[HF + 100, 4000]] }],
  [{ cmd: 'floor', taps: [[6000, 4000]] }, { cmd: 'roof', taps: [[6000, 4000]] }],
  [
    { cmd: 'room', taps: [[3000, 4000], [9000, 4000]] },
    { cmd: 'tag', taps: [[3000, 4000]], name: UNIT_NAMES.left },
    { taps: [[9000, 4000]], name: UNIT_NAMES.right },
  ],
];

describe('İkiz Ev — kampanya mantığı', () => {
  it('referans çözüm iki daireli evi kurar', () => {
    const end = startModelOf(HOUSE4_DEF, H4.length);
    expect(end.elements.filter((e) => e.type === 'wall')).toHaveLength(7);
    expect(end.elements.filter((e) => e.type === 'door')).toHaveLength(2);
    for (const level of H4) for (const st of level.steps) expect(st.done(end), `${level.id}/${st.id}`).toBe(true);
  });

  H4.forEach((level, i) => {
    it(`${level.id} ${level.title.tr}: dokunarak oynanınca biter ve 3 yıldız verir`, () => {
      expect(level.steps[0].done(startModelOf(HOUSE4_DEF, i))).toBe(false);
      const st = playHouse(HOUSE4_DEF, i, perfect4[i]);
      expect(st.done).toBe(true);
      expect(starsFor(level, st)).toBe(3);
    });
  });

  it('yatay duvardan aynalamak ikiz evi kurmaz', () => {
    const st = playHouse(HOUSE4_DEF, 1, [{ cmd: 'mirror', taps: [[3000, D4]] }]);
    expect(st.done).toBe(false);
    expect(W4).toBe(12000);
  });
});

describe('Her evin bitmiş hali', () => {
  for (const house of [HOUSE1_DEF, HOUSE2_DEF, HOUSE3_DEF, HOUSE4_DEF]) {
    it(`${house.title.tr}: çatı duvarların üstüne oturur`, () => {
      const end = startModelOf(house, house.levels.length);
      const elev = (id: string) => end.levels.find((l) => l.id === id)?.elevation ?? 0;
      const wallTop = Math.max(
        ...end.elements.filter((e) => e.type === 'wall').map((w) => (w.type === 'wall' ? elev(w.baseLevelId) + w.height : 0))
      );
      const roofs = end.elements.filter((e) => e.type === 'roof');
      expect(roofs.length).toBeGreaterThan(0);
      for (const r of roofs) if (r.type === 'roof') expect(elev(r.baseLevelId)).toBe(wallTop);
    });
  }
});
