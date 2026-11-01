import { HOUSE1 } from './house1';

/** Stars per level, kept on this device next to (not inside) the mission save. */
export const CAMPAIGN_KEY = 'bimquest.campaign.v1';

export interface CampaignProgress {
  stars: Record<string, number>;
}

export function loadProgress(): CampaignProgress {
  try {
    const raw = window.localStorage.getItem(CAMPAIGN_KEY);
    const p = raw ? (JSON.parse(raw) as Partial<CampaignProgress>) : {};
    const stars: Record<string, number> = {};
    for (const l of HOUSE1) {
      const v = p.stars?.[l.id];
      if (typeof v === 'number' && v >= 1 && v <= 3) stars[l.id] = Math.round(v);
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

/** Keeps the best result for a level. */
export function recordStars(p: CampaignProgress, levelId: string, stars: number): CampaignProgress {
  return { stars: { ...p.stars, [levelId]: Math.max(p.stars[levelId] ?? 0, stars) } };
}

export const isUnlocked = (p: CampaignProgress, index: number) =>
  index === 0 || (p.stars[HOUSE1[index - 1].id] ?? 0) > 0;

export const totalStars = (p: CampaignProgress) => Object.values(p.stars).reduce((a, b) => a + b, 0);
