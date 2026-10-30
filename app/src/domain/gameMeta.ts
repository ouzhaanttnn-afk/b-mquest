import { SEVEN_CHAPTER_CURRICULUM } from '../content/curriculum';
import { calculateMissionXp, calculateTotalPlayerXp } from './pedagogy';

/**
 * Game-feel layer that sits next to (not inside) the versioned save file:
 * daily streak and achievement bookkeeping. Achievements are derived from
 * `completed`, so only the streak and the "already announced" list are stored.
 */

export const META_STORAGE_KEY = 'bimquest.meta.v1';

export interface GameMeta {
  lastPlayDay: string | null;
  streak: number;
  bestStreak: number;
  announced: string[];
  /** Per-mission practice stats, kept on this device only. */
  stats: Record<string, MissionStats>;
  /** The three-card first-run tour has been seen or skipped. */
  introDone: boolean;
  /** Name printed on the graduation certificate. */
  playerName: string;
}

export interface MissionStats {
  attempts: number;
  passes: number;
  hintsUsed: number;
}

export const EMPTY_META: GameMeta = {
  lastPlayDay: null,
  streak: 0,
  bestStreak: 0,
  announced: [],
  stats: {},
  introDone: false,
  playerName: '',
};

type Completed = Record<string, { bestScore: number }>;

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: (completed: Completed) => boolean;
}

const count = (c: Completed) => Object.keys(c).length;
const goldCount = (c: Completed) =>
  Object.values(c).filter((r) => r.bestScore >= 90).length;

const chapterAchievements: Achievement[] = SEVEN_CHAPTER_CURRICULUM.map(
  (ch) => ({
    id: `chapter-${ch.chapterNumber}`,
    icon: ['🧱', '📏', '🏠', '🗂️', '📐', '🔎', '🏆', '📊', '🛠️'][ch.chapterNumber - 1],
    title: `Bölüm ${ch.chapterNumber} Tamam`,
    description: ch.title.replace(/^Bölüm \d+: /, ''),
    earned: (c) => ch.missions.every((m) => m.id in c),
  })
);

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-mission',
    icon: '🚀',
    title: 'İlk Adım',
    description: 'İlk görevini tamamla.',
    earned: (c) => count(c) >= 1,
  },
  {
    id: 'ten-missions',
    icon: '🔟',
    title: 'Isınma Turu',
    description: '10 görev tamamla.',
    earned: (c) => count(c) >= 10,
  },
  {
    id: 'half-way',
    icon: '⛰️',
    title: 'Yarı Yol',
    description: '25 görev tamamla.',
    earned: (c) => count(c) >= 25,
  },
  {
    id: 'all-missions',
    icon: '🎓',
    title: 'Mezun',
    description: 'Final projeyi (Görev 50) teslim et.',
    earned: (c) => 'm50' in c,
  },
  {
    id: 'perfect',
    icon: '💯',
    title: 'Kusursuz',
    description: 'Bir görevi 100 puanla bitir.',
    earned: (c) => Object.values(c).some((r) => r.bestScore >= 100),
  },
  {
    id: 'five-gold',
    icon: '🥇',
    title: 'Altın Koleksiyon',
    description: '5 görevde altın rozet kazan.',
    earned: (c) => goldCount(c) >= 5,
  },
  {
    id: 'level-5',
    icon: '⭐',
    title: 'Seviye 5',
    description: '5. seviyeye ulaş.',
    earned: (c) => calculateTotalPlayerXp(c).level >= 5,
  },
  ...chapterAchievements,
];

export function earnedAchievementIds(completed: Completed): string[] {
  return ACHIEVEMENTS.filter((a) => a.earned(completed)).map((a) => a.id);
}

/** Achievements earned now that the player has not yet been told about. */
export function newAchievements(
  completed: Completed,
  meta: GameMeta
): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => a.earned(completed) && !meta.announced.includes(a.id)
  );
}

export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000
  );
}

