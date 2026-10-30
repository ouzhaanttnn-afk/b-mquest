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
}

export const EMPTY_META: GameMeta = {
  lastPlayDay: null,
  streak: 0,
  bestStreak: 0,
  announced: [],
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
    icon: ['🧱', '📏', '🏠', '🗂️', '📐', '🔎', '🏆', '📊'][ch.chapterNumber - 1],
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
