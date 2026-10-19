import type { MissionTask } from '../domain/types';
import { REVIT_LESSONS_BY_ID } from './revitLessons';

export interface PlannedMissionSummary {
  id: string;
  stepNumber: number;
  title: string;
  focusConcept: string;
  revitPath: string;
  difficultyPhase: 'beginner' | 'intermediate' | 'advanced' | 'final';
  playableInPrototype: boolean;
}

export interface CurriculumChapter {
  chapterNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  id: string;
  title: string;
  subtitle: string;
  missionRangeLabel: string;
  pedagogyNote: string;
  missions: PlannedMissionSummary[];
}

function buildChapterMissions(start: number, end: number): PlannedMissionSummary[] {
  const list: PlannedMissionSummary[] = [];
  for (let i = start; i <= end; i++) {
    const id = `m${String(i).padStart(2, '0')}`;
    const meta = REVIT_LESSONS_BY_ID[id];
    list.push({
      id,
      stepNumber: i,
      title: meta?.title ?? `Görev ${i}`,
      focusConcept: meta?.learningConcept ?? 'Revit BIM Kavramı',
      revitPath: meta?.revitPath ?? 'Revit: Modify → Properties',
      difficultyPhase: meta?.difficultyPhase ?? 'intermediate',
      playableInPrototype: true,
    });
  }
  return list;
}

/**
 * 7-Chapter / 50-Mission Progressive Revit Mastery Curriculum.
 * Every mission (m01..m50) is playable directly in the 2D/3D BIM workspace.
 */
export const SEVEN_CHAPTER_CURRICULUM: CurriculumChapter[] = [
  {
    chapterNumber: 1,
    id: 'ch01',
    title: 'Bölüm 1: Revit & BIM Temelleri',
    subtitle:
      'Model okuma, nesne seçimi, Properties (Özellikler) paleti, Unconnected Height, Wall Thickness, Instance vs Type mantığı ve ilk model denetimi.',
    missionRangeLabel: 'Görev 01 – 06',
    pedagogyNote: '%70 Öğretim · %30 Uygulama — Temel Revit arayüz ve parametre mantığı',
    missions: buildChapterMissions(1, 6),
  },
  {
    chapterNumber: 2,
    id: 'ch02',
    title: 'Bölüm 2: Level, Grid ve Model Organizasyonu',
    subtitle:
      'Kat düzlemleri (Level), Base Constraint, Top Constraint, aks (Grid) sistemleri ve yanlış kata bağlanmış elemanların düzeltilmesi.',
    missionRangeLabel: 'Görev 07 – 12',
    pedagogyNote: '%50 Öğretim · %50 Uygulama — Kat ve aks referans sistemi',
    missions: buildChapterMissions(7, 12),
  },
  {
    chapterNumber: 3,
    id: 'ch03',
    title: 'Bölüm 3: Temel Mimari Modelleme',
    subtitle:
      'Room Bounding kapalı oda, duvar zinciri (Chain), Door/Window yerleştirme, Host ilişkisi, Sill Height, Floor, Roof, Stair ve Room tanımlama.',
    missionRangeLabel: 'Görev 13 – 22',
    pedagogyNote: '%50 Öğretim · %50 Uygulama — Çekirdek mimari eleman üretimi',
    missions: buildChapterMissions(13, 22),
  },
  {
    chapterNumber: 4,
    id: 'ch04',
    title: 'Bölüm 4: BIM Bilgisi ve Parametreler',
    subtitle:
      'Door/Window Type değişimi, Family & Type hiyerarşisi, yangın dayanım sınıfı (Fire Rating), Room Name/Number, Mark poz tutarlılığı ve veri denetimi.',
    missionRangeLabel: 'Görev 23 – 29',
    pedagogyNote: '%50 Öğretim · %50 Uygulama — BIM veritabanı ve metraj doğruluğu',
    missions: buildChapterMissions(23, 29),
  },
  {
    chapterNumber: 5,
    id: 'ch05',
    title: 'Bölüm 5: View, Section, Elevation ve Dokümantasyon',
    subtitle:
      'Plan View Cut Plane, Section (Kesit), Elevation (Cephe), Crop Region, Aligned Dimension, Door/Room Tag, Sheet oluşturma ve pafta yerleşimi.',
    missionRangeLabel: 'Görev 30 – 37',
    pedagogyNote: '%40 Öğretim · %60 Uygulama — Modelden teknik çizim ve pafta üretimi',
    missions: buildChapterMissions(30, 37),
  },
  {
    chapterNumber: 6,
    id: 'ch06',
    title: 'Bölüm 6: Model Kontrolü & Gerçek Proje Problemleri',
    subtitle:
      'Doğrudan tarif olmadan gerçek proje hatalarını teşhis etme: açık Room Boundary, yanlış Level, tutarsız kapı tipleri, hatalı Sill kotları ve QA denetimi.',
    missionRangeLabel: 'Görev 38 – 43',
    pedagogyNote: '%20 Öğretim · %80 Problem Çözme — Kendi başına model analizi ve hata ayıklama',
    missions: buildChapterMissions(38, 43),
  },
  {
    chapterNumber: 7,
    id: 'ch07',
    title: 'Bölüm 7: Final Proje — Tek Katlı Konut Teslimi',
    subtitle:
      '65–80 m² tek katlı konut projesini sıfırdan teslim aşamasına taşıma: Project Setup, Zemin Kat Kabuğu, Kapı/Pencere/Oda, Kesit/Ölçü/Etiket, Pafta ve QA.',
    missionRangeLabel: 'Görev 44 – 50',
    pedagogyNote: 'Proje Briefi + Başarı Kriterleri — Hangi butona basılacağı söylenmez, gerçek Revit iş akışı uygulanır',
    missions: buildChapterMissions(44, 50),
  },
];

// Export alias for backward compatibility across modules/tests
export const SIX_CHAPTER_CURRICULUM: CurriculumChapter[] = SEVEN_CHAPTER_CURRICULUM;

export function getTotalCurriculumMissionCount(): number {
  return SEVEN_CHAPTER_CURRICULUM.reduce((acc, ch) => acc + ch.missions.length, 0);
}

export function getChapterForMissionId(missionId: string): CurriculumChapter | undefined {
  return SEVEN_CHAPTER_CURRICULUM.find((ch) =>
    ch.missions.some((m) => m.id === missionId)
  );
}

export function isMissionPlayable(
  missionId: string,
  tasksById: Record<string, MissionTask>
): boolean {
  return Boolean(tasksById[missionId]);
}
