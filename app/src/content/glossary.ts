import { REVIT_LESSONS_BY_ID } from './revitLessons';
import { TOOL_DEFS } from '../ui/workspace/toolActions';

export interface GlossaryEntry {
  missionId: string;
  title: string;
  concept: string;
  explanation: string;
  revitPath: string;
}

export interface ShortcutEntry {
  keys: string;
  label: string;
  group: string;
}

/** Every Revit concept the game teaches, built from the lesson data. */
export function buildGlossary(): GlossaryEntry[] {
  return Object.values(REVIT_LESSONS_BY_ID)
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((l) => ({
      missionId: l.id,
      title: l.title,
      concept: l.learningConcept,
      explanation: l.learningText,
      revitPath: l.revitPath,
    }));
}

export function shortcutList(): ShortcutEntry[] {
  return TOOL_DEFS.filter((t) => t.keys).map((t) => ({
    keys: t.keys as string,
    label: t.label,
    group: t.group,
  }));
}

/** Lower-case that folds Turkish dotted/dotless i so "kat" and "KAT", "İ" and "i" match. */
export function fold(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function searchGlossary(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries;
  return entries.filter((e) => {
    const hay = fold(`${e.title} ${e.concept} ${e.explanation} ${e.revitPath}`);
    return words.every((w) => hay.includes(w));
  });
}
