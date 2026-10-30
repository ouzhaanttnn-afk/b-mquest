import type {
  BimElement,
  BimModel,
  CreatableElementType,
  DoorElement,
  EditableField,
  ElementType,
  MissionTask,
  TaskCriterion,
  WallElement,
  WindowElement,
} from '../domain/types';
import type { RevitLessonMeta } from './revitLessons';

/**
 * Missions that run on real BIM objects (Grid, Window, Floor, Roof, Stair,
 * Room, Type, Top Constraint) instead of "change a number on a wall".
 * The mission id, chapter and title stay as in the curriculum.
 */

const L0 = { id: 'l0', elevation: 0, name: 'Zemin Kat' };
const l1 = (elevation: number) => ({ id: 'l1', elevation, name: '1. Kat' });

const wall = (
  id: string,
  start: [number, number],
  end: [number, number],
  extra: Partial<WallElement> = {}
): WallElement => ({
  id,
  type: 'wall',
  name: id,
  baseLevelId: 'l0',
  start,
  end,
  height: 3000,
  thickness: 200,
  ...extra,
});

const box = (extra: Partial<WallElement> = {}): WallElement[] => [
  wall('w1', [0, 0], [6000, 0], extra),
  wall('w2', [6000, 0], [6000, 4000], extra),
  wall('w3', [6000, 4000], [0, 4000], extra),
  wall('w4', [0, 4000], [0, 0], extra),
];

const window1 = (
  id: string,
  host: string,
  offset: number,
  extra: Partial<WindowElement> = {}
): WindowElement => ({
  id,
  type: 'window',
  name: 'Pencere',
  hostWallId: host,
  offset,
  width: 1200,
  height: 1200,
  sill: 900,
  mark: `W-${id.slice(3)}`,
  ...extra,
});

const door1 = (
  id: string,
  host: string,
  offset: number,
  extra: Partial<DoorElement> = {}
): DoorElement => ({
  id,
  type: 'door',
  name: 'Kapı',
  hostWallId: host,
  offset,
  width: 900,
  height: 2100,
  sill: 0,
  mark: `D-${id.slice(1).padStart(2, '0')}`,
  fireRating: 'none',
  ...extra,
});

const DT900: ElementType = {
  id: 'dt900',
  category: 'door',
  family: 'Single-Flush',
  name: '900 x 2100mm',
  params: { width: 900, height: 2100 },
};
const DT800: ElementType = {
  id: 'dt800',
  category: 'door',
  family: 'Single-Flush',
  name: '800 x 2100mm',
  params: { width: 800, height: 2100 },
};

interface Spec {
  lesson: Partial<RevitLessonMeta> & Pick<RevitLessonMeta, 'objective' | 'hintLevels' | 'primaryFields'>;
  levels: BimModel['levels'];
  elements: BimElement[];
  types?: ElementType[];
  editable: EditableField[];
  creatable?: CreatableElementType[];
  seeds?: string[];
  minutes?: number;
  criteria: TaskCriterion[];
}

const hints = (area: string, object: string, param: string, steps: string): RevitLessonMeta['hintLevels'] => [
  `İpucu 1 (Alan): ${area}`,
  `İpucu 2 (Nesne): ${object}`,
  `İpucu 3 (Parametre): ${param}`,
  `Adım Adım Rehber: ${steps}`,
];

const WT200: ElementType = {
  id: 'wt200',
  category: 'wall',
  family: 'Basic Wall',
  name: 'Generic - 200mm',
  params: { thickness: 200 },
};
const WT100: ElementType = {
  id: 'wt100',
  category: 'wall',
  family: 'Basic Wall',
  name: 'Generic - 100mm',
  params: { thickness: 100 },
};
const WN900: ElementType = {
  id: 'wn900',
  category: 'window',
  family: 'Fixed',
  name: '900 x 1200mm',
  params: { width: 900, height: 1200 },
};

