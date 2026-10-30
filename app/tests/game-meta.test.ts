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

import { recordAttempt, summarizeStats } from '../src/domain/gameMeta';

describe('stats', () => {
  it('counts attempts, passes and finds the hardest mission', () => {
    let m = recordAttempt(EMPTY_META, 'm05', false, 0);
    m = recordAttempt(m, 'm05', false, 1);
    m = recordAttempt(m, 'm05', true, 2);
    m = recordAttempt(m, 'm06', true, 0);
    const s = summarizeStats(m);
    expect(s).toMatchObject({ attempts: 4, passes: 2, passRatePct: 50 });
    expect(s.hardest).toEqual({ id: 'm05', attempts: 3 });
    expect(m.stats.m05.hintsUsed).toBe(2);
  });
});

import { loadValidatedCatalog } from '../src/content/content';
import { parseAndValidateSaveJson } from '../src/domain/persistence';

describe('save file accepts every catalog mission id', () => {
  it('bonus missions (m51+) survive a save round-trip', () => {
    const cat = loadValidatedCatalog();
    if (!cat.ok) throw new Error(cat.diagnostic);
    const completed = Object.fromEntries(
      cat.catalog.missions.map((m) => [m.id, { bestScore: 90 }])
    );
    const text = JSON.stringify({
      saveVersion: 1,
      contentVersion: '1.0.0',
      completed,
      drafts: {},
      settings: { sound: true, reducedMotion: false },
    });
    const res = parseAndValidateSaveJson(text, cat.catalog.missionsById);
    expect(res.ok, JSON.stringify(res)).toBe(true);
    if (res.ok) expect(Object.keys(res.save.completed)).toHaveLength(cat.catalog.missions.length);
  });
});
