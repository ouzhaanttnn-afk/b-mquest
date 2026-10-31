import { REVIT_LESSONS_BY_ID } from './revitLessons';
import { TOOL_DEFS } from '../ui/workspace/toolActions';

export interface GlossaryEntry {
  /** Unique key: the mission id, or `k-…` for a stand-alone concept. */
  id: string;
  /** Mission that teaches it; empty for stand-alone concepts. */
  missionId: string;
  /** Where the concept comes from, shown under the title. */
  source?: string;
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

const SACKS_2020 =
  'Sacks, Girolami, Brilakis (2020), Building Information Modelling, Artificial Intelligence and Construction Tech';

/**
 * BIM ideas beyond the Revit menus, written in our own words. The research
 * background is credited; no text is taken from the paper.
 */
const CONCEPTS: Array<Omit<GlossaryEntry, 'missionId' | 'source' | 'revitPath'> & { revitPath?: string }> = [
  {
    id: 'k-ifc',
    title: 'IFC',
    concept: 'IFC (Industry Foundation Classes)',
    explanation:
      'Farklı BIM programlarının birbirine model aktarması için kullanılan açık dosya biçimi (ISO 16739). Dışa aktarımda bazı ilişkiler (ör. pencerenin hangi duvarda olduğu) kaybolabilir; bu yüzden aktarılan model kontrol edilmelidir.',
    revitPath: 'File → Export → IFC',
  },
  {
    id: 'k-lod',
    title: 'LOD',
    concept: 'LOD (Level of Development / Detail)',
    explanation:
      'Modelin bir aşamada ne kadar ayrıntılı ve güvenilir olması gerektiğini anlatan seviye. Konsept aşamasında kutu gibi bir duvar yeterliyken uygulama aşamasında katmanları ve bağlantıları bellidir.',
  },
  {
    id: 'k-iso19650',
    title: 'ISO 19650',
    concept: 'ISO 19650 — BIM ile bilgi yönetimi',
    explanation:
      'Projedeki bilginin kim tarafından, hangi biçimde ve ne zaman üretilip paylaşılacağını düzenleyen uluslararası standart. Dosya adlandırma, onay durumları ve ortak veri ortamı bu standardın konusudur.',
  },
  {
    id: 'k-explicit',
    title: 'Açık ve örtük bilgi',
    concept: 'Açık bilgi / örtük bilgi',
    explanation:
      'Modelde doğrudan yazılı olan bilgi açıktır (duvar yüksekliği). Modelden çıkarılması gereken bilgi örtüktür (oda alanı, iki duvarın bir odayı kapatıp kapatmadığı). Oyundaki oda alanı ve kapalı sınır örtük bilgiden hesaplanır.',
  },
  {
    id: 'k-rules',
    title: 'Kural tabanlı denetim',
    concept: 'Kural tabanlı model denetimi',
    explanation:
      'Yönetmelik maddelerinin “EĞER … İSE …” kurallarına çevrilip modelin otomatik kontrol edilmesi (ör. Solibri). Kural, nesneyi tanıyabilmelidir: adı verilmemiş bir oda “yatak odası” kuralına hiç girmez.',
  },
  {
    id: 'k-normalize',
    title: 'Normalleştirme',
    concept: 'Model normalleştirme',
    explanation:
      'Denetimden önce modeli kuralların beklediği hale getirmek: odalara doğru ad, nesnelere doğru tip, eksik parametreleri doldurmak. Denetim aracı ancak düzgün adlandırılmış ve sınıflandırılmış modeli doğru okur.',
  },
  {
    id: 'k-enrich',
    title: 'Anlamsal zenginleştirme',
    concept: 'Anlamsal zenginleştirme',
    explanation:
      'Modelde yazılı olmayan ama çıkarılabilen bilgiyi (oda türü, nesne grupları, eksik ilişkiler) kurallar veya makine öğrenmesiyle modele eklemek. Normalleştirmeyi elle yapmak yerine otomatikleştirmeyi hedefler.',
  },
  {
    id: 'k-graph',
    title: 'Model grafı',
    concept: 'BIM modelini graf olarak düşünmek',
    explanation:
      'Nesneler düğüm, ilişkiler bağlantıdır: kapı → taşıyan duvar, duvar → kat, oda → çevreleyen duvarlar. Seçili nesnenin altındaki “Kat · Host · Taşıdığı” satırı bu bağlantıları gösterir.',
  },
  {
    id: 'k-bim2field',
    title: "BIM'den sahaya",
    concept: "BIM'den sahaya (BIM-to-field)",
    explanation:
      'Model bilgisinin şantiyeye taşınması: tablette plan, total station ile aplikasyon, zemine lazerle yansıtılan bölme duvarı çizgileri, artırılmış gerçeklik.',
  },
  {
    id: 'k-field2bim',
    title: "Sahadan BIM'e ve dijital ikiz",
    concept: "Sahadan BIM'e (field-to-BIM), dijital ikiz",
    explanation:
      'Sahada yapılanın (as-built) ölçülüp modelle (as-designed) karşılaştırılması. Fark toleransı aşarsa model güncellenir ya da hata kaydedilir. Sürekli güncel tutulan modele dijital ikiz denir.',
  },
];

/** Every Revit concept the game teaches, built from the lesson data. */
export function buildGlossary(): GlossaryEntry[] {
  const concepts: GlossaryEntry[] = CONCEPTS.map((c) => ({
    ...c,
    missionId: '',
    revitPath: c.revitPath ?? '',
    source: SACKS_2020,
  }));
  return [...concepts, ...missionEntries()];
}

function missionEntries(): GlossaryEntry[] {
  return Object.values(REVIT_LESSONS_BY_ID)
    .sort((a, b) => a.stepNumber - b.stepNumber)
    .map((l) => ({
      id: l.id,
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
    const hay = fold(`${e.title} ${e.concept} ${e.explanation} ${e.revitPath} ${e.source ?? ''}`);
    return words.every((w) => hay.includes(w));
  });
}