/** Record that the player played on `today`; extends or resets the streak. */
export function registerPlayDay(meta: GameMeta, today: string): GameMeta {
  if (meta.lastPlayDay === today) return meta;
  const gap = meta.lastPlayDay ? daysBetween(meta.lastPlayDay, today) : null;
  const streak = gap === 1 ? meta.streak + 1 : 1;
  return {
    ...meta,
    lastPlayDay: today,
    streak,
    bestStreak: Math.max(meta.bestStreak, streak),
  };
}

/** Streak as shown today: a streak that was not extended yesterday is over. */
export function visibleStreak(meta: GameMeta, today: string): number {
  if (!meta.lastPlayDay) return 0;
  return daysBetween(meta.lastPlayDay, today) <= 1 ? meta.streak : 0;
}

function sanitizeStats(raw: unknown): Record<string, MissionStats> {
  const out: Record<string, MissionStats> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^m\d{2}$/.test(id) || !v || typeof v !== 'object') continue;
    const r = v as Partial<MissionStats>;
    out[id] = {
      attempts: Number.isFinite(r.attempts) ? Number(r.attempts) : 0,
      passes: Number.isFinite(r.passes) ? Number(r.passes) : 0,
      hintsUsed: Number.isFinite(r.hintsUsed) ? Number(r.hintsUsed) : 0,
    };
  }
  return out;
}

/** One press of "Kontrol et": counts the attempt, a pass and the hints used. */
export function recordAttempt(
  meta: GameMeta,
  missionId: string,
  pass: boolean,
  hintsUsed: number
): GameMeta {
  const cur = meta.stats[missionId] ?? { attempts: 0, passes: 0, hintsUsed: 0 };
  return {
    ...meta,
    stats: {
      ...meta.stats,
      [missionId]: {
        attempts: cur.attempts + 1,
        passes: cur.passes + (pass ? 1 : 0),
        hintsUsed: cur.hintsUsed + (pass ? hintsUsed : 0),
      },
    },
  };
}

export interface StatsSummary {
  attempts: number;
  passes: number;
  passRatePct: number;
  hardest: { id: string; attempts: number } | null;
}

export function summarizeStats(meta: GameMeta): StatsSummary {
  const rows = Object.entries(meta.stats);
  const attempts = rows.reduce((n, [, r]) => n + r.attempts, 0);
  const passes = rows.reduce((n, [, r]) => n + r.passes, 0);
  const hardest = rows
    .filter(([, r]) => r.attempts > 1)
    .sort((a, b) => b[1].attempts - a[1].attempts)[0];
  return {
    attempts,
    passes,
    passRatePct: attempts ? Math.round((passes / attempts) * 100) : 0,
    hardest: hardest ? { id: hardest[0], attempts: hardest[1].attempts } : null,
  };
}

export function markAnnounced(meta: GameMeta, ids: string[]): GameMeta {
  const announced = Array.from(new Set([...meta.announced, ...ids]));
  return { ...meta, announced };
}

export function loadMeta(): GameMeta {
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return EMPTY_META;
    const p = JSON.parse(raw) as Partial<GameMeta>;
    return {
      lastPlayDay: typeof p.lastPlayDay === 'string' ? p.lastPlayDay : null,
      streak: Number.isFinite(p.streak) ? Number(p.streak) : 0,
      bestStreak: Number.isFinite(p.bestStreak) ? Number(p.bestStreak) : 0,
      announced: Array.isArray(p.announced)
        ? p.announced.filter((x): x is string => typeof x === 'string')
        : [],
      stats: sanitizeStats(p.stats),
      introDone: p.introDone === true,
      playerName: typeof p.playerName === 'string' ? p.playerName.slice(0, 40) : '',
    };
  } catch {
    return EMPTY_META;
  }
}

export function saveMeta(meta: GameMeta): void {
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage errors
  }
}

/** XP progress inside the current level (200 XP per level). */
export function levelProgress(completed: Completed): {
  level: number;
  intoLevel: number;
  perLevel: number;
  pct: number;
} {
  const { totalXp, level } = calculateTotalPlayerXp(completed);
  const perLevel = 200;
  const intoLevel = totalXp - (level - 1) * perLevel;
  return { level, intoLevel, perLevel, pct: Math.round((intoLevel / perLevel) * 100) };
}

export { calculateMissionXp };
