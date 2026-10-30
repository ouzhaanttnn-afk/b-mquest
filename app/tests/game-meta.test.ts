import { describe, expect, it } from 'vitest';
import {
  EMPTY_META,
  levelProgress,
  markAnnounced,
  newAchievements,
  registerPlayDay,
  visibleStreak,
} from '../src/domain/gameMeta';

describe('streak', () => {
  it('starts at 1 and extends on consecutive days', () => {
    let m = registerPlayDay(EMPTY_META, '2026-03-01');
    expect(m.streak).toBe(1);
    m = registerPlayDay(m, '2026-03-01');
    expect(m.streak).toBe(1);
    m = registerPlayDay(m, '2026-03-02');
    expect(m.streak).toBe(2);
    expect(m.bestStreak).toBe(2);
  });
  it('resets after a gap but keeps the best streak', () => {
    let m = registerPlayDay(EMPTY_META, '2026-02-27');
    m = registerPlayDay(m, '2026-02-28');
    m = registerPlayDay(m, '2026-03-01'); // month boundary, still consecutive
    expect(m.streak).toBe(3);
    m = registerPlayDay(m, '2026-03-05');
    expect(m.streak).toBe(1);
    expect(m.bestStreak).toBe(3);
  });
  it('hides a lapsed streak', () => {
    const m = registerPlayDay(EMPTY_META, '2026-03-01');
    expect(visibleStreak(m, '2026-03-02')).toBe(1);
    expect(visibleStreak(m, '2026-03-04')).toBe(0);
  });
});

describe('achievements', () => {
  it('announces each achievement once', () => {
    const completed = { m01: { bestScore: 100 } };
    const first = newAchievements(completed, EMPTY_META);
    expect(first.map((a) => a.id)).toEqual(
      expect.arrayContaining(['first-mission', 'perfect'])
    );
    const meta = markAnnounced(EMPTY_META, first.map((a) => a.id));
    expect(newAchievements(completed, meta)).toEqual([]);
  });
  it('awards a chapter only when every mission is done', () => {
    const six = Object.fromEntries(
      ['m01', 'm02', 'm03', 'm04', 'm05'].map((id) => [id, { bestScore: 80 }])
    );
    expect(newAchievements(six, EMPTY_META).some((a) => a.id === 'chapter-1')).toBe(false);
    six.m06 = { bestScore: 80 };
    expect(newAchievements(six, EMPTY_META).some((a) => a.id === 'chapter-1')).toBe(true);
  });
});

describe('levelProgress', () => {
  it('reports progress inside the level', () => {
    expect(levelProgress({}).pct).toBe(0);
    // 50 points = 100 XP = half of level 1
    expect(levelProgress({ m01: { bestScore: 50 } })).toMatchObject({ level: 1, pct: 50 });
  });
});
