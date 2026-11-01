import { describe, expect, it } from 'vitest';
import { HOUSE, HOUSE1, ROOM_NAMES, RIBBON, sessionFor, startModelFor } from '../src/campaign/house1';
import { nameRoom, newPlay, pickCommand, starsFor, tap, undo, type PlayState } from '../src/campaign/engine';
import type { Point } from '../src/domain/types';

const { w: W, d: D, split: S } = HOUSE;

/** Plays a level by taps, the way a player would. */
function play(index: number, script: Array<{ cmd?: string; taps?: Point[]; name?: string }>): PlayState {
  const level = HOUSE1[index];
  let st = newPlay(sessionFor(startModelFor(index)));
  for (const s of script) {
    if (s.cmd) st = pickCommand(level, st, s.cmd as never).state;
    for (const p of s.taps ?? []) {
      const r = tap(level, st, p);
      st = r.state;
    }
    if (s.name) st = nameRoom(level, st, s.name).state;
  }
  return st;
}

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
    for (const c of RIBBON) expect(c.path.startsWith(c.tab === 'annotate' ? 'Annotate ›' : 'Architecture ›')).toBe(true);
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
