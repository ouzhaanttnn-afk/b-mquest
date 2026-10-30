import { calculateTotalPlayerXp } from './pedagogy';

export interface CertificateData {
  name: string;
  totalXp: number;
  level: number;
  rankTitle: string;
  missions: number;
  goldCount: number;
  dateLabel: string;
}

export const CERTIFICATE_UNLOCK_MISSION = 'm50';

export function certificateUnlocked(completed: Record<string, unknown>): boolean {
  return CERTIFICATE_UNLOCK_MISSION in completed;
}

/** Keeps the printed name short and free of control characters. */
export function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

export function buildCertificate(
  completed: Record<string, { bestScore: number }>,
  name: string,
  date: Date
): CertificateData {
  const xp = calculateTotalPlayerXp(completed);
  return {
    name: cleanName(name) || 'BIM Modelleyici',
    totalXp: xp.totalXp,
    level: xp.level,
    rankTitle: xp.rankTitle,
    missions: Object.keys(completed).length,
    goldCount: Object.values(completed).filter((c) => c.bestScore >= 90).length,
    dateLabel: date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}
