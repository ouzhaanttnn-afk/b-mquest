import type { HouseDef } from './model';

/** Stars per level, kept on this device. Level ids are unique across houses. */
export const CAMPAIGN_KEY = 'bimquest.campaign.v1';

export interface CampaignProgress {
  stars: Record<string, number>;
}

export function loadProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<CampaignProgress>) : {};
    const stars: Record<string, number> = {};
    for (const [id, v] of Object.entries(p.stars ?? {})) {
      if (/^h\d+-\d+$/.test(id) && typeof v === 'number' && v >= 1 && v <= 3) stars[id] = Math.round(v);
    }
    return { stars };
  } catch {
    return { stars: {} };
  }
}

export function saveProgress(p: CampaignProgress): void {
  try {
    window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked: progress lasts for this session only.
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(CAMPAIGN_KEY);
  } catch {
    // Ignore storage errors
  }
}

/** Keeps the best result for a level. */
export function recordStars(p: CampaignProgress, levelId: string, stars: number): CampaignProgress {
  return { stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) } };
}

export const isUnlocked = (house: HouseDef, p: CampaignProgress, index: number) =>
  index === 0 || (p.stars[house.levels[index - 1].id] ?? 0) > 0;

export const houseStars = (house: HouseDef, p: CampaignProgress) =>
  house.levels.reduce((s, l) => s + (p.stars[l.id] ?? 0), 0);

export const houseDone = (house: HouseDef, p: CampaignProgress) => house.levels.every((l) => (p.stars[l.id] ?? 0) > 0);

/** A house opens when the one before it is finished. */
export const houseUnlocked = (houses: HouseDef[], p: CampaignProgress, index: number) =>
  index === 0 || houseDone(houses[index - 1], p);

export const totalStars = (p: CampaignProgress) => Object.values(p.stars).reduce((a, b) => a + b, 0);