export const BIM_MISSION_SPECS: Record<string, Spec> = {
  // ---- Faz 1 düzeltmesi: konusuyla uyuşmayan görevler yeniden yazıldı -----
  m07: {
    lesson: {
      objective:
        'Projede yalnızca Zemin Kat var. 3300 mm kot yüksekliğinde ikinci bir kat (Level) ekle.',
      hintLevels: hints(
        'Çok katlı bir bina için yatay referans düzlemlerine ihtiyaç var.',
        'Eklemen gereken şey bir duvar değil, bir Level nesnesi.',
        'Katlar bölümünde yeni kat ekleyebilir ve kotunu değiştirebilirsin.',
        '1) Katlar’ı aç. 2) Kat ekle. 3) Yeni katın kotunu 3300 mm yap. 4) Kontrol Et.'
      ),
      primaryFields: ['elevation'],
    },
    levels: [L0],
    elements: [...box()],
    editable: ['elevation'],
    minutes: 5,
    criteria: [
      { id: 'c_n', type: 'metric', metric: 'levelCount', min: 2, max: 2, message: 'Projede iki kat (Level) olmalı.' },
      { id: 'c_e', type: 'metric', metric: 'maxLevelElevation', min: 3300, max: 3300, message: 'Üst katın kotu 3300 mm olmalı.' },
    ],
  },
  m11: {
    lesson: {
      objective:
        'Düşey duvar A aksından 150 mm kaymış. Duvarı A aksının üzerine oturt.',
      hintLevels: hints(
        'Plana bak: duvar ile aks aynı çizgide değil.',
        'Kayan şey aks değil, duvar (w1). Aks referanstır.',
        'Duvarın başlangıç ve bitiş X değerleri aksın X değeriyle aynı olmalı.',
        '1) w1’i seç. 2) Başlangıç ve bitiş X koordinatını aksın konumuna getir (ya da duvarı taşı). 3) Kontrol Et.'
      ),
      primaryFields: ['start', 'end'],
    },
    levels: [L0],
    elements: [
      wall('w1', [150, 0], [150, 4000]),
      { id: 'ga', type: 'grid', name: 'A', start: [0, -1000], end: [0, 5000] },
    ],
    editable: ['start', 'end'],
    seeds: ['w1'],
    minutes: 5,
    criteria: [
      { id: 'c_al', type: 'compare', elementId: 'w1', field: 'axisPos', otherElementId: 'ga', otherField: 'axisPos', tolerance: 0, message: 'Duvar A aksının üzerinde olmalı.' },
      { id: 'c_len', type: 'exists', category: 'wall', where: { id: 'w1', length: 4000 }, message: 'Duvar boyu 4000 mm kalmalı.' },
    ],
  },
  m23: {
    lesson: {
      objective:
        'd1 kapısı yanlış tipte (800 × 2100). Kapıyı standart 900 × 2100 mm tipine geçir.',
      hintLevels: hints(
        'Kapının ölçüsü tek başına değil, tipine bağlı olarak değişir.',
        'Değişecek olan kapının genişliği değil, tipi.',
        'Properties panelindeki Tip seçicisinden 900 × 2100 tipini seç.',
        '1) d1’i seç. 2) Tip seçicisinden 900 x 2100mm’yi seç. 3) Genişliğin 900 olduğunu gör. 4) Kontrol Et.'
      ),
      primaryFields: ['typeId'],
    },
    levels: [L0],
    elements: [...box(), door1('d1', 'w1', 2550, { width: 800, typeId: 'dt800', mark: 'D-01' })],
    types: [DT800, DT900],
    editable: ['typeId'],
    seeds: ['d1'],
    minutes: 5,
    criteria: [
      { id: 'c_t', type: 'property', elementId: 'd1', field: 'typeId', expected: 'dt900', tolerance: 0, message: 'd1 kapısı 900 x 2100mm tipini kullanmalı.' },
      { id: 'c_w', type: 'exists', category: 'door', where: { id: 'd1', width: 900 }, message: 'd1 genişliği 900 mm olmalı.' },
    ],
  },

  // ---- Çeşitlendirme: şablon görevler kendi senaryolarına kavuştu ---------
  m13: {
    lesson: {
      objective:
        'Zemin Kat’ta 5000 × 4000 mm kapalı bir hacim oluştur: 4 duvar, 20 m² iç alan.',
      hintLevels: hints(
        'Dört duvarın uçları birbirine değmeli; açık köşe hacmi kapatmaz.',
        'Plana başlangıçtan (0, 0) başlayıp saat yönünde dört duvar çizmen yeterli.',
        'Ölçüler: 5000 mm yatay, 4000 mm düşey. Zincirleme çizim köşeleri kendiliğinden birleştirir.',
        '1) Duvar aracını seç. 2) (0,0) → (5000,0) → (5000,4000) → (0,4000) → (0,0). 3) Kontrol Et. İstersen Ölçüyle çiz bölümünü kullan.'
      ),
      primaryFields: ['start', 'end'],
    },
    levels: [L0],
    elements: [],
    editable: ['start', 'end', 'height', 'thickness', 'name'],
    creatable: ['wall'],
    minutes: 6,
    criteria: [
      { id: 'c_n', type: 'metric', metric: 'wallCount', min: 4, max: 4, message: 'Tam olarak 4 duvar olmalı.' },
      { id: 'c_a', type: 'metric', metric: 'enclosedAreaM2', min: 20, max: 20, message: 'Duvarlar 20 m² kapalı alan oluşturmalı.' },
    ],
  },
  m14: {
    lesson: {
      objective:
        'Zincir çizimle L biçimli bir plan kur: (0,0) → (6000,0) → (6000,2000) → (3000,2000) → (3000,4000) → (0,4000) → (0,0). Toplam 18 m².',
      hintLevels: hints(
        'Plan dikdörtgen değil; bir köşesi çıkıntılı, yani 6 duvar gerekir.',
        'Her duvar bir öncekinin bittiği yerden başlar; son duvar başlangıç noktasına döner.',
        'Zincir başlangıca dönünce kendiliğinden kapanır; ölçüleri sırayla gir.',
        '1) Duvar aracı. 2) Köşeleri sırayla işaretle ya da Ölçüyle çiz: →6000, ↓2000, ←3000, ↓2000, ←3000, ↑4000. 3) Kontrol Et.'
      ),
      primaryFields: ['start', 'end'],
    },
    levels: [L0],
    elements: [],
    editable: ['start', 'end', 'height', 'thickness', 'name'],
    creatable: ['wall'],
    minutes: 8,
    criteria: [
      { id: 'c_n', type: 'metric', metric: 'wallCount', min: 6, max: 6, message: 'L biçimli plan 6 duvardan oluşmalı.' },
      { id: 'c_a', type: 'metric', metric: 'enclosedAreaM2', min: 18, max: 18, message: 'Kapalı alan 18 m² olmalı.' },
    ],
  },
  m28: {
    lesson: {
      objective:
        'Kapı listesinde üç ayrı veri hatası var. Tüm kapıların genişliği 900 mm, pozları D-01…D-04 benzersiz olmalı ve koridora açılan d4 kapısı EI30 olmalı.',
      hintLevels: hints(
        'Dört kapıyı karşılaştır: ölçü, poz ve yangın sınıfı sütunlarına bak.',
        'Hatalar üç farklı kapıda; her biri farklı bir alanda.',
        'Biri tekrar eden poz, biri dar genişlik, biri eksik yangın sınıfı.',
        '1) Çizelgeler’i aç. 2) d2 pozunu D-02 yap. 3) d3 genişliğini 900 yap. 4) d4 yangın sınıfını EI30 yap. 5) Kontrol Et.'
      ),
      primaryFields: ['mark', 'width', 'fireRating'],
    },
    levels: [L0],
    elements: [
      ...box(),
      door1('d1', 'w1', 1000, { mark: 'D-01' }),
      door1('d2', 'w1', 3200, { mark: 'D-01' }),
      door1('d3', 'w3', 1500, { mark: 'D-03', width: 800 }),
      door1('d4', 'w3', 4000, { mark: 'D-04' }),
    ],
    editable: ['mark', 'width', 'fireRating'],
    seeds: ['d2', 'd3', 'd4'],
    minutes: 8,
    criteria: [
      { id: 'c_m', type: 'property', elementId: 'd2', field: 'mark', expected: 'D-02', tolerance: 0, message: 'd2 pozu benzersiz olmalı (D-02).' },
      { id: 'c_w', type: 'property', elementId: 'd3', field: 'width', expected: 900, tolerance: 0, message: 'd3 genişliği 900 mm olmalı.' },
      { id: 'c_f', type: 'property', elementId: 'd4', field: 'fireRating', expected: 'EI30', tolerance: 0, message: 'd4 kapısı EI30 olmalı.' },
    ],
  },

  // ---- Bölüm 2: Level, Grid ---------------------------------------------
  m09: {
    lesson: {
      objective:
        'Dört duvarın üst kotu birbirinden farklı. Hepsini 1. Kat (l1) seviyesine bağla; yükseklik kat kotundan gelsin.',
      hintLevels: hints(
        '3B sahnede duvar üstlerinin aynı hizada olup olmadığına bak.',
        'w1, w2, w3 ve w4 aynı kuralla bağlanmalı.',
        'Properties panelinde Constraints grubundaki üst sınır alanını incele.',
        '1) Bir duvarı seç. 2) Top Constraint alanında Up to level: 1. Kat seç. 3) Aynısını diğer duvarlara uygula. 4) Kontrol Et.'
      ),
      primaryFields: ['topConstraint', 'topOffset'],
    },
    levels: [L0, l1(3000)],
    elements: box({ height: 2600 }),
    editable: ['topConstraint', 'topOffset'],
    seeds: ['w1', 'w2', 'w3', 'w4'],
    criteria: [
      { id: 'c_top', type: 'constraint', topConstraint: 'l1', message: 'Tüm duvarlar l1 seviyesine bağlı olmalı.' },
      { id: 'c_eq', type: 'allEqual', category: 'wall', field: 'topElevation', message: 'Tüm duvar üst kotları eşit olmalı.' },
    ],
  },
  m10: {
    lesson: {
      objective:
        'Plan için 4 aks çiz: A ve B düşey (x = 0 ve x = 6000), 1 ve 2 yatay (z = 0 ve z = 4000).',
      hintLevels: hints(
        'Aksların plandaki konumunu 0–6000 × 0–4000 mm çerçevesine göre düşün.',
        'İki düşey ve iki yatay Grid nesnesi gerekir; adları otomatik verilir.',
        'Başlangıç ve bitiş koordinatları aks çizgisinin yönünü belirler.',
        '1) + Aks ile A: (0,-1000)→(0,5000). 2) B: (6000,-1000)→(6000,5000). 3) 1: (-1000,0)→(7000,0). 4) 2: (-1000,4000)→(7000,4000).'
      ),
      primaryFields: ['name'],
    },
    levels: [L0],
    elements: [],
    editable: ['name'],
    creatable: ['grid'],
    criteria: [
      { id: 'c_n', type: 'count', elementType: 'grid', expected: 4, message: '4 aks çizgisi gerekli.' },
      { id: 'c_a', type: 'exists', category: 'grid', where: { name: 'A', axisPos: 0 }, message: 'Aks A, x = 0 mm üzerinde olmalı.' },
      { id: 'c_b', type: 'exists', category: 'grid', where: { name: 'B', axisPos: 6000 }, message: 'Aks B, x = 6000 mm üzerinde olmalı.' },
      { id: 'c_1', type: 'exists', category: 'grid', where: { name: '1', axisPos: 0 }, message: 'Aks 1, z = 0 mm üzerinde olmalı.' },
      { id: 'c_2', type: 'exists', category: 'grid', where: { name: '2', axisPos: 4000 }, message: 'Aks 2, z = 4000 mm üzerinde olmalı.' },
    ],
  },
  m12: {
    lesson: {
      objective:
        'Duvarlar 1. Kat seviyesine bağlı. 1. Kat kotunu 3200 mm yap ve duvarların onunla birlikte yükseldiğini doğrula.',
      hintLevels: hints(
        'Duvarlar kat kotunu izliyorsa, kotu değiştirmek tek hamlede hepsini etkiler.',
        'Değişecek şey duvarlar değil, bir Level (kat) nesnesidir.',
        'Katlar bölümünde 1. Kat’ın kot (elevation) değerini bul.',
        '1) Nesneler panelinde Katlar bölümünü aç. 2) 1. Kat kotunu 3200 mm yap. 3) Duvar yüksekliklerinin 3200 olduğunu gör. 4) Kontrol Et.'
      ),
      primaryFields: ['elevation'],
    },
    levels: [L0, l1(3000)],
    elements: box({ topConstraint: 'l1', topOffset: 0, height: 3000 }),
    editable: ['elevation'],
    criteria: [
      { id: 'c_top', type: 'constraint', topConstraint: 'l1', message: 'Duvarlar l1 seviyesine bağlı kalmalı.' },
      { id: 'c_h1', type: 'property', elementId: 'w1', field: 'height', expected: 3200, tolerance: 0, message: 'w1 üst kotu 3200 mm olmalı.' },
      { id: 'c_h3', type: 'property', elementId: 'w3', field: 'height', expected: 3200, tolerance: 0, message: 'w3 üst kotu 3200 mm olmalı.' },
    ],
  },

  // ---- Bölüm 3: Wall, Door, Window, Floor, Roof, Stair --------------------
  m17: {
    lesson: {
      objective:
        'Güney duvarına (w_south) 1200 × 1200 mm bir pencere yerleştir. Pencere duvarın içinde kalmalı.',
      hintLevels: hints(
        'Pencere boşlukta durmaz; bir duvara bağlı (hosted) olmalı.',
        'Güney duvarı bu görevde host eleman olacak.',
        'Ofset, genişlik, yükseklik ve parapet (sill) değerlerini duvar sınırlarına göre seç.',
        '1) + Pencere. 2) Host: w_south. 3) Genişlik 1200, yükseklik 1200. 4) Oluştur ve Kontrol Et.'
      ),
      primaryFields: ['hostWallId', 'offset', 'width', 'height', 'sill'],
    },
    levels: [L0],
    elements: [
      wall('w_south', [0, 0], [6000, 0]),
      wall('w_east', [6000, 0], [6000, 4000]),
      wall('w_north', [6000, 4000], [0, 4000]),
      wall('w_west', [0, 4000], [0, 0]),
    ],
    editable: ['hostWallId', 'offset', 'width', 'height', 'sill', 'mark', 'name'],
    creatable: ['window'],
    criteria: [
      { id: 'c_n', type: 'count', elementType: 'window', expected: 1, message: '1 adet pencere gerekli.' },
      { id: 'c_host', type: 'property', elementId: 'win1', field: 'hostWallId', expected: 'w_south', tolerance: 0, message: 'win1, w_south duvarına bağlı olmalı.' },
      { id: 'c_w', type: 'property', elementId: 'win1', field: 'width', expected: 1200, tolerance: 0, message: 'win1 genişliği 1200 mm olmalı.' },
      { id: 'c_h', type: 'property', elementId: 'win1', field: 'height', expected: 1200, tolerance: 0, message: 'win1 yüksekliği 1200 mm olmalı.' },
    ],
  },
  m18: {
    lesson: {
      objective:
        'Pencerenin parapeti (Sill Height) 300 mm; oturan bir kişinin göz hizasında olması için 900 mm olmalı.',
      hintLevels: hints(
        'Pencerenin zeminden ne kadar yukarıda başladığına bak.',
        'win1 penceresi seçilmeli.',
        'Parapet yüksekliği pencerenin alt kenarının kotudur.',
        '1) win1’i seç. 2) Sill Height değerini 900 mm yap. 3) Kontrol Et.'
      ),
      primaryFields: ['sill'],
    },
    levels: [L0],
    elements: [...box(), window1('win1', 'w1', 2400, { sill: 300 })],
    editable: ['sill'],
    seeds: ['win1'],
    criteria: [
      { id: 'c_s', type: 'property', elementId: 'win1', field: 'sill', expected: 900, tolerance: 0, message: 'win1 parapet yüksekliği 900 mm olmalı.' },
    ],
  },
  m19: {
    lesson: {
      objective: 'Dört duvarın oluşturduğu alana, Zemin Kat’a ait 150 mm kalınlığında bir döşeme (Floor) ekle.',
      hintLevels: hints(
        'Odanın zemini henüz boş; yatay bir yapı elemanı eksik.',
        'Döşeme bir duvar değildir; kendi kalınlığı ve kat bağlantısı vardır.',
        'Kalınlık (Thickness) ve Level alanlarını kontrol et.',
        '1) + Döşeme ile Zemin Kat’ta oluştur. 2) Kalınlığı 150 mm yap. 3) Kontrol Et.'
      ),
      primaryFields: ['thickness', 'levelId'],
    },
    levels: [L0],
    elements: box(),
    editable: ['thickness', 'levelId', 'name'],
    creatable: ['floor'],
    criteria: [
      { id: 'c_n', type: 'count', elementType: 'floor', expected: 1, message: '1 adet döşeme gerekli.' },
      { id: 'c_l', type: 'property', elementId: 'f1', field: 'levelId', expected: 'l0', tolerance: 0, message: 'f1 Zemin Kat’a (l0) ait olmalı.' },
      { id: 'c_t', type: 'property', elementId: 'f1', field: 'thickness', expected: 150, tolerance: 0, message: 'f1 kalınlığı 150 mm olmalı.' },
    ],
  },
  m20: {
    lesson: {
      objective:
        'Duvarların üstüne 30° eğimli, 500 mm çıkmalı bir çatı kur. Çatı, duvar üst kotunun bulunduğu katta oturmalı.',
      hintLevels: hints(
        'Çatının duvarların tam üstünde mi, havada mı olduğuna 3B’de bak.',
        'Çatı bir kata bağlanır; hangi katın kotu duvar üstüne denk geliyor?',
        'Base Level, eğim ve çıkma (overhang) alanlarını kullan.',
        '1) + Çatı. 2) Taban katı: duvar üst kotuyla aynı kat. 3) Eğim 30°, çıkma 500 mm. 4) Kontrol Et.'
      ),
      primaryFields: ['baseLevelId', 'slope', 'overhang'],
    },
    levels: [L0, l1(3000)],
    elements: box(),
    editable: ['baseLevelId', 'slope', 'overhang'],
    creatable: ['roof'],
    criteria: [
      { id: 'c_n', type: 'count', elementType: 'roof', expected: 1, message: '1 adet çatı gerekli.' },
      { id: 'c_seat', type: 'compare', elementId: 'w1', field: 'topElevation', otherElementId: 'rf1', otherField: 'baseElevation', tolerance: 0, message: 'Çatı, duvar üst kotunda oturmalı.' },
      { id: 'c_sl', type: 'property', elementId: 'rf1', field: 'slope', expected: 30, tolerance: 0, message: 'Çatı eğimi 30° olmalı.' },
      { id: 'c_ov', type: 'property', elementId: 'rf1', field: 'overhang', expected: 500, tolerance: 0, message: 'Çatı çıkması 500 mm olmalı.' },
    ],
  },
  m21: {
    lesson: {
      objective:
        'Zemin Kat ile 1. Kat (+3150 mm) arasına merdiven yerleştir. Basamak sayısı × basamak yüksekliği kat farkına tam eşit olsun.',
      hintLevels: hints(
        'Merdiven iki kat arasındaki yüksekliği basamaklara bölerek aşar.',
        'Merdivenin alt ve üst katını, basamak sayısını ve yüksekliğini belirlemelisin.',
        'Toplam yükseliş = basamak sayısı × basamak yüksekliği.',
        '1) + Merdiven. 2) Alt kat l0, üst kat l1. 3) Basamak sayısı × yükseklik = 3150 olacak şekilde seç. 4) Kontrol Et.'
      ),
      primaryFields: ['baseLevelId', 'topLevelId', 'risers', 'riserHeight'],
    },
    levels: [L0, l1(3150)],
    elements: box(),
    editable: ['baseLevelId', 'topLevelId', 'risers', 'riserHeight', 'treadDepth', 'direction'],
    creatable: ['stair'],
    criteria: [
      { id: 'c_n', type: 'count', elementType: 'stair', expected: 1, message: '1 adet merdiven gerekli.' },
      { id: 'c_top', type: 'property', elementId: 's1', field: 'topLevelId', expected: 'l1', tolerance: 0, message: 's1 üst katı l1 olmalı.' },
      { id: 'c_rise', type: 'compare', elementId: 's1', field: 'rise', otherElementId: 's1', otherField: 'levelRise', tolerance: 0, message: 'Basamak toplamı kat farkına eşit olmalı.' },
    ],
  },
  m22: {
    lesson: {
      objective: 'Duvarların çevrelediği alana "Salon" adlı, 101 numaralı bir Oda (Room) yerleştir.',
      hintLevels: hints(
        'Duvarlar bir alan çevreliyor ama bu alan henüz bir "mekan" değil.',
        'Mekan bilgisini taşıyan nesne bir Room’dur ve kapalı sınır ister.',
        'Room’un adı ve numarası ayrı parametrelerdir.',
        '1) + Oda. 2) Odayı alanın içindeki bir noktaya koy (ör. 3000, 2000). 3) Ad: Salon, Numara: 101. 4) Kontrol Et.'
      ),
      primaryFields: ['name', 'number'],
    },
    levels: [L0],
    elements: box(),
    editable: ['name', 'number', 'seedPoint'],
    creatable: ['room'],
    criteria: [
      { id: 'c_r', type: 'exists', category: 'room', where: { name: 'Salon', number: '101' }, message: 'Salon / 101 adlı oda gerekli.' },
      { id: 'c_cl', type: 'roomClosed', message: 'Oda sınırı kapalı olmalı.' },
    ],
  },
  m24: {
    lesson: {
      objective:
        'İki pencere de aynı tipi kullanıyor (900 × 1200). Tip boyutunu değiştirerek ikisini birden 1200 mm genişliğe getir.',
      hintLevels: hints(
        'Pencerelerin ikisi de aynı boyutta; ayrı ayrı değiştirmek yanlış yaklaşım.',
        'Boyut, tek tek pencerelerde değil, paylaştıkları tipte (Type) tutuluyor.',
        'Pencereyi seçince tip bilgisi görünür; tipi düzenleme seçeneğini ara.',
        '1) Bir pencereyi seç. 2) Edit Type’ı aç. 3) Genişliği 1200 mm yap. 4) İki pencerenin de değiştiğini gör. 5) Kontrol Et.'
      ),
      primaryFields: ['typeParams'],
    },
    levels: [L0],
    elements: [
      ...box(),
      window1('win1', 'w1', 1000, { width: 900, typeId: 'wn900' }),
      window1('win2', 'w3', 2000, { width: 900, typeId: 'wn900' }),
    ],
    types: [WN900],
    editable: ['typeParams'],
    criteria: [
      { id: 'c_1', type: 'property', elementId: 'win1', field: 'typeId', expected: 'wn900', tolerance: 0, message: 'win1 aynı tipte kalmalı.' },
      { id: 'c_w1', type: 'exists', category: 'window', where: { id: 'win1', width: 1200 }, message: 'win1 genişliği 1200 mm olmalı.' },
      { id: 'c_w2', type: 'exists', category: 'window', where: { id: 'win2', width: 1200 }, message: 'win2 genişliği 1200 mm olmalı.' },
    ],
  },
  m25: {
    lesson: {
      objective: 'Bir duvar farklı bir tipte (Generic - 100mm). Dört duvarı da Generic - 200mm tipine getir.',
      hintLevels: hints(
        'Duvarların kalınlıkları eşit değil; nedenini nesnelerin tipinde ara.',
        'Hangi duvarın tipi diğerlerinden farklı?',
        'Tip, Properties panelindeki Tip (Type) seçicisinden değişir.',
        '1) Kalın/ince farklı duvarı seç. 2) Tip seçiciden Generic - 200mm’i seç. 3) Kontrol Et.'
      ),
      primaryFields: ['typeId'],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [6000, 0], { typeId: 'wt200' }),
      wall('w2', [6000, 0], [6000, 4000], { typeId: 'wt200' }),
      wall('w3', [6000, 4000], [0, 4000], { typeId: 'wt100', thickness: 100 }),
      wall('w4', [0, 4000], [0, 0], { typeId: 'wt200' }),
    ],
    types: [WT200, WT100],
    editable: ['typeId'],
    seeds: ['w1', 'w2', 'w3', 'w4'],
    criteria: [
      { id: 'c_t', type: 'typeUsage', category: 'wall', typeId: 'wt200', message: 'Tüm duvarlar Generic - 200mm olmalı.' },
      { id: 'c_th', type: 'allEqual', category: 'wall', field: 'thickness', message: 'Tüm duvar kalınlıkları eşit olmalı.' },
    ],
  },

  // ---- Bölüm 5: View, Section, Elevation, Dokümantasyon ------------------
  m30: {
    lesson: {
      objective:
        'Plan görünümünde pencere sembolü soluk (kesilmemiş) çiziliyor. Kesme düzlemini pencereyi tam ortadan kesecek şekilde 1500 mm yap.',
      hintLevels: hints(
        'Planın görünümüne bak: pencere neden düz bir çizgi gibi değil de soluk?',
        'Bu davranışı pencere değil, plan görünümünün kendisi belirliyor.',
        'Plan görünümünün View Range / kesme düzlemi yüksekliği pencerenin sill ve üst kotu arasında kalmalı.',
        '1) Görünümler → Plan - Zemin Kat’ı aç. 2) Görünümü seç. 3) Kesme düzlemini 1500 mm yap. 4) Kontrol Et.'
      ),
      primaryFields: ['cutHeight'],
    },
    levels: [L0],
    elements: [
      ...box(),
      window1('win1', 'w1', 2400),
      { id: 'v1', type: 'view', name: 'Plan - Zemin Kat', kind: 'plan', levelId: 'l0', scale: 100, cutHeight: 2400 },
    ],
    editable: ['cutHeight'],
    seeds: ['v1'],
    criteria: [
      { id: 'c_cut', type: 'property', elementId: 'v1', field: 'cutHeight', expected: 1500, tolerance: 0, message: 'Kesme düzlemi 1500 mm olmalı.' },
    ],
  },
  m31: {
    lesson: {
      objective: 'Binanın içinden geçen bir kesit çizgisi çiz. Kesit, duvarları ve döşemeyi doğru kotlarla göstermeli.',
      hintLevels: hints(
        'Kesit, binayı bir çizgi boyunca “kesip” yandan gösterir.',
        'Kesit çizgisi plan üzerinde iki noktayla tanımlanır ve binanın içinden geçmelidir.',
        'Kesit aracı Görünüm sekmesindedir; çizgi X veya Z eksenine paralel olur.',
        '1) Kesit aracını seç. 2) Planda binayı baştan başa geçen iki nokta seç (ör. 0,2000 → 6000,2000). 3) Görünümler’den kesiti aç. 4) Kontrol Et.'
      ),
      primaryFields: ['cutLine'] as never,
    },
    levels: [L0, l1(3000)],
    elements: [...box(), window1('win1', 'w1', 2400)],
    editable: ['flip'],
    creatable: ['view'],
    criteria: [
      { id: 'c_s', type: 'exists', category: 'view', where: { kind: 'section', cutsModel: 1 }, message: 'Binayı kesen bir kesit gerekli.' },
    ],
  },
  m32: {
    lesson: {
      objective: 'Güney cephesinin görünümünü (Elevation) ekle ve pencereleri yüzeyde doğru kotta gör.',
      hintLevels: hints(
        'Cephe görünümü binaya dışarıdan bakar; hangi yönden baktığını seçersin.',
        'Pencerelerin bulunduğu duvar hangi cephede?',
        'Cephe aracında dört yön işareti (K, G, D, B) vardır.',
        '1) Cephe aracını seç. 2) G (Güney) yönünü seç. 3) Görünümler’den cepheyi aç. 4) Kontrol Et.'
      ),
      primaryFields: ['direction'] as never,
    },
    levels: [L0],
    elements: [...box(), window1('win1', 'w1', 800), window1('win2', 'w1', 3600)],
    editable: [],
    creatable: ['view'],
    criteria: [
      { id: 'c_e', type: 'exists', category: 'view', where: { kind: 'elevation', direction: 'S' }, message: 'Güney cephesi görünümü gerekli.' },
    ],
  },
  m33: {
    lesson: {
      objective: 'Plan görünümünün kadrajını (Crop Region) yalnızca doğu odasına, yani x = 3000–6000 mm, z = 0–4000 mm aralığına sınırla.',
      hintLevels: hints(
        'Görünümde istemediğin kısımlar var; kadraj dışını gizler.',
        'Kadraj, plan görünümünün bir özelliğidir ve dört kenarı vardır.',
        'Crop Region açıldığında köşe tutamaklarını sürükleyebilir ya da değerleri yazabilirsin.',
        '1) Planı açıp görünümü seç. 2) Kadrajı aç. 3) Sınırları 3000–6000 × 0–4000 mm yap. 4) Kontrol Et.'
      ),
      primaryFields: ['cropMinX', 'cropMaxX', 'cropMinZ', 'cropMaxZ'] as never,
    },
    levels: [L0],
    elements: [
      ...box(),
      wall('w5', [3000, 0], [3000, 4000]),
      { id: 'v1', type: 'view', name: 'Plan - Zemin Kat', kind: 'plan', levelId: 'l0', scale: 100, cutHeight: 1200 },
    ],
    editable: ['cropMinX', 'cropMaxX', 'cropMinZ', 'cropMaxZ'],
    seeds: ['v1'],
    criteria: [
      { id: 'c_x0', type: 'property', elementId: 'v1', field: 'cropMinX', expected: 3000, tolerance: 10, message: 'Kadraj sol sınırı 3000 mm olmalı.' },
      { id: 'c_x1', type: 'property', elementId: 'v1', field: 'cropMaxX', expected: 6000, tolerance: 10, message: 'Kadraj sağ sınırı 6000 mm olmalı.' },
      { id: 'c_z0', type: 'property', elementId: 'v1', field: 'cropMinZ', expected: 0, tolerance: 10, message: 'Kadraj üst sınırı 0 mm olmalı.' },
      { id: 'c_z1', type: 'property', elementId: 'v1', field: 'cropMaxZ', expected: 4000, tolerance: 10, message: 'Kadraj alt sınırı 4000 mm olmalı.' },
    ],
  },
  m34: {
    lesson: {
      objective: 'Güney ve kuzey duvarı arasına bir ölçü (Dimension) koy; değer duvar aralığından otomatik gelsin.',
      hintLevels: hints(
        'Ölçü elle yazılan bir sayı değil, iki referans arasındaki gerçek mesafedir.',
        'Birbirine paralel iki duvarı referans almalısın.',
        'Annotate sekmesindeki hizalı ölçü iki duvara tıklanarak yerleştirilir.',
        '1) Ölçü aracını seç. 2) Güney duvarına dokun. 3) Kuzey duvarına dokun. 4) Ölçünün 4000 mm olduğunu doğrula. 5) Kontrol Et.'
      ),
      primaryFields: ['wallA', 'wallB'] as never,
    },
    levels: [L0],
    elements: box(),
    editable: ['wallA', 'wallB'],
    creatable: ['dimension'],
    criteria: [
      { id: 'c_d', type: 'exists', category: 'dimension', where: { value: 4000 }, message: '4000 mm’lik bir ölçü gerekli.' },
    ],
  },
  m35: {
    lesson: {
      objective: 'Kapı, pencere ve odayı etiketle. Etiketler verisini nesnenin kendisinden okur.',
      hintLevels: hints(
        'Pafta okunurken hangi elemanın hangi poz numarasına sahip olduğunu etiket söyler.',
        'Kapı, pencere ve oda etiketlenebilir.',
        'Etiket aracına dokunup eleman üzerine tıkla.',
        '1) Etiket aracını seç. 2) Kapıya, pencereye ve odaya sırayla dokun. 3) Uyarılar’da etiket sorununun bittiğini gör. 4) Kontrol Et.'
      ),
      primaryFields: ['targetId'] as never,
    },
    levels: [L0],
    elements: [
      ...box(),
      door1('d1', 'w1', 600),
      window1('win1', 'w1', 3200),
      { id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [3000, 2000] },
    ],
    editable: [],
    creatable: ['tag'],
    criteria: [
      { id: 'c_tags', type: 'modelClean', codes: ['TAG_MISSING'], message: 'Tüm kapı, pencere ve odalar etiketli olmalı.' },
    ],
  },
  m36: {
    lesson: {
      objective: 'Yeni bir pafta oluştur: numarası A-101, adı "Zemin Kat Planı" olsun.',
      hintLevels: hints(
        'Pafta, görünümlerin yerleştirildiği çizim kâğıdıdır.',
        'Her paftanın bir numarası ve adı vardır; antet bunlardan beslenir.',
        'Proje Tarayıcısı’ndan pafta ekleyebilir, düzenleyicide ad ve numarayı değiştirebilirsin.',
        '1) Görünümler → Pafta Ekle. 2) Paftayı aç. 3) Adı “Zemin Kat Planı” yap. 4) Numarası A-101 olsun. 5) Kontrol Et.'
      ),
      primaryFields: ['number', 'name'],
    },
    levels: [L0],
    elements: box(),
    editable: ['number', 'name'],
    creatable: ['sheet'],
    criteria: [
      { id: 'c_sh', type: 'exists', category: 'sheet', where: { number: 'A-101', name: 'Zemin Kat Planı' }, message: 'A-101 numaralı "Zemin Kat Planı" paftası gerekli.' },
    ],
  },
  m37: {
    lesson: {
      objective: 'A-101 paftasına hem plan hem kesit görünümünü yerleştir; görünümler antetle çakışmasın.',
      hintLevels: hints(
        'Paftada iki farklı görünüm türü olmalı.',
        'Hazır bir plan ve bir kesit görünümü var; ikisi de paftaya girmeli.',
        'Pafta düzenleyicide her görünümün yanında bir yerleştir düğmesi var.',
        '1) Pafta düzenleyiciyi aç. 2) Plan ve kesiti yerleştir. 3) Gerekirse sürükleyerek konumunu ayarla. 4) Kontrol Et.'
      ),
      primaryFields: ['placements'] as never,
    },
    levels: [L0, l1(3000)],
    elements: [
      ...box(),
      window1('win1', 'w1', 2400),
      { id: 'v1', type: 'view', name: 'Plan - Zemin Kat', kind: 'plan', levelId: 'l0', scale: 100, cutHeight: 1200 },
      { id: 'v2', type: 'view', name: 'Kesit 1', kind: 'section', cutLine: [[0, 2000], [6000, 2000]], lookDir: 'z+', scale: 50 },
      { id: 'sh1', type: 'sheet', name: 'Zemin Kat Planı', number: 'A-101', size: 'A3', placements: [] },
    ],
    editable: ['placements'],
    seeds: ['sh1'],
    criteria: [
      { id: 'c_sh', type: 'exists', category: 'sheet', where: { number: 'A-101', hasPlan: 1, hasSection: 1 }, message: 'Pafta hem plan hem kesit içermeli.' },
    ],
  },

  // ---- Bölüm 6: Model QA --------------------------------------------------
  m38: {
    lesson: {
      objective: 'Salon (r1) odası "sınır kapalı değil" uyarısı veriyor. Boşluğu bul ve duvarla kapat.',
      hintLevels: hints(
        'Planda kırmızı işaretli yere bak; oda sınırı orada sızıyor.',
        'Kuzey tarafındaki duvarlardan biri köşeye kadar uzanmıyor.',
        'Duvarın bitiş (End) koordinatı köşeyle eşleşmeli.',
        '1) Planda kırmızı boşluğu bul. 2) w3 duvarını seç. 3) Bitiş noktasını (0, 4000) yap. 4) Kontrol Et.'
      ),
      primaryFields: ['end'],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [6000, 0]),
      wall('w2', [6000, 0], [6000, 4000]),
      wall('w3', [6000, 4000], [1500, 4000]),
      wall('w4', [0, 4000], [0, 0]),
      { id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [3000, 2000] },
    ],
    editable: ['end'],
    seeds: ['w3'],
    criteria: [
      { id: 'c_cl', type: 'roomClosed', roomId: 'r1', message: 'r1 odasının sınırı kapalı olmalı.' },
      { id: 'c_n', type: 'count', elementType: 'wall', expected: 4, message: 'Duvar sayısı 4 kalmalı.' },
      { id: 'c_clean', type: 'modelClean', codes: ['ROOM_OPEN_BOUNDARY'], message: 'Oda sınırı uyarısı kalmamalı.' },
    ],
  },
  m39: {
    lesson: {
      objective: 'Model kontrolü, bir duvarın diğerlerinden farklı bir kata bağlandığını söylüyor. Sorunu bul ve düzelt.',
      hintLevels: hints(
        'Duvarların hepsi aynı yüksekliğe oturmuyor; 3B sahnede kayan bir duvar var.',
        'Dört duvardan yalnızca biri farklı bir kata bağlı.',
        'Duvarın alt kat bağlantısı (Base Constraint) diğerlerinden farklı.',
        '1) Kayan duvarı bul. 2) Base Constraint değerini diğerleriyle aynı yap. 3) Kontrol Et.'
      ),
      primaryFields: ['baseLevelId'],
    },
    levels: [L0, l1(3000)],
    elements: [
      wall('w1', [0, 0], [6000, 0]),
      wall('w2', [6000, 0], [6000, 4000]),
      wall('w3', [6000, 4000], [0, 4000]),
      wall('w4', [0, 4000], [0, 0], { baseLevelId: 'l1' }),
    ],
    editable: ['baseLevelId'],
    seeds: ['w4'],
    criteria: [
      { id: 'c_clean', type: 'modelClean', codes: ['WALL_WRONG_LEVEL'], message: 'Duvar kat bağlantısı tutarlı olmalı.' },
      { id: 'c_w4', type: 'property', elementId: 'w4', field: 'baseLevelId', expected: 'l0', tolerance: 0, message: 'w4 Zemin Kat’a bağlı olmalı.' },
    ],
  },
  m40: {
    lesson: {
      objective: 'Üç kapıdan biri diğerlerinden farklı tipte (800 mm). Hepsini aynı standart tipe (900 × 2100) getir.',
      hintLevels: hints(
        'Kapıların biri diğerlerinden dar görünüyor.',
        'Üç kapıdan yalnızca biri farklı tipte.',
        'Kapı genişliği tipten gelir; örnek (Instance) üzerinden değil, tip atayarak çöz.',
        '1) Dar kapıyı seç. 2) Tip seçiciden 900 x 2100mm tipini ata. 3) Kontrol Et.'
      ),
      primaryFields: ['typeId'],
    },
    levels: [L0],
    elements: [
      ...box(),
      door1('d1', 'w1', 500, { typeId: 'dt900' }),
      door1('d2', 'w1', 2500, { typeId: 'dt900' }),
      door1('d3', 'w1', 4500, { typeId: 'dt800', width: 800 }),
    ],
    types: [DT900, DT800],
    editable: ['typeId'],
    seeds: ['d1', 'd2', 'd3'],
    criteria: [
      { id: 'c_clean', type: 'modelClean', codes: ['TYPE_INCONSISTENT'], message: 'Kapı tipleri tutarlı olmalı.' },
      { id: 'c_t', type: 'typeUsage', category: 'door', typeId: 'dt900', message: 'Tüm kapılar 900 x 2100mm olmalı.' },
    ],
  },
  m41: {
    lesson: {
      objective: 'Güney cephesinde dört pencereden birinin parapeti diğerlerinden farklı. Cephe hizasını düzelt.',
      hintLevels: hints(
        'Cepheye yandan bakınca pencere alt kenarları aynı hizada olmalı.',
        'Dört pencereden biri farklı bir parapet yüksekliğinde.',
        'Sill Height değerlerini karşılaştır.',
        '1) Hizadan çıkan pencereyi bul. 2) Sill Height değerini diğerleriyle eşitle. 3) Kontrol Et.'
      ),
      primaryFields: ['sill'],
    },
    levels: [L0],
    elements: [
      ...box(),
      window1('win1', 'w1', 500),
      window1('win2', 'w1', 2000),
      window1('win3', 'w1', 3500, { sill: 600 }),
      window1('win4', 'w1', 4800, { width: 900 }),
    ],
    editable: ['sill'],
    seeds: ['win1', 'win2', 'win3', 'win4'],
    criteria: [
      { id: 'c_clean', type: 'modelClean', codes: ['SILL_INCONSISTENT'], message: 'Parapet yükseklikleri tutarlı olmalı.' },
      { id: 'c_eq', type: 'allEqual', category: 'window', field: 'sill', message: 'Tüm pencere parapetleri eşit olmalı.' },
    ],
  },
  m42: {
    lesson: {
      objective: 'İki oda var; birinin numarası boş. Pafta ve metraj için numarasını (102) gir.',
      hintLevels: hints(
        'Odalardan birinde veri eksik; planda etiketine bak.',
        'İki odadan yalnızca biri eksik.',
        'Kimlik verisi (Identity Data) alanlarından Number boş.',
        '1) Numarasız odayı seç. 2) Numarasını 102 yap. 3) Kontrol Et.'
      ),
      primaryFields: ['number'],
    },
    levels: [L0],
    elements: [
      ...box(),
      wall('w5', [3000, 0], [3000, 4000]),
      { id: 'r1', type: 'room', name: 'Salon', number: '101', levelId: 'l0', seedPoint: [1500, 2000] },
      { id: 'r2', type: 'room', name: 'Yatak Odası', number: '', levelId: 'l0', seedPoint: [4500, 2000] },
    ],
    editable: ['number'],
    seeds: ['r2'],
    criteria: [
      { id: 'c_clean', type: 'modelClean', codes: ['ROOM_DATA_MISSING'], message: 'Oda verisi eksiksiz olmalı.' },
      { id: 'c_n', type: 'exists', category: 'room', where: { number: '102' }, message: '102 numaralı oda gerekli.' },
    ],
  },
  m43: {
    lesson: {
      objective: 'Baş Mimar denetimi: modelde birden fazla gizli sorun var. Hepsini bul ve sıfır uyarıya ulaş.',
      hintLevels: hints(
        'Üç ayrı kategoride tutarsızlık var; Uyarılar özetine bak.',
        'Duvar, pencere ve oda nesnelerini gözden geçir.',
        'Üst kot, parapet ve numara alanlarını komşularıyla karşılaştır.',
        '1) Alçak duvarı 3000 mm yap. 2) Farklı parapetli pencereyi eşitle. 3) Boş oda numarasını doldur. 4) Kontrol Et.'
      ),
      primaryFields: ['height', 'sill', 'number'],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [6000, 0]),
      wall('w2', [6000, 0], [6000, 4000]),
      wall('w3', [6000, 4000], [0, 4000], { height: 2600 }),
      wall('w4', [0, 4000], [0, 0]),
      window1('win1', 'w1', 800),
      window1('win2', 'w1', 3000),
      window1('win3', 'w1', 4500, { sill: 700, width: 900 }),
      { id: 'r1', type: 'room', name: 'Salon', number: '', levelId: 'l0', seedPoint: [3000, 2000] },
    ],
    editable: ['height', 'sill', 'number'],
    seeds: ['w3', 'win3', 'r1'],
    minutes: 10,
    criteria: [
      { id: 'c_clean', type: 'modelClean', message: 'Modelde hiç uyarı kalmamalı.' },
    ],
  },
  // ---- Bonus Bölüm 8: Çizelgeler ----------------------------------------
  m51: {
    lesson: {
      objective:
        'Kapı çizelgesini aç. Poz numaralarını d1 → D-01, d2 → D-02, d3 → D-03, d4 → D-04 olacak şekilde düzelt.',
      hintLevels: hints(
        'Üst çubuktaki Çizelgeler düğmesi model verisini tablo olarak gösterir.',
        'Kapı çizelgesinde Poz sütunundaki tekrar eden ve düzensiz hücrelere bak.',
        'Bir hücreyi değiştirmek modeldeki kapının Mark değerini değiştirir.',
        '1) Çizelgeler → Kapı Çizelgesi. 2) Her satırın Poz hücresini düzelt (Enter ile onayla). 3) Kapat ve Kontrol Et.'
      ),
      primaryFields: ['mark'],
    },
    levels: [L0],
    elements: [
      ...box(),
      door1('d1', 'w1', 1000, { mark: 'D-01' }),
      door1('d2', 'w1', 3000, { mark: 'D-01' }),
      door1('d3', 'w3', 1500, { mark: 'D-03' }),
      door1('d4', 'w3', 4000, { mark: 'D-3' }),
    ],
    editable: ['mark'],
    seeds: ['d1', 'd2', 'd3', 'd4'],
    minutes: 6,
    criteria: [
      { id: 'c1', type: 'property', elementId: 'd1', field: 'mark', expected: 'D-01', tolerance: 0, message: 'd1 kapısının pozu D-01 olmalı.' },
      { id: 'c2', type: 'property', elementId: 'd2', field: 'mark', expected: 'D-02', tolerance: 0, message: 'd2 kapısının pozu D-02 olmalı.' },
      { id: 'c3', type: 'property', elementId: 'd3', field: 'mark', expected: 'D-03', tolerance: 0, message: 'd3 kapısının pozu D-03 olmalı.' },
      { id: 'c4', type: 'property', elementId: 'd4', field: 'mark', expected: 'D-04', tolerance: 0, message: 'd4 kapısının pozu D-04 olmalı.' },
    ],
  },
  m52: {
    lesson: {
      objective:
        'Koridora açılan d1, d2 ve d3 kapılarının yangın sınıfını (Fire Rating) çizelgeden EI30 yap. Oda içi d4 kapısına dokunma.',
      hintLevels: hints(
        'Kapı çizelgesinde Yangın sütununu üstten alta tara.',
        'Üç kapının yangın sınıfı eksik; dördüncüsü oda içi kapı.',
        'Hücreye EI30 yaz ve Enter ile onayla.',
        '1) Çizelgeler → Kapı Çizelgesi. 2) d1, d2, d3 satırlarında Yangın hücresine EI30 yaz. 3) Kapat ve Kontrol Et.'
      ),
      primaryFields: ['fireRating'],
    },
    levels: [L0],
    elements: [
      ...box(),
      door1('d1', 'w1', 1000, { mark: 'D-01' }),
      door1('d2', 'w1', 3000, { mark: 'D-02' }),
      door1('d3', 'w3', 1500, { mark: 'D-03' }),
      door1('d4', 'w3', 4000, { mark: 'D-04' }),
    ],
    editable: ['fireRating'],
    seeds: ['d1', 'd2', 'd3'],
    minutes: 6,
    criteria: [
      { id: 'c1', type: 'property', elementId: 'd1', field: 'fireRating', expected: 'EI30', tolerance: 0, message: 'd1 kapısı EI30 olmalı.' },
      { id: 'c2', type: 'property', elementId: 'd2', field: 'fireRating', expected: 'EI30', tolerance: 0, message: 'd2 kapısı EI30 olmalı.' },
      { id: 'c3', type: 'property', elementId: 'd3', field: 'fireRating', expected: 'EI30', tolerance: 0, message: 'd3 kapısı EI30 olmalı.' },
    ],
  },
  m53: {
    lesson: {
      objective:
        'Oda çizelgesinde iki odanın da numarasını ve adını doldur: r1 → 101 Salon, r2 → 102 Yatak Odası. Modelde uyarı kalmasın.',
      hintLevels: hints(
        'Oda çizelgesinde boş kalan hücreler eksik veriyi gösterir.',
        'İki odanın hem numarası hem adı eksik.',
        'Numara ve Ad sütunlarındaki hücreleri doldurup Enter ile onayla.',
        '1) Çizelgeler → Oda Çizelgesi. 2) r1: 101 / Salon. 3) r2: 102 / Yatak Odası. 4) Kapat ve Kontrol Et.'
      ),
      primaryFields: ['number', 'name'],
    },
    levels: [L0],
    elements: [
      ...box(),
      wall('w5', [3000, 0], [3000, 4000]),
      { id: 'r1', type: 'room', name: 'Oda', number: '', levelId: 'l0', seedPoint: [1500, 2000] },
      { id: 'r2', type: 'room', name: 'Oda', number: '', levelId: 'l0', seedPoint: [4500, 2000] },
    ],
    editable: ['number', 'name'],
    seeds: ['r1', 'r2'],
    minutes: 6,
    criteria: [
      { id: 'c1', type: 'property', elementId: 'r1', field: 'number', expected: '101', tolerance: 0, message: 'r1 oda numarası 101 olmalı.' },
      { id: 'c2', type: 'property', elementId: 'r2', field: 'number', expected: '102', tolerance: 0, message: 'r2 oda numarası 102 olmalı.' },
      { id: 'c3', type: 'property', elementId: 'r1', field: 'name', expected: 'Salon', tolerance: 0, message: 'r1 odasının adı Salon olmalı.' },
      { id: 'c4', type: 'property', elementId: 'r2', field: 'name', expected: 'Yatak Odası', tolerance: 0, message: 'r2 odasının adı Yatak Odası olmalı.' },
      { id: 'c_clean', type: 'modelClean', message: 'Odaların ad ve numarası boş kalmamalı.' },
    ],
  },
  // ---- Bonus Bölüm 9: Modify araçları ------------------------------------
  m54: {
    lesson: {
      objective:
        'Güney duvarını (w1) ve kapısını kuzeye doğru 4000 mm kopyala. Sonuçta iki paralel duvar ve iki kapı olsun.',
      hintLevels: hints(
        'Modify paneli seçili duvarı çoğaltabilir.',
        'Kopyalanacak olan w1 duvarı; kapısı da onunla gelir.',
        'Kopya, X ve Z yönündeki ötelemelerle tarif edilir; kuzey, Z yönüdür.',
        '1) w1’i seç. 2) Değiştir → Kopyala. 3) dx = 0, dz = 4000. 4) Kopyala ve Kontrol Et.'
      ),
      primaryFields: [],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [6000, 0]),
      door1('d1', 'w1', 2000, { mark: 'D-01' }),
    ],
    editable: [],
    creatable: ['wall', 'door'],
    seeds: [],
    minutes: 5,
    criteria: [
      { id: 'c_w', type: 'exists', category: 'wall', where: { axisDir: 'h', axisPos: 4000, length: 6000 }, message: 'Kuzeyde (z = 4000 mm) 6000 mm uzunlukta paralel bir duvar olmalı.' },
      { id: 'c_d', type: 'count', elementType: 'door', expected: 2, message: 'Modelde iki kapı olmalı.' },
      { id: 'c_h', type: 'hosted', category: 'door', hostCategory: 'wall', min: 2, message: 'İki kapı da bir duvara bağlı olmalı.' },
    ],
  },
  m55: {
    lesson: {
      objective:
        'Üç duvarlı yarım planı x = 3000 mm düşey ekseninde aynala. Sonuçta 6000 × 4000 mm kapalı bir kabuk oluşsun.',
      hintLevels: hints(
        'Plan soldan sağa simetrik olmalı; yalnızca sol yarısı çizilmiş.',
        'Üç duvarın üçü de aynalanmalı.',
        'Ayna ekseni, yarım planın sağ ucundaki düşey çizgidir.',
        '1) w1, w2, w3’ü seç (Shift ile ekle). 2) Değiştir → Aynala, Eksen: x, Konum: 3000. 3) Aynala ve Kontrol Et.'
      ),
      primaryFields: [],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [3000, 0]),
      wall('w2', [0, 4000], [3000, 4000]),
      wall('w3', [0, 0], [0, 4000]),
    ],
    editable: [],
    creatable: ['wall'],
    seeds: [],
    minutes: 6,
    criteria: [
      { id: 'c_walls', type: 'metric', metric: 'wallCount', min: 6, max: 6, message: 'Toplam 6 duvar olmalı (3 asıl + 3 ayna).' },
      { id: 'c_edge', type: 'exists', category: 'wall', where: { axisDir: 'v', axisPos: 6000 }, message: 'x = 6000 mm üzerinde düşey bir duvar olmalı.' },
      { id: 'c_area', type: 'metric', metric: 'enclosedAreaM2', min: 24, max: 24, message: 'Duvarlar 24 m² kapalı alan oluşturmalı.' },
    ],
  },
  m56: {
    lesson: {
      objective:
        'Güney duvarını (w1) 3000 mm kuzeye öteleyerek paralel bir bölme duvarı oluştur.',
      hintLevels: hints(
        'Bölme duvarı güney duvarına paralel ve aynı uzunlukta olmalı.',
        'Çoğaltılacak duvar w1; duvar yönünün solu pozitiftir.',
        'Öteleme mesafesi, iki duvar arasındaki dik uzaklıktır.',
        '1) w1’i seç. 2) Değiştir → Öteleme. 3) Mesafe: 3000. 4) Uygula ve Kontrol Et.'
      ),
      primaryFields: [],
    },
    levels: [L0],
    elements: [wall('w1', [0, 0], [6000, 0])],
    editable: [],
    creatable: ['wall'],
    seeds: [],
    minutes: 5,
    criteria: [
      { id: 'c_w', type: 'exists', category: 'wall', where: { axisDir: 'h', axisPos: 3000, length: 6000 }, message: 'z = 3000 mm üzerinde 6000 mm’lik paralel bir duvar olmalı.' },
      { id: 'c_n', type: 'metric', metric: 'wallCount', min: 2, max: 2, message: 'Modelde yalnızca iki duvar olmalı.' },
    ],
  },
  m57: {
    lesson: {
      objective: 'w2 duvarı w1 duvarından kaymış. w2’yi w1’in çizgisine hizala.',
      hintLevels: hints(
        'İki duvar aynı doğrultuda ama farklı hizada duruyor.',
        'Kayan duvar w2; referans w1.',
        'Hizalama, taşınan duvarı referansın çizgisine oturtur.',
        '1) w2’yi seç. 2) Değiştir → Hizala. 3) Referans: w1. 4) Uygula ve Kontrol Et.'
      ),
      primaryFields: [],
    },
    levels: [L0],
    elements: [wall('w1', [0, 0], [3000, 0]), wall('w2', [3000, -300], [6000, -300])],
    editable: ['start', 'end'],
    seeds: ['w2'],
    minutes: 4,
    criteria: [
      { id: 'c_al', type: 'compare', elementId: 'w2', field: 'axisPos', otherElementId: 'w1', otherField: 'axisPos', tolerance: 0, message: 'w2 ve w1 aynı çizgide (aynı z) olmalı.' },
    ],
  },
  m58: {
    lesson: {
      objective:
        'Yarım planı ve kapısını x = 3000 mm ekseninde aynala. 24 m² kapalı bir hacim ve iki kapı elde et.',
      hintLevels: hints(
        'Plan simetrik; yalnızca bir yarısı ve tek kapı var.',
        'Duvarların hepsini aynala; kapı duvarıyla birlikte gelir.',
        'Ayna ekseni, yarım planın sağ ucundaki düşey çizgidir.',
        '1) Tüm duvarları seç. 2) Değiştir → Aynala, Eksen: x, Konum: 3000. 3) Kontrol Et.'
      ),
      primaryFields: [],
    },
    levels: [L0],
    elements: [
      wall('w1', [0, 0], [3000, 0]),
      wall('w2', [0, 4000], [3000, 4000]),
      wall('w3', [0, 0], [0, 4000]),
      door1('d1', 'w1', 1000, { mark: 'D-01' }),
    ],
    editable: [],
    creatable: ['wall', 'door'],
    seeds: [],
    minutes: 6,
    criteria: [
      { id: 'c_area', type: 'metric', metric: 'enclosedAreaM2', min: 24, max: 24, message: 'Duvarlar 24 m² kapalı alan oluşturmalı.' },
      { id: 'c_doors', type: 'metric', metric: 'doorCount', min: 2, max: 2, message: 'Modelde iki kapı olmalı.' },
      { id: 'c_h', type: 'hosted', category: 'door', hostCategory: 'wall', min: 2, message: 'İki kapı da duvara bağlı olmalı.' },
    ],
  },
};

export function buildBimMissionTask(
  id: string,
  meta: RevitLessonMeta,
  prerequisite: string
): MissionTask {
  const spec = BIM_MISSION_SPECS[id];
  const model: BimModel = {
    levels: spec.levels,
    elements: spec.elements,
    ...(spec.types ? { types: spec.types } : {}),
  };
  return {
    schemaVersion: '1.0',
    contentVersion: '1.0.0',
    id,
    title: meta.title,
    objective: meta.objective,
    prerequisites: [prerequisite],
    estimatedMinutes: spec.minutes ?? 8,
    initialModel: model,
    permissions: {
      editableFields: spec.editable,
      creatableTypes: spec.creatable ?? [],
      deletableCreated: (spec.creatable ?? []).length > 0,
      editableSeedIds: spec.seeds ?? [],
    },
    hints: [
      { id: 'h1', text: meta.hintLevels[0] },
      { id: 'h2', text: meta.hintLevels[1] },
      { id: 'h3', text: meta.hintLevels[2] },
    ],
    recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
    criteria: spec.criteria,
  };
}
