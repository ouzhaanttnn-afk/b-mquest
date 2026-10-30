import type { EditableField, MissionTask } from '../domain/types';
import { BIM_MISSION_SPECS, buildBimMissionTask } from './bimMissions';
import { FINAL_STAGES, buildFinalMissionTask, finalLessonOverrides } from './finalProject';

export interface RevitLessonMeta {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  stepNumber: number;
  title: string;
  learningConcept: string;
  learningText: string;
  revitPath: string;
  whyItMatters: string;
  objective: string;
  commonErrors: string[];
  hintLevels: [string, string, string, string];
  completionExplanation: {
    whatYouDid: string;
    whyRight: string;
    revitCounterpart: string;
    nextConcept: string;
  };
  primaryFields: EditableField[];
  secondaryFields: EditableField[];
  difficultyPhase: 'beginner' | 'intermediate' | 'advanced' | 'final';
}

export const REVIT_LESSONS_BY_ID: Record<string, RevitLessonMeta> = {
  // =========================================================================
  // BÖLÜM 1 — REVIT & BIM TEMELLERİ (Görev 01–06) · %70 Öğretim / %30 Problem Çözme
  // =========================================================================
  m01: {
    id: 'm01',
    chapter: 1,
    stepNumber: 1,
    title: 'İlk Model Kontrolü',
    learningConcept: 'Wall Height / Unconnected Height',
    learningText:
      'Revit’te üst kata bağlanmamış bir duvarın yüksekliği doğrudan parametreyle yönetilir. Çizgiyi uzatmak yerine duvarın yüksekliğini değiştirdiğinde 3B model ve metraj anında güncellenir.',
    revitPath: 'Select Wall → Properties → Constraints → Unconnected Height',
    whyItMatters:
      'CAD ortamında duvar yüksekliği sadece kesit çiziminde görünürken, Revit’te duvarın kendi verisidir. Bir duvar farklı yükseklikte kalırsa çatı ve döşeme birleşimleri bozulur.',
    objective:
      'Odada hedef yüksekliğe uymayan duvarları bul. Tüm duvarların yüksekliğini 3000 mm yap. Diğer özellikleri değiştirme.',
    commonErrors: [
      'Bazı duvarları 2800 mm bırakmak',
      'Yükseklik yerine kalınlık değerini değiştirmek',
    ],
    hintLevels: [
      'İpucu 1 (Alan): 3B sahneye veya 2B plandaki duvar etiketlerine (Y: ...) dikkatlice bak.',
      'İpucu 2 (Nesne): Odayı oluşturan 4 duvar nesnesini (w1, w2, w3, w4) tek tek kontrol et.',
      'İpucu 3 (Parametre): Properties panelindeki Height (Unconnected Height) değerini incele.',
      'Adım Adım Rehber: 1) Sahnede 3000 mm olmayan duvarı seç. 2) Properties panelini aç. 3) Height (Yükseklik) değerini 3000 yapıp Enter’a bas. 4) Tüm duvarlar 3000 mm olunca Kontrol Et’e bas.',
    ],
    completionExplanation: {
      whatYouDid: 'Oda duvarlarının yükseklik parametresini 3000 mm olarak eşitledin.',
      whyRight: 'Böylece tüm duvarların üst kotları aynı hizaya geldi ve hacim verisi doğrulandı.',
      revitCounterpart: 'Wall → Properties → Constraints → Unconnected Height',
      nextConcept: 'Wall Tool + Closed Boundary (Kapalı Oda)',
    },
    primaryFields: ['height'],
    secondaryFields: ['thickness', 'baseLevelId'],
    difficultyPhase: 'beginner',
  },
  m02: {
    id: 'm02',
    chapter: 1,
    stepNumber: 2,
    title: 'Kapalı Oda',
    learningConcept: 'Wall Tool + Closed Boundary',
    learningText:
      'Revit’te Room ve Floor gibi araçlar kapalı duvar sınırlarını (Closed Loop) kullanır. Duvar uçları arasında küçük bir boşluk bile kalırsa mekan algılanmaz.',
    revitPath: 'Architecture → Build → Wall (Wall: Architectural) → Chain',
    whyItMatters:
      'Mimari modelde mahallerin otomatik alan (m²) ve hacim (m³) hesabı yapabilmesi için duvar aks uçlarının birbirine tam kenetlenmesi gerekir.',
    objective:
      'Zemin katta 6000 × 4000 mm ölçülerinde, 3000 mm yüksekliğinde ve 200 mm kalınlığında kapalı bir oda oluştur.',
    commonErrors: [
      'Duvar uçlarını açık bırakmak',
      '4 duvar yerine eksik duvar çizmek',
    ],
    hintLevels: [
      'İpucu 1 (Alan): 2B planda mavi kesikli çizgiyle gösterilen 6000 × 4000 mm hedef ayak izine bak.',
      'İpucu 2 (Nesne): Üst araç çubuğundan "Duvar Oluştur" (Wall) aracını etkinleştir.',
      'İpucu 3 (Parametre): Yükseklik 3000 mm ve Kalınlık 200 mm olacak şekilde 4 kenarı sırayla birleştir.',
      'Adım Adım Rehber: 1) Duvar Oluştur aracını aç. 2) Güney (0,0→6000,0), Doğu (6000,0→6000,4000), Kuzey (6000,4000→0,4000) ve Batı (0,4000→0,0) duvarlarını oluştur. 3) 24.0 m² oda damgasını gör ve Kontrol Et’e bas.',
    ],
    completionExplanation: {
      whatYouDid: '4 duvarın uç noktalarını birbirine kenetleyerek 6000 × 4000 mm kapalı bir mahal sınırı kurdun.',
      whyRight: 'Kapalı sınır oluştuğu anda sistem alanı (24.0 m²) otomatik hesapladı.',
      revitCounterpart: 'Architecture → Wall → Location Line: Wall Centerline + Chain',
      nextConcept: 'Hosted Elements — Door & Host Wall (Bilgili Kapı)',
    },
    primaryFields: ['start', 'end', 'height', 'thickness'],
    secondaryFields: ['baseLevelId', 'name'],
    difficultyPhase: 'beginner',
  },
  m03: {
    id: 'm03',
    chapter: 1,
    stepNumber: 3,
    title: 'Bilgili Kapı',
    learningConcept: 'Door Family / Type / Host / Offset',
    learningText:
      'Revit’te kapılar bağımsız çizgiler değildir; mutlaka bir taşıyıcı duvara (Host Wall) bağlanır. Yerleştirildiği duvarda otomatik boşluk açar ve kendi poz (Mark) verisini taşır.',
    revitPath: 'Architecture → Build → Door → Place on Host Wall → Properties',
    whyItMatters:
      'Kapı yanlış duvara bağlanırsa veya duvar silinirse model bütünlüğü bozulur; ayrıca Mark (D-01) parametresi kapı metraj tablosunu (Door Schedule) doğrudan besler.',
    objective:
      'Güney duvarına 900 × 2100 mm ölçülerinde kapı yerleştir. Duvar ortasına (2550 mm ofset) hizala ve D-01 pozunu ata.',
    commonErrors: [
      'Kapıyı Güney duvarı (w_south) yerine Kuzey veya Doğu duvarına bağlamak',
      'Ofset değerini 2550 mm dışında bırakmak',
    ],
    hintLevels: [
      'İpucu 1 (Alan): 2B planda Güney duvarı (w_south) üzerindeki hedef kapı açıklığı işaretine bak.',
      'İpucu 2 (Nesne): "Kapı Oluştur" aracını seç veya mevcut d1 kapısının bağlı olduğu duvarı kontrol et.',
      'İpucu 3 (Parametre): Taşıyıcı Duvar (hostWallId) = w_south, Ofset = 2550 mm, Genişlik = 900 mm, Yükseklik = 2100 mm, Mark = D-01 olmalı.',
      'Adım Adım Rehber: 1) Kapı Oluştur aracını seç. 2) Host olarak w_south duvarını seç. 3) Ofset: 2550, Genişlik: 900, Yükseklik: 2100, Eşik: 0, İşaret: D-01 girip oluştur. 4) Kontrol Et’e bas.',
    ],
    completionExplanation: {
      whatYouDid: 'Güney duvarına (w_south) bağlı, 900 × 2100 mm ölçülerinde ve D-01 pozlu parametrik kapıyı yerleştirdin.',
      whyRight: 'Kapı host duvara bağlandığı için 3B sahnede duvar otomatik delindi ve metraj verisi oluştu.',
      revitCounterpart: 'Architecture → Door → Properties (Host, Width, Height, Sill Height, Mark)',
      nextConcept: 'Wall Thickness & Structure (İnce Duvar)',
    },
    primaryFields: ['hostWallId', 'offset', 'width', 'height'],
    secondaryFields: ['sill', 'mark', 'fireRating'],
    difficultyPhase: 'beginner',
  },
  m04: {
    id: 'm04',
    chapter: 1,
    stepNumber: 4,
    title: 'İnce Duvar',
    learningConcept: 'Wall Thickness & Structural Core',
    learningText:
      'Revit’te duvar kalınlığı, duvar tipinin yapısal katmanlarından (Structure) gelir. Dış cephe duvarları ile iç bölme duvarları farklı kalınlıklara sahiptir.',
    revitPath: 'Select Wall → Properties → Edit Type → Structure → Thickness',
    whyItMatters:
      'Dış duvarlardan biri yanlışlıkla 100 mm iç bölme kalınlığında kalırsa ısı yalıtımı, cephe hizası ve net oda alanı hatalı çıkar.',
    objective:
      'Odadaki duvarlardan biri iç bölme kalınlığında (100 mm) kalmış. Hatalı duvarı bul ve tüm dış duvarların kalınlığını 200 mm yap.',
    commonErrors: ['Kalınlık yerine yüksekliği değiştirmek'],
    hintLevels: [
      'İpucu 1 (Alan): 2B planda diğerlerinden daha ince çizilmiş olan duvara dikkat et.',
      'İpucu 2 (Nesne): Doğu duvarını (w2) seçip özelliklerini diğer duvarlarla karşılaştır.',
      'İpucu 3 (Parametre): Properties panelindeki Kalınlık (Thickness) değerini kontrol et.',
      'Adım Adım Rehber: 1) w2 duvarını seç. 2) Properties panelinde Kalınlık (mm) alanını 100 yerine 200 yap. 3) Enter’a bas ve Kontrol Et ile doğrula.',
    ],
    completionExplanation: {
      whatYouDid: 'İnce kalan dış duvarın kalınlığını 200 mm dış cephe standardına eşitledin.',
      whyRight: 'Tüm dış kabuk duvarları aynı kesit kalınlığına kavuştu.',
      revitCounterpart: 'Wall → Edit Type → Construction → Structure → Thickness',
      nextConcept: 'Nesne Seçimi ve Properties Okuma',
    },
    primaryFields: ['thickness'],
    secondaryFields: ['height', 'baseLevelId'],
    difficultyPhase: 'beginner',
  },
  m05: {
    id: 'm05',
    chapter: 1,
    stepNumber: 5,
    title: 'Tekil mi Tip mi?',
    learningConcept: 'Instance vs Type Parameters',
    learningText:
      'Revit’te Properties paletindeki değerler sadece seçili elemanı etkiler (Instance); Edit Type içindekiler ise o tipteki tüm elemanları etkiler (Type).',
    revitPath: 'Properties Palette (Instance) vs. Edit Type Dialog (Type)',
    whyItMatters:
      'Bir duvarın yüksekliği (Unconnected Height) tekil (Instance) bir parametreyken, duvar kalınlığı (Thickness) tip (Type) parametresidir.',
    objective:
      'Kuzey duvarında hem tekil yükseklik hem de tip kalınlığı bozulmuş. Tüm duvarları 3000 mm yükseklik ve 200 mm kalınlık standardına getir.',
    commonErrors: ['Sadece yüksekliği düzeltip kalınlığı unutmak'],
    hintLevels: [
      'İpucu 1 (Alan): Kuzey cephesindeki duvarı (w3) hem 2B planda hem 3B sahnede incele.',
      'İpucu 2 (Nesne): w3 duvarını seçerek Properties panelini aç.',
      'İpucu 3 (Parametre): Hem Height (Instance) hem Thickness (Type) değerlerini kontrol et.',
      'Adım Adım Rehber: 1) w3 duvarını seç. 2) Yükseklik değerini 3000 mm yap. 3) Kalınlık değerini 200 mm yap. 4) Kontrol Et’e bas.',
    ],
    completionExplanation: {
      whatYouDid: 'Kuzey duvarının tekil yüksekliğini (3000 mm) ve tip kalınlığını (200 mm) birlikte düzelttin.',
      whyRight: 'Instance ve Type parametrelerinin farkını uygulayarak model tutarlılığını sağladın.',
      revitCounterpart: 'Properties (Instance: Height) & Edit Type (Type: Thickness)',
      nextConcept: 'Modelde Hata Bulma (Model Dedektifi)',
    },
    primaryFields: ['height', 'thickness'],
    secondaryFields: ['baseLevelId', 'name'],
    difficultyPhase: 'beginner',
  },
  m06: {
    id: 'm06',
    chapter: 1,
    stepNumber: 6,
    title: 'Model Dedektifi',
    learningConcept: 'BIM Model Denetimi (Audit)',
    learningText:
      'İyi bir BIM uzmanı modeli teslim etmeden önce tüm elemanların yükseklik, kalınlık ve açıklık verilerini denetler.',
    revitPath: 'Select Elements → Properties & 3D View Visual Audit',
    whyItMatters:
      'Bölüm 1’de öğrendiğin duvar yüksekliği, kalınlığı ve kapı yerleşimi kurallarını bir arada kullanarak hatalı bir modeli kurtaracaksın.',
    objective:
      'Modeldeki 2 hatalı duvar parametresini ve kapı genişlik hatasını bulup standartlara (Duvar: Y=3000, K=200; Kapı: G=900 mm) uygun hale getir.',
    commonErrors: ['Kapı genişliğini kontrol etmeyi atlamak'],
    hintLevels: [
      'İpucu 1 (Alan): Hem 3B sahnedeki duvar üst kotlarına hem de Güney duvarındaki kapıya bak.',
      'İpucu 2 (Nesne): w1, w4 duvarlarını ve d1 kapısını sırayla seç.',
      'İpucu 3 (Parametre): w1 kalınlığını 200, w4 yüksekliğini 3000 ve d1 genişliğini 900 mm yap.',
      'Adım Adım Rehber: 1) w1 kalınlığını 200 mm yap. 2) w4 yüksekliğini 3000 mm yap. 3) d1 kapısının genişliğini 900 mm yap. 4) Kontrol Et’e bas.',
    ],
    completionExplanation: {
      whatYouDid: 'Duvar yüksekliği, duvar kalınlığı ve kapı genişliği hatalarını tespit edip düzelttin.',
      whyRight: 'Bölüm 1’in tüm temel BIM/Revit parametre kurallarını tek modelde doğruladın!',
      revitCounterpart: 'Properties Palette → Constraints & Dimensions Audit',
      nextConcept: 'Bölüm 2: Level, Grid ve Model Organizasyonu',
    },
    primaryFields: ['height', 'thickness', 'width'],
    secondaryFields: ['offset', 'hostWallId', 'mark'],
    difficultyPhase: 'beginner',
  },
};

const EXTRA_LESSONS: Array<{
  id: string;
  chapter: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  stepNumber: number;
  title: string;
  learningConcept: string;
  revitPath: string;
  learningText: string;
  whyItMatters: string;
  objective: string;
  nextConcept: string;
  primaryFields: EditableField[];
  FixType: 'wall_height' | 'wall_thickness' | 'wall_level' | 'room_create' | 'door_create' | 'door_host' | 'door_offset' | 'door_width' | 'door_sill' | 'door_mark' | 'door_fire' | 'multi_qa';
}> = [
  // BÖLÜM 2 — LEVEL, GRID VE MODEL ORGANİZASYONU (07–12)
  {
    id: 'm07',
    chapter: 2,
    stepNumber: 7,
    title: 'Kat Sistemi',
    learningConcept: 'Level & Elevation Datum',
    revitPath: 'Architecture → Datum → Level (Modify | Place Level)',
    learningText: 'Revit’te Level (Kat), yatay referans düzlemidir. Duvarlar, döşemeler ve kapılar kendi yüksekliklerini bağlı oldukları Level kotundan alır.',
    whyItMatters: 'Kat kotu değiştiğinde o kata bağlı tüm mimari elemanlar otomatik olarak yeni kota taşınır.',
    objective: 'Zemin Kat (l0) referansındaki duvarların kat yüksekliğini 3000 mm kat standardına eşitle.',
    nextConcept: 'Base Constraint (Duvarı Doğru Level’a Bağla)',
    primaryFields: ['baseLevelId', 'height'],
    FixType: 'wall_height',
  },
  {
    id: 'm08',
    chapter: 2,
    stepNumber: 8,
    title: 'Yanlış Kat',
    learningConcept: 'Base Constraint (Alt Kat Bağlantısı)',
    revitPath: 'Select Wall → Properties → Constraints → Base Constraint',
    learningText: 'Her duvarın hangi kattan başladığını Base Constraint belirler. Yanlış kata bağlanan duvar 3B sahnede havada asılı kalır.',
    whyItMatters: 'Çok katlı projelerde duvarların doğru kata (Zemin Kat = l0) bağlanması metrajın katlara göre doğru ayrılmasını sağlar.',
    objective: 'Üst kata (l1) yanlış bağlanmış duvarı bul ve Base Level (Kat Referansı) değerini Zemin Kat (l0) yap.',
    nextConcept: 'Top Constraint (Üst Sınır)',
    primaryFields: ['baseLevelId', 'height'],
    FixType: 'wall_level',
  },
  {
    id: 'm09',
    chapter: 2,
    stepNumber: 9,
    title: 'Üst Sınır',
    learningConcept: 'Top Constraint & Kat Yüksekliği',
    revitPath: 'Select Wall → Properties → Constraints → Top Constraint',
    learningText: 'Duvarların üst kotu bir üst kata (Up to level) bağlanır veya kat yüksekliği (3000 mm) ile sınırlandırılır.',
    whyItMatters: 'Üst sınır tutarlılığı, döşeme altı ile duvar üstünün çakışmasını önler.',
    objective: 'Üst kotu alçak kalmış olan duvarları 1. Kat kotuna (3000 mm) ulaştır.',
    nextConcept: 'Grid (Aks Sistemi)',
    primaryFields: ['height', 'baseLevelId'],
    FixType: 'wall_height',
  },
  {
    id: 'm10',
    chapter: 2,
    stepNumber: 10,
    title: 'Aks Sistemi',
    learningConcept: 'Grid & Koordinat Referansı',
    revitPath: 'Architecture → Datum → Grid',
    learningText: 'Grid (Aks) çizgileri taşıyıcı elemanların ve ana duvarların plandaki yatay/düşey hizasını belirler.',
    whyItMatters: 'Şantiyede binanın aplikasyonu aks kesişim noktalarına göre yapılır.',
    objective: 'Aks kesişim noktalarına (0,0 – 6000,4000 mm) tam oturan 4 duvarlı aks çerçevesini oluştur.',
    nextConcept: 'Grid’e Göre Duvar Yerleştir',
    primaryFields: ['start', 'end', 'thickness'],
    FixType: 'room_create',
  },
  {
    id: 'm11',
    chapter: 2,
    stepNumber: 11,
    title: 'Aksa Oturan Duvar',
    learningConcept: 'Wall Location Line & Grid Alignment',
    revitPath: 'Modify | Place Wall → Options Bar → Location Line: Wall Centerline',
    learningText: 'Duvar çizilirken Location Line (Wall Centerline) aks çizgisiyle çakışmalıdır; aksi halde oda boyutları kayar.',
    whyItMatters: 'Aksından kaymış bir duvar komşu duvarlarla açık köşe (Open Corner) oluşturur.',
    objective: 'Akstan kaymış duvar kalınlık ve yükseklik değerlerini 3000 mm yükseklik ve 200 mm kalınlık aks standardına getir.',
    nextConcept: 'Kot Kayması Denetimi',
    primaryFields: ['thickness', 'height'],
    FixType: 'wall_thickness',
  },
  {
    id: 'm12',
    chapter: 2,
    stepNumber: 12,
    title: 'Kot Kayması',
    learningConcept: 'Level & Constraint Denetimi',
    revitPath: 'Properties → Constraints → Base Constraint & Unconnected Height',
    learningText: 'Bölüm 2 sonunda kat bağlantısı (Base Level) ve yükseklik kısıtlamalarını birlikte denetliyoruz.',
    whyItMatters: 'Kat organizasyonu hatasız olduğunda 3B modelde hiçbir eleman kopuk görünmez.',
    objective: 'Yanlış kata (l1) bağlı duvarı Zemin Kat (l0) referansına al ve yüksekliğini 3000 mm olarak doğrula.',
    nextConcept: 'Bölüm 3: Temel Mimari Modelleme',
    primaryFields: ['baseLevelId', 'height'],
    FixType: 'wall_level',
  },

  // BÖLÜM 3 — TEMEL MİMARİ MODELLEME (13–22) · %40 Öğretim / %60 Problem Çözme
  {
    id: 'm13',
    chapter: 3,
    stepNumber: 13,
    title: 'Çekirdek Hacim',
    learningConcept: 'Room Bounding Walls (Oda Sınırlayıcı Duvarlar)',
    revitPath: 'Architecture → Wall → Properties → Room Bounding',
    learningText: 'Revit’te duvarların "Room Bounding" özelliği açıktır; 4 duvar kapandığında iç mekan otomatik tanımlanır.',
    whyItMatters: 'Kapalı sınır olmadan döşeme, tavan ve mahal (Room) elemanları üretilemez.',
    objective: '6000 × 4000 mm kapalı mimari hacmi 4 duvarla eksiksiz oluştur.',
    nextConcept: 'Duvar Zinciri (Chain)',
    primaryFields: ['start', 'end', 'height'],
    FixType: 'room_create',
  },
  {
    id: 'm14',
    chapter: 3,
    stepNumber: 14,
    title: 'Duvar Zinciri',
    learningConcept: 'Continuous Wall Chain (Kesintisiz Duvar Zinciri)',
    revitPath: 'Modify | Place Wall → Options Bar → Chain',
    learningText: 'Chain seçeneği aktifken bir duvarın bitiş noktası otomatik olarak sonraki duvarın başlangıç noktası olur.',
    whyItMatters: 'Köşe birleşimlerinin (Trim/Extend to Corner) hatasız kapanmasını sağlar.',
    objective: 'Zincir mantığıyla (0,0) başlangıçlı 6000 × 4000 mm dikdörtgen duvar döngüsünü tamamla.',
    nextConcept: 'Kapının Yeri (Door Placement)',
    primaryFields: ['start', 'end', 'thickness'],
    FixType: 'room_create',
  },
  {
    id: 'm15',
    chapter: 3,
    stepNumber: 15,
    title: 'Kapının Yeri',
    learningConcept: 'Door Placement & Temporary Dimensions',
    revitPath: 'Architecture → Build → Door → Temporary Dimensions (Offset)',
    learningText: 'Revit’te kapıyı duvara yerleştirirken geçici ölçüler (Temporary Dimensions) kapının köşe duvara uzaklığını gösterir.',
    whyItMatters: 'Kapı ofseti mimari plandaki mobilya yerleşimini ve kapı kanadı süpürme alanını belirler.',
    objective: 'Güney duvarındaki kapının ofsetini tam merkeze (2550 mm) hizala.',
    nextConcept: 'Kapı Host Kontrolü',
    primaryFields: ['offset', 'hostWallId'],
    FixType: 'door_offset',
  },
  {
    id: 'm16',
    chapter: 3,
    stepNumber: 16,
    title: 'Taşıyıcı Duvar',
    learningConcept: 'Door Host Relationship (Pick New Host)',
    revitPath: 'Select Door → Modify | Doors → Host → Pick New Host',
    learningText: 'Yanlış cepheye yerleştirilen bir kapıyı silip baştan çizmek yerine Host duvarını değiştirebilirsin.',
    whyItMatters: 'Kapının mevcut poz (Mark) ve boyut verilerini kaybetmeden doğru duvara taşınmasını sağlar.',
    objective: 'Kuzey duvarına yanlış yerleştirilmiş olan d1 kapısını Güney duvarına (w_south) taşı.',
    nextConcept: 'Pencere Yerleştir (Window)',
    primaryFields: ['hostWallId', 'offset'],
    FixType: 'door_host',
  },
  {
    id: 'm17',
    chapter: 3,
    stepNumber: 17,
    title: 'Cephe Açıklığı',
    learningConcept: 'Window & Hosted Wall Opening',
    revitPath: 'Architecture → Build → Window → Place on Wall',
    learningText: 'Pencereler de tıpkı kapılar gibi duvara bağlı (Hosted) açıklıklardır ancak döşemeden belirli bir parapet yüksekliğinde (Sill > 0) başlar.',
    whyItMatters: 'Doğal aydınlatma ve cephe simetrisi için açıklık genişliği ve ofseti hassas ayarlanmalıdır.',
    objective: 'Güney cephesindeki açıklığın genişliğini 900 mm ve ofsetini 2550 mm olarak ayarla.',
    nextConcept: 'Parapet Kotu (Sill Height)',
    primaryFields: ['width', 'offset', 'sill'],
    FixType: 'door_width',
  },
  {
    id: 'm18',
    chapter: 3,
    stepNumber: 18,
    title: 'Eşik ve Parapet',
    learningConcept: 'Sill Height & Head Height',
    revitPath: 'Select Opening → Properties → Constraints → Sill Height',
    learningText: 'Sill Height (Eşik/Parapet Yüksekliği), açıklığın alt kenarının bağlı olduğu kat döşemesinden yüksekliğidir.',
    whyItMatters: 'Kapılarda hemzemin geçiş için Sill Height 0 mm olmalıdır; aksi halde takılma eşiği oluşur.',
    objective: 'Havada kalmış olan giriş açıklığının eşik yüksekliğini (sill) 0 mm döşeme kotuna indir.',
    nextConcept: 'Zemin Döşemesi (Floor)',
    primaryFields: ['sill', 'height'],
    FixType: 'door_sill',
  },
  {
    id: 'm19',
    chapter: 3,
    stepNumber: 19,
    title: 'Zemin Döşemesi',
    learningConcept: 'Floor Boundary & Wall Core Support',
    revitPath: 'Architecture → Build → Floor → Pick Walls',
    learningText: 'Revit’te Floor (Döşeme) oluştururken "Pick Walls" aracıyla dış duvarlar seçilir ve kapalı döşeme poligonu elde edilir.',
    whyItMatters: 'Döşemenin tam oturması için çevreleyen 4 duvarın kesintisiz ve 200 mm kalınlıkta olması gerekir.',
    objective: 'Döşeme sınırını taşıyan 4 çevre duvarını 6000 × 4000 mm kapalı poligon olarak oluştur.',
    nextConcept: 'Çatı Kabuğu (Roof)',
    primaryFields: ['start', 'end', 'thickness'],
    FixType: 'room_create',
  },
  {
    id: 'm20',
    chapter: 3,
    stepNumber: 20,
    title: 'Çatı Kabuğu',
    learningConcept: 'Roof by Footprint & Wall Top Alignment',
    revitPath: 'Architecture → Build → Roof → Roof by Footprint',
    learningText: 'Çatının duvarların üstüne boşluksuz oturması için tüm çevre duvarların üst kotu (3000 mm) aynı düzlemde olmalıdır.',
    whyItMatters: 'Bir duvar alçak kalırsa çatı saçağı ile duvar arasında açıklık kalır.',
    objective: 'Çatı oturuşunu bozan alçak duvarları bul ve tüm duvar yüksekliklerini 3000 mm çatı kotuna eşitle.',
    nextConcept: 'Düşey Sirkülasyon (Stair)',
    primaryFields: ['height'],
    FixType: 'wall_height',
  },
  {
    id: 'm21',
    chapter: 3,
    stepNumber: 21,
    title: 'Düşey Sirkülasyon',
    learningConcept: 'Stair & Katlar Arası Yükseklik',
    revitPath: 'Architecture → Circulation → Stair (Base Level → Top Level)',
    learningText: 'Revit merdiven rıht sayısını kat yüksekliğine göre otomatik hesaplar. 3000 mm kat yüksekliği 17×176.5 mm standart basamak üretir.',
    whyItMatters: 'Kat duvar yüksekliği yanlışsa merdiven üst sahanlığı döşeme kotunu tutturamaz.',
    objective: 'Merdiven kovasını çevreleyen duvarların yüksekliğini tam 3000 mm kat yüksekliğine ayarla.',
    nextConcept: 'Mekan Tanımı (Room)',
    primaryFields: ['height', 'baseLevelId'],
    FixType: 'wall_height',
  },
  {
    id: 'm22',
    chapter: 3,
    stepNumber: 22,
    title: 'Mekan Tanımı',
    learningConcept: 'Room & Area Computation',
    revitPath: 'Architecture → Room & Area → Room',
    learningText: 'Room elemanı yerleştirildiğinde kapalı duvar sınırlarını tarar ve "MAHAL 101 · 24.0 m²" bilgisini üretir.',
    whyItMatters: 'Mahal listesi (Room Schedule) mimari projenin net/brüt kullanım alanlarını belgeleyen temel çıktıdır.',
    objective: '24.0 m² net mahal alanını oluşturacak 6000 × 4000 mm kapalı odayı tamamla.',
    nextConcept: 'Bölüm 4: BIM Bilgisi ve Parametreler',
    primaryFields: ['start', 'end', 'height'],
    FixType: 'room_create',
  },

  // BÖLÜM 4 — BIM BİLGİSİ VE PARAMETRELER (23–29) · %40 Öğretim / %60 Problem Çözme
  {
    id: 'm23',
    chapter: 4,
    stepNumber: 23,
    title: 'Yanlış Kapı Tipi',
    learningConcept: 'Door Type Dimensions (Width & Height)',
    revitPath: 'Select Door → Properties → Type Selector (900 × 2100 mm)',
    learningText: 'Revit’te kapı boyutları (900 × 2100 mm) kapı tipini tanımlar. Dar bir şaft kapısı ana girişte kullanılamaz.',
    whyItMatters: 'Erişilebilirlik yönetmeliğine göre ana giriş kapısı en az 900 mm temiz geçiş sağlamalıdır.',
    objective: 'Güney duvarındaki dar kalmış kapının genişliğini 900 mm standart tip ölçüsüne getir.',
    nextConcept: 'Açıklık Tipi Değiştir',
    primaryFields: ['width', 'height'],
    FixType: 'door_width',
  },
  {
    id: 'm24',
    chapter: 4,
    stepNumber: 24,
    title: 'Tip Boyutu Değişimi',
    learningConcept: 'Edit Type → Width & Height Parameters',
    revitPath: 'Select Opening → Properties → Edit Type → Dimensions',
    learningText: 'Açıklık yüksekliği (Height = 2100 mm) kapı ve pencerelerin üst lento hizasını (Head Height) belirler.',
    whyItMatters: 'Cephedeki tüm kapı ve pencerelerin üst hizasının (2100 mm) eşit olması mimari cephe dilini korur.',
    objective: 'Güney duvarına 900 × 2100 mm standart tip ölçülerinde kapıyı yerleştir.',
    nextConcept: 'Family / Type İlişkisi',
    primaryFields: ['width', 'height', 'offset'],
    FixType: 'door_create',
  },
  {
    id: 'm25',
    chapter: 4,
    stepNumber: 25,
    title: 'Aile ve Tip',
    learningConcept: 'Category → Family → Type → Instance Hiyerarşisi',
    revitPath: 'Project Browser → Families → Doors → Single-Flush → 900×2100mm',
    learningText: 'Revit’te her nesne 4 kademeli bir hiyerarşiye sahiptir: Kategori (Doors) → Family (Tek Kanatlı) → Type (900×2100) → Instance (d1).',
    whyItMatters: 'Bu hiyerarşiyi bilmek, projede tek bir elemanı mı yoksa tüm tipleri mi değiştireceğini kontrol etmeni sağlar.',
    objective: 'd1 kapısının tip genişliğini 900 mm ve tekil ofsetini 2550 mm olarak doğrula.',
    nextConcept: 'Malzeme ve Yangın Sınıfı',
    primaryFields: ['width', 'offset'],
    FixType: 'door_width',
  },
  {
    id: 'm26',
    chapter: 4,
    stepNumber: 26,
    title: 'Yangın Dayanımı',
    learningConcept: 'Identity Data & Fire Rating (EI30)',
    revitPath: 'Select Door → Properties → Identity Data → Fire Rating',
    learningText: 'BIM elemanları sadece 3B geometri değildir; yangın dayanım sınıfı (EI30 / EI60) gibi hayati teknik şartname verilerini taşır.',
    whyItMatters: 'Yangın yönetmeliği denetiminde kapıların Fire Rating parametresi otomatik filtrelenir.',
    objective: 'Güney duvarındaki d1 kapısının yangın dayanım sınıfını (fireRating) EI30 olarak ata.',
    nextConcept: 'Poz ve Numaralandırma (Mark)',
    primaryFields: ['fireRating', 'mark'],
    FixType: 'door_fire',
  },
  {
    id: 'm27',
    chapter: 4,
    stepNumber: 27,
    title: 'Poz Numarası',
    learningConcept: 'Identity Data: Mark (D-01)',
    revitPath: 'Select Element → Properties → Identity Data → Mark',
    learningText: 'Mark parametresi her kapı veya odaya verilen benzersiz kimlik/poz numarasıdır (örn. D-01).',
    whyItMatters: 'Paftadaki kapı etiketi (Door Tag) doğrudan bu Mark değerini ekrana yazar.',
    objective: 'Kapının hatalı poz numarasını (Mark) standart "D-01" değeriyle güncelle.',
    nextConcept: 'Parametre Tutarsızlığı Bul',
    primaryFields: ['mark', 'fireRating'],
    FixType: 'door_mark',
  },
  {
    id: 'm28',
    chapter: 4,
    stepNumber: 28,
    title: 'Veri Avcısı',
    learningConcept: 'Schedule & Parameter Consistency',
    revitPath: 'View → Create → Schedules → Schedule/Quantities',
    learningText: 'Revit metraj tabloları (Schedules) model verisinin canlı yansımasıdır. Tablodaki veya modeldeki tutarsız veri anında sırıtır.',
    whyItMatters: 'Yanlış duvar kalınlığı beton/tuğla metrajını doğrudan hatalı hesaplatır.',
    objective: 'Metraj tablosunda farklı kalınlıkta görünen duvarı bul ve 200 mm standardına eşitle.',
    nextConcept: 'Model Verisini Kontrol Et',
    primaryFields: ['thickness', 'height'],
    FixType: 'wall_thickness',
  },
  {
    id: 'm29',
    chapter: 4,
    stepNumber: 29,
    title: 'Bilgi Kalite Kapısı',
    learningConcept: 'LOI (Level of Information) Doğrulaması',
    revitPath: 'Properties → Constraints + Dimensions + Identity Data',
    learningText: 'Bir BIM modelinin teslim kalitesi hem geometrik (LOd) hem de sözel bilgi (LOI) doğruluğuyla ölçülür.',
    whyItMatters: 'Eksik veya yanlış poz/ölçü verisi şantiyede yanlış kapı siparişine yol açar.',
    objective: 'd1 kapısının Mark değerini "D-01", genişliğini 900 mm ve eşik kotunu 0 mm olarak doğrula.',
    nextConcept: 'Bölüm 5: View, Section, Elevation ve Dokümantasyon',
    primaryFields: ['mark', 'width', 'sill'],
    FixType: 'door_mark',
  },

  // BÖLÜM 5 — VIEW, SECTION, ELEVATION VE DOKÜMANTASYON (30–37) · %40 Öğretim / %60 Problem Çözme
  {
    id: 'm30',
    chapter: 5,
    stepNumber: 30,
    title: 'Plan Kesit Düzlemi',
    learningConcept: 'Floor Plan & View Range (Cut Plane = 1200 mm)',
    revitPath: 'Floor Plan Properties → Extents → View Range → Cut Plane',
    learningText: 'Revit kat planı aslında binanın 1200 mm yüksekliğinden geçen yatay bir kesittir. Kapı ve duvarlar bu düzlemde kesilerek çizilir.',
    whyItMatters: 'Eşik yüksekliği (Sill) kesit düzleminin üstüne çıkarsa açıklık planda doğru görünmez.',
    objective: 'Plan kesit düzleminde doğru görünmesi için kapının eşik kotunu (sill) 0 mm yap.',
    nextConcept: 'İlk Kesit (Section)',
    primaryFields: ['sill', 'height'],
    FixType: 'door_sill',
  },
  {
    id: 'm31',
    chapter: 5,
    stepNumber: 31,
    title: 'İlk Kesit',
    learningConcept: 'Section View & Düşey Kot Kontrolü',
    revitPath: 'View → Create → Section',
    learningText: 'Kesit görünüşü (Section) binayı düşey olarak keser; duvar yükseklikleri ve kapı lento kotları kesitte en net haliyle okunur.',
    whyItMatters: 'Planda fark edilmeyen yükseklik hataları kesit açıldığında hemen ortaya çıkar.',
    objective: 'Kesitte alçak görünen duvarları tespit et ve tüm duvar yüksekliklerini 3000 mm yap.',
    nextConcept: 'Cephe Bakışı (Elevation)',
    primaryFields: ['height'],
    FixType: 'wall_height',
  },
  {
    id: 'm32',
    chapter: 5,
    stepNumber: 32,
    title: 'Cephe Bakışı',
    learningConcept: 'Building Elevation & Cephe Simetrisi',
    revitPath: 'View → Create → Elevation → South Elevation',
    learningText: 'Güney cephe görünüşü (South Elevation) binanın dış yüzünü ortografik olarak gösterir.',
    whyItMatters: 'Giriş kapısının cephede tam ortada durması için başlangıç ofseti 2550 mm olmalıdır.',
    objective: 'Güney cephe görünüşünde kaymış duran d1 kapısını 2550 mm ofsetle cephe ortasına hizala.',
    nextConcept: 'Kadraj Sınırı (Crop Region)',
    primaryFields: ['offset', 'hostWallId'],
    FixType: 'door_offset',
  },
  {
    id: 'm33',
    chapter: 5,
    stepNumber: 33,
    title: 'Kadraj Sınırı',
    learningConcept: 'Crop View & Crop Region',
    revitPath: 'View Control Bar → Crop View / Show Crop Region',
    learningText: 'Crop Region, görünüşün paftada kaplayacağı dikdörtgen sınır çerçevesidir.',
    whyItMatters: 'Model elemanlarının kadraj dışına taşmaması için bina sınırlarının (6000 × 4000 mm) doğru kurulması gerekir.',
    objective: 'Kadraj sınırına tam oturan 6000 × 4000 mm kapalı bina kabuğunu oluştur.',
    nextConcept: 'Kesin Ölçü (Aligned Dimension)',
    primaryFields: ['start', 'end', 'height'],
    FixType: 'room_create',
  },
  {
    id: 'm34',
    chapter: 5,
    stepNumber: 34,
    title: 'Kesin Ölçü',
    learningConcept: 'Aligned Dimension & Duvar Kalınlık Ölçüsü',
    revitPath: 'Annotate → Dimension → Aligned (DI)',
    learningText: 'Revit’te ölçü çizgileri (Dimensions) sahte metin değildir; duvarların gerçek mesafesini ve kalınlığını okur.',
    whyItMatters: 'Ölçü çizgisinin 200 mm göstermesi için duvarın gerçek kalınlığı 200 mm olmalıdır.',
    objective: 'Ölçü kontrolünde hatalı çıkan duvar kalınlığını 200 mm proje standardına getir.',
    nextConcept: 'Akıllı Etiket (Door / Room Tag)',
    primaryFields: ['thickness'],
    FixType: 'wall_thickness',
  },
  {
    id: 'm35',
    chapter: 5,
    stepNumber: 35,
    title: 'Akıllı Etiket',
    learningConcept: 'Tag by Category (Door Tag & Mark)',
    revitPath: 'Annotate → Tag → Tag by Category (TG)',
    learningText: 'Revit’te etiketler (Tags) nesnenin içindeki Mark parametresini okur. Nesne değişirse etiket otomatik güncellenir.',
    whyItMatters: 'Manuel yazı (Text) yerine Tag kullanmak çizim ile metraj arasındaki çelişkiyi sıfırlar.',
    objective: 'Kapı etiketinin planda "D-01" göstermesi için d1 kapısının Mark parametresini D-01 yap.',
    nextConcept: 'Pafta Kurulumu (Sheet)',
    primaryFields: ['mark'],
    FixType: 'door_mark',
  },
  {
    id: 'm36',
    chapter: 5,
    stepNumber: 36,
    title: 'Pafta Kurulumu',
    learningConcept: 'Sheets & Titleblocks (A101Mimari Pafta)',
    revitPath: 'View → Sheet Composition → New Sheet',
    learningText: 'Sheet (Pafta), plan, kesit, 3B görünüş ve metraj tablolarının antetli kağıda yerleştirildiği teslim sayfasıdır.',
    whyItMatters: 'Paftaya koyulan görünüşler modelle canlı bağlantılıdır; pafta öncesi tüm duvar yükseklikleri tam olmalıdır.',
    objective: 'Paftaya alınacak görünüşteki eksik duvar yüksekliklerini 3000 mm olarak tamamla.',
    nextConcept: 'Paftaya Hazır (Place View on Sheet)',
    primaryFields: ['height'],
    FixType: 'wall_height',
  },
  {
    id: 'm37',
    chapter: 5,
    stepNumber: 37,
    title: 'Paftaya Hazır',
    learningConcept: 'Place View on Sheet & Dokümantasyon Onayı',
    revitPath: 'Project Browser → Sheets → Drag Floor Plan to Sheet',
    learningText: 'Görünüş paftaya yerleştirildiğinde hem plan hem kesit hem de kapı etiketi aynı anda basıma hazır hale gelir.',
    whyItMatters: 'Bölüm 5 sonunda dokümantasyon kalitesi eksiksiz bir kapı ve duvar modeliyle doğrulanır.',
    objective: 'Güney duvarına D-01 pozlu, 900 × 2100 mm ölçülerinde ve 2550 mm ofsetli kapıyı eksiksiz yerleştir.',
    nextConcept: 'Bölüm 6: Model Kontrolü & Gerçek Proje Problemleri',
    primaryFields: ['hostWallId', 'offset', 'width', 'mark'],
    FixType: 'door_create',
  },

  // BÖLÜM 6 — MODEL KONTROLÜ & GERÇEK PROJE PROBLEMLERİ (38–43) · %20 Öğretim / %80 Problem Çözme
  {
    id: 'm38',
    chapter: 6,
    stepNumber: 38,
    title: 'Kaçan Sınır',
    learningConcept: 'Problem Çözme: Açık Room Boundary Tespiti',
    revitPath: 'Modify → Warning: Room is not in a properly enclosed region',
    learningText: 'Projede mahal alanı hesaplanamıyor. Duvar sınırlarını inceleyerek kapalı odayı tamamla.',
    whyItMatters: 'Gerçek projelerde açık kalan köşe birleşimleri en sık karşılaşılan modelleme hatasıdır.',
    objective: 'Modeli incele; 6000 × 4000 mm kapalı oda sınırını (Y: 3000, K: 200 mm) eksiksiz kur.',
    nextConcept: 'Yanlış Level’a Bağlı Duvarlar',
    primaryFields: ['start', 'end', 'height', 'thickness'],
    FixType: 'room_create',
  },
  {
    id: 'm39',
    chapter: 6,
    stepNumber: 39,
    title: 'Kopuk Katlar',
    learningConcept: 'Problem Çözme: Kat Bağlantısı Denetimi',
    revitPath: 'Properties → Base Constraint Audit',
    learningText: '3B görünümde bazı duvarların kat referansı kaymış. Hatalı elemanı kendi başına tespit edip düzelt.',
    whyItMatters: 'Koordinasyon toplantılarında kat kaymaları disiplinler arası çakışmaya (Clash) neden olur.',
    objective: 'Modeldeki kat referansı (Base Level) hatasını bul ve tüm duvarları Zemin Kat (l0) kotuna bağla.',
    nextConcept: 'Standart Dışı Kapılar',
    primaryFields: ['baseLevelId', 'height'],
    FixType: 'wall_level',
  },
  {
    id: 'm40',
    chapter: 6,
    stepNumber: 40,
    title: 'Standart Dışı Kapı',
    learningConcept: 'Problem Çözme: Kapı Tipi ve Yangın Sınıfı Denetimi',
    revitPath: 'Door Schedule & Properties QA',
    learningText: 'Yangın danışmanı giriş kapısının yangın sınıfını EI30 olarak talep etti. Modeli denetleyip uygun hale getir.',
    whyItMatters: 'Ruhsat projelerinde yangın sınıfı uyumsuzluğu doğrudan red sebebidir.',
    objective: 'Giriş kapısının yangın dayanım sınıfını EI30 olarak güncelle ve diğer parametrelerini koru.',
    nextConcept: 'Cephe Hiza Hatası',
    primaryFields: ['fireRating', 'width', 'mark'],
    FixType: 'door_fire',
  },
  {
    id: 'm41',
    chapter: 6,
    stepNumber: 41,
    title: 'Cephe Hiza Hatası',
    learningConcept: 'Problem Çözme: Eşik ve Açıklık Kotu Denetimi',
    revitPath: 'Elevation View → Sill & Head Height Check',
    learningText: 'Şantiyeden gelen rapora göre giriş açıklığı döşeme kotundan yüksekte kalmış. Hatayı bul ve düzelt.',
    whyItMatters: 'Uygulama hatasını şantiyeye gitmeden BIM modelinde yakalamak maliyet ve zaman kurtarır.',
    objective: 'Giriş kapısındaki eşik kotu (sill) hatasını tespit et ve döşeme kotuna (0 mm) sıfırla.',
    nextConcept: 'Eksik Pozlar',
    primaryFields: ['sill', 'offset', 'height'],
    FixType: 'door_sill',
  },
  {
    id: 'm42',
    chapter: 6,
    stepNumber: 42,
    title: 'Eksik Pozlar',
    learningConcept: 'Problem Çözme: Tag ve Mark Denetimi',
    revitPath: 'Annotate → Tag / Door Schedule Mark Audit',
    learningText: 'Pafta teslimi öncesi kapı poz numarasının proje standardından saptığı fark edildi. İlgili parametreyi bulup düzelt.',
    whyItMatters: 'Poz numarası tutarsızlığı ihale dosyasında yanlış adet sayımına yol açar.',
    objective: 'Kapı üzerindeki yanlış poz numarasını bul ve standart "D-01" değerine getir.',
    nextConcept: 'Baş Mimar Denetimi (Model QA)',
    primaryFields: ['mark', 'hostWallId'],
    FixType: 'door_mark',
  },
  {
    id: 'm43',
    chapter: 6,
    stepNumber: 43,
    title: 'Baş Mimar Denetimi',
    learningConcept: 'Problem Çözme: Tam Model QA/QC Kontrolü',
    revitPath: 'Full Model Coordination & Properties Audit',
    learningText: 'Final projesine geçmeden önceki son kalite kontrol sınavı. Modeldeki tüm geometrik ve parametrik kusurları ayıkla.',
    whyItMatters: 'Gerçek bir BIM koordinatörü modeli tek seferde hatasız teslim seviyesine getirir.',
    objective: 'Modeldeki duvar yüksekliği, kalınlık ve kapı genişliği kusurlarını tespit edip proje standartlarına (3000 / 200 / 900 mm) ulaştır.',
    nextConcept: 'Bölüm 7: Final Proje (Uçtan Uca Mimari Teslim)',
    primaryFields: ['height', 'thickness', 'width'],
    FixType: 'multi_qa',
  },

  // BÖLÜM 7 — FİNAL PROJE (44–50) · Sadece Proje Brief'i + Başarı Kriterleri
  {
    id: 'm44',
    chapter: 7,
    stepNumber: 44,
    title: 'Proje Kurulumu',
    learningConcept: 'Final Proje Adım 1: Project Setup & Level/Wall Standards',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi Başlangıcı: Konut biriminin Zemin Kat (l0) duvar yüksekliği standartlarını (3000 mm) bağımsız olarak kur.',
    whyItMatters: 'Final bölümünde hangi tuşa basacağın söylenmez; önceki 6 bölümde edindiğin Revit reflekslerini kullanırsın.',
    objective: 'Final Brief 1/7: Zemin kat taşıyıcı duvarlarının tamamını 3000 mm kat yüksekliğine ve 200 mm kalınlığa hazırla.',
    nextConcept: 'Final 2/7: Zemin Kat Kabuğu',
    primaryFields: ['height', 'thickness', 'baseLevelId'],
    FixType: 'wall_height',
  },
  {
    id: 'm45',
    chapter: 7,
    stepNumber: 45,
    title: 'Zemin Kat Kabuğu',
    learningConcept: 'Final Proje Adım 2: Ground Floor Shell',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi: Konut çekirdek hacminin kapalı dış duvar sınırlarını (6000 × 4000 mm, Y:3000, K:200) oluştur.',
    whyItMatters: 'Dış kabuk kapandığında döşeme, çatı ve mahal alanları otomatik aktifleşir.',
    objective: 'Final Brief 2/7: Zemin katta 6000 × 4000 mm kapalı dış kabuğu (Y: 3000 mm, K: 200 mm) eksiksiz inşa et.',
    nextConcept: 'Final 3/7: Açıklıklar ve Mekanlar',
    primaryFields: ['start', 'end', 'height', 'thickness'],
    FixType: 'room_create',
  },
  {
    id: 'm46',
    chapter: 7,
    stepNumber: 46,
    title: 'Açıklıklar ve Mekanlar',
    learningConcept: 'Final Proje Adım 3: Doors, Windows & Rooms',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi: Güney cephesine ana giriş kapısını (900 × 2100 mm, Ofset: 2550 mm, Mark: D-01) yerleştir.',
    whyItMatters: 'Doğru host duvar ve açıklık parametreleri konutun giriş sirkülasyonunu tamamlar.',
    objective: 'Final Brief 3/7: Güney duvarına (w_south) 900 × 2100 mm ölçülerinde, 2550 mm ofsetli ve D-01 pozlu kapıyı bağla.',
    nextConcept: 'Final 4/7: Kesit ve Ölçülendirme',
    primaryFields: ['hostWallId', 'offset', 'width', 'height', 'mark'],
    FixType: 'door_create',
  },
  {
    id: 'm47',
    chapter: 7,
    stepNumber: 47,
    title: 'Kesit ve Ölçülendirme',
    learningConcept: 'Final Proje Adım 4: Sections, Dimensions & Tags',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi: Kesit ve ölçü kontrolünde tespit edilen cephe açıklık kaymasını ve poz etiketini düzelt.',
    whyItMatters: 'Kesit ve ölçü doğrulaması yapılmamış bir model paftaya yerleştirilemez.',
    objective: 'Final Brief 4/7: Güney cephesindeki kapıyı 2550 mm merkez ofsetine hizala ve ölçü bütünlüğünü sağla.',
    nextConcept: 'Final 5/7: Pafta Hazırlığı',
    primaryFields: ['offset', 'width', 'sill'],
    FixType: 'door_offset',
  },
  {
    id: 'm48',
    chapter: 7,
    stepNumber: 48,
    title: 'Pafta Hazırlığı',
    learningConcept: 'Final Proje Adım 5: Sheet Preparation',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi: Paftaya yerleştirilecek görünüşlerdeki duvar kesit kalınlıklarını (200 mm) son kez denetle.',
    whyItMatters: 'Pafta ölçeğinde (1/50) tüm taşıyıcı dış duvar kalınlıkları tutarlı görünmelidir.',
    objective: 'Final Brief 5/7: Pafta görünüşündeki tüm dış duvar kalınlıklarını 200 mm olarak doğrula.',
    nextConcept: 'Final 6/7: Son Kalite Kontrolü',
    primaryFields: ['thickness', 'height'],
    FixType: 'wall_thickness',
  },
  {
    id: 'm49',
    chapter: 7,
    stepNumber: 49,
    title: 'Son Kalite Kontrolü',
    learningConcept: 'Final Proje Adım 6: Final Model QA Check',
    revitPath: 'Final Project Brief — Bağımsız Uygulama',
    learningText: 'Final Projesi: Teslim öncesi son QA kontrolü. Duvar yükseklikleri, kalınlıkları ve kapı açıklığını denetle.',
    whyItMatters: 'Sıfır hata ile teslim edilen BIM modeli doğrudan şantiye uygulamasına geçebilir.',
    objective: 'Final Brief 6/7: Modeldeki tüm duvar (Y: 3000, K: 200 mm) ve kapı (G: 900 mm) parametre kusurlarını gider.',
    nextConcept: 'Final 7/7: Teslim Zamanı (Project Delivery)',
    primaryFields: ['height', 'thickness', 'width'],
    FixType: 'multi_qa',
  },
  {
    id: 'm50',
    chapter: 7,
    stepNumber: 50,
    title: 'Teslim Zamanı',
    learningConcept: 'Final Proje Adım 7: Tam Mimari BIM Modeli Teslimi',
    revitPath: 'Final Project Delivery — BIM Master Architect',
    learningText: 'Mezuniyet Görevi: Tek katlı konut biriminin dış kabuk, kat referansı ve bağlı kapı şartnamesini eksiksiz tamamlayarak teslim et.',
    whyItMatters: 'Tebrikler! Bu görevi tamamladığında Revit’in Level, Wall, Hosted Door, Properties, Type/Instance ve QA mantığına tamamen hakim olacaksın.',
    objective: 'Final Brief 7/7: Güney duvarına (w_south) bağlı, 2550 mm ofsetli, 900 × 2100 mm ölçülerinde, D-01 pozlu kapıyı oluştur ve konut modelini teslim et.',
    nextConcept: 'Mezuniyet: Sertifikalı BIM & Revit Mimarı!',
    primaryFields: ['hostWallId', 'offset', 'width', 'height', 'mark', 'fireRating'],
    FixType: 'door_create',
  },
  // BONUS BÖLÜM 8 — ÇİZELGELER (Schedules)
  {
    id: 'm51',
    chapter: 8,
    stepNumber: 51,
    title: 'Kapı Çizelgesi',
    learningConcept: 'Door Schedule & Mark',
    revitPath: 'View → Create → Schedules → Schedule/Quantities → Doors',
    learningText: 'Çizelge, model verisinin tablo halidir. Bir hücreyi değiştirmek modeldeki nesneyi değiştirir; şantiyeye giden kapı listesi buradan çıkar.',
    whyItMatters: 'Tekrarlayan veya boş poz numaraları metrajda ve şantiye siparişinde karışıklığa yol açar.',
    objective: 'Kapı çizelgesini aç. Poz numaralarını d1 → D-01, d2 → D-02, d3 → D-03, d4 → D-04 olacak şekilde düzelt.',
    nextConcept: 'Çizelgeden yangın sınıfı yönetimi',
    primaryFields: ['mark'],
    FixType: 'door_mark',
  },
  {
    id: 'm52',
    chapter: 8,
    stepNumber: 52,
    title: 'Yangın Kapıları',
    learningConcept: 'Schedule ile toplu parametre denetimi',
    revitPath: 'Door Schedule → Fire Rating sütunu',
    learningText: 'Çizelge, aynı parametreyi tüm elemanlarda tek bakışta karşılaştırmanın en hızlı yoludur. Eksik değerler boş hücre olarak göze çarpar.',
    whyItMatters: 'Kaçış yoluna açılan kapılarda yangın sınıfı eksikliği ruhsat sürecini durdurur.',
    objective: 'Koridora açılan d1, d2 ve d3 kapılarının yangın sınıfını (Fire Rating) çizelgeden EI30 yap. Oda içi d4 kapısına dokunma.',
    nextConcept: 'Oda çizelgesi',
    primaryFields: ['fireRating'],
    FixType: 'door_fire',
  },
  {
    id: 'm53',
    chapter: 8,
    stepNumber: 53,
    title: 'Oda Çizelgesi',
    learningConcept: 'Room Schedule: Numara, Ad, Alan',
    revitPath: 'View → Create → Schedules → Schedule/Quantities → Rooms',
    learningText: 'Oda çizelgesi mahal listesini ve alanlarını verir. Numarası veya adı boş oda, çizelgede ve paftada eksik görünür.',
    whyItMatters: 'Mahal listesi mimari projenin teslim belgelerinden biridir; alanlar modelden otomatik gelir.',
    objective: 'Oda çizelgesinde iki odanın da numarasını ve adını doldur: r1 → 101 Salon, r2 → 102 Yatak Odası. Modelde uyarı kalmasın.',
    nextConcept: 'Mezuniyet: gerçek Revit',
    primaryFields: ['number', 'name'],
    FixType: 'multi_qa',
  },
];

for (const item of EXTRA_LESSONS) {
  const isAdvanced = item.chapter >= 6;
  REVIT_LESSONS_BY_ID[item.id] = {
    id: item.id,
    chapter: item.chapter,
    stepNumber: item.stepNumber,
    title: item.title,
    learningConcept: item.learningConcept,
    learningText: item.learningText,
    revitPath: item.revitPath,
    whyItMatters: item.whyItMatters,
    objective: item.objective,
    commonErrors: [
      'Parametre değişikliğini Enter tuşuyla onaylamamak',
      'İlgili eleman yerine referans elemanı düzenlemeye çalışmak',
    ],
    hintLevels: [
      `İpucu 1 (Alan): 2B Plan ve 3B Sahne üzerindeki ${item.learningConcept} durumunu gözlemle.`,
      `İpucu 2 (Nesne): Bu görevde ${item.FixType.startsWith('door') ? 'kapı (d1)' : 'duvar (w1..w4)'} elemanlarını kontrol etmelisin.`,
      `İpucu 3 (Parametre): Properties panelinde öne çıkan (${item.primaryFields.join(', ')}) alanlarını incele.`,
      `Adım Adım Rehber: 1) Sahnede hatalı/eksik elemanı tespit et. 2) Seç veya araç çubuğundan oluştur. 3) Properties panelinde ${item.primaryFields.join(' / ')} değerlerini hedef ölçüye getir. 4) Kontrol Et butonuna bas.`,
    ],
    completionExplanation: {
      whatYouDid: `${item.title} görevindeki model ve parametre gereksinimlerini başarıyla uyguladın.`,
      whyRight: `Model verisi Revit BIM standartlarıyla (%100) uyumlu hale geldi.`,
      revitCounterpart: item.revitPath,
      nextConcept: item.nextConcept,
    },
    primaryFields: item.primaryFields,
    secondaryFields: ['name', 'baseLevelId', 'thickness', 'height'],
    difficultyPhase:
      item.chapter >= 7
        ? 'final'
        : isAdvanced
        ? 'advanced'
        : 'intermediate',
  };
}

/**
 * Generates validated, playable MissionTask objects for m04..m50
 * so that all 50 missions across all 7 chapters are genuinely playable!
 */
export function buildGeneratedMissionTasks(): Record<string, MissionTask> {
  const result: Record<string, MissionTask> = {};

  const standardWalls = [
    {
      id: 'w1',
      start: [0, 0] as [number, number],
      end: [6000, 0] as [number, number],
      type: 'wall' as const,
      name: 'w_south',
      baseLevelId: 'l0',
      height: 3000,
      thickness: 200,
    },
    {
      id: 'w2',
      start: [6000, 0] as [number, number],
      end: [6000, 4000] as [number, number],
      type: 'wall' as const,
      name: 'w_east',
      baseLevelId: 'l0',
      height: 3000,
      thickness: 200,
    },
    {
      id: 'w3',
      start: [6000, 4000] as [number, number],
      end: [0, 4000] as [number, number],
      type: 'wall' as const,
      name: 'w_north',
      baseLevelId: 'l0',
      height: 3000,
      thickness: 200,
    },
    {
      id: 'w4',
      start: [0, 4000] as [number, number],
      end: [0, 0] as [number, number],
      type: 'wall' as const,
      name: 'w_west',
      baseLevelId: 'l0',
      height: 3000,
      thickness: 200,
    },
  ];

  // Build m04, m05, m06 + m07..m50
  const allSpecs: Array<{
    id: string;
    prevId: string;
    fixType:
      | 'wall_height'
      | 'wall_thickness'
      | 'wall_both'
      | 'wall_level'
      | 'room_create'
      | 'door_create'
      | 'door_host'
      | 'door_offset'
      | 'door_width'
      | 'door_sill'
      | 'door_mark'
      | 'door_fire'
      | 'multi_qa';
  }> = [
    { id: 'm04', prevId: 'm03', fixType: 'wall_thickness' },
    { id: 'm05', prevId: 'm04', fixType: 'wall_both' },
    { id: 'm06', prevId: 'm05', fixType: 'multi_qa' },
    ...EXTRA_LESSONS.map((el, idx) => ({
      id: el.id,
      prevId: idx === 0 ? 'm06' : EXTRA_LESSONS[idx - 1].id,
      fixType: el.FixType,
    })),
  ];

  for (const spec of allSpecs) {
    const meta = REVIT_LESSONS_BY_ID[spec.id];
    const clonedWalls = JSON.parse(JSON.stringify(standardWalls)) as typeof standardWalls;

    if (spec.fixType === 'wall_thickness') {
      clonedWalls[1].thickness = 100; // w2 is 100mm instead of 200mm
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 6,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: clonedWalls,
        },
        permissions: {
          editableFields: ['thickness', 'height'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['w1', 'w2', 'w3', 'w4'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_w1_t', type: 'property', elementId: 'w1', field: 'thickness', expected: 200, tolerance: 1, message: 'w1 duvar kalınlığı 200 mm olmalı.' },
          { id: 'c_w2_t', type: 'property', elementId: 'w2', field: 'thickness', expected: 200, tolerance: 1, message: 'w2 duvar kalınlığı 200 mm olmalı.' },
          { id: 'c_w3_t', type: 'property', elementId: 'w3', field: 'thickness', expected: 200, tolerance: 1, message: 'w3 duvar kalınlığı 200 mm olmalı.' },
          { id: 'c_w4_t', type: 'property', elementId: 'w4', field: 'thickness', expected: 200, tolerance: 1, message: 'w4 duvar kalınlığı 200 mm olmalı.' },
        ],
      };
    } else if (spec.fixType === 'wall_both') {
      clonedWalls[2].height = 2600;
      clonedWalls[2].thickness = 100;
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 6,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: clonedWalls,
        },
        permissions: {
          editableFields: ['height', 'thickness'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['w1', 'w2', 'w3', 'w4'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_w3_h', type: 'property', elementId: 'w3', field: 'height', expected: 3000, tolerance: 1, message: 'w3 yüksekliği 3000 mm olmalı.' },
          { id: 'c_w3_t', type: 'property', elementId: 'w3', field: 'thickness', expected: 200, tolerance: 1, message: 'w3 kalınlığı 200 mm olmalı.' },
        ],
      };
    } else if (spec.fixType === 'wall_level') {
      clonedWalls[3].baseLevelId = 'l1';
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 6,
        initialModel: {
          levels: [
            { id: 'l0', elevation: 0, name: 'Zemin Kat' },
            { id: 'l1', elevation: 3000, name: '1. Normal Kat' },
          ],
          elements: clonedWalls,
        },
        permissions: {
          editableFields: ['baseLevelId', 'height'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['w1', 'w2', 'w3', 'w4'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_w4_lvl', type: 'property', elementId: 'w4', field: 'baseLevelId', expected: 'l0', tolerance: 0, message: 'w4 duvarı Zemin Kat (l0) referansına bağlı olmalı.' },
          { id: 'c_w4_h', type: 'property', elementId: 'w4', field: 'height', expected: 3000, tolerance: 1, message: 'w4 yüksekliği 3000 mm olmalı.' },
        ],
      };
    } else if (spec.fixType === 'room_create') {
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 8,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: [],
        },
        permissions: {
          editableFields: ['height', 'thickness', 'name', 'start', 'end', 'baseLevelId'],
          creatableTypes: ['wall'],
          deletableCreated: true,
          editableSeedIds: [],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_count', type: 'count', elementType: 'wall', expected: 4, message: '4 adet duvar gerekli.' },
          { id: 'c_room', type: 'rectangle', levelId: 'l0', origin: [0, 0], width: 6000, depth: 4000, wallHeight: 3000, thickness: 200, tolerance: 1, message: '6000 × 4000 mm kapalı oda oluştur.' },
        ],
      };
    } else if (spec.fixType === 'door_create') {
      const hostWalls = [
        { id: 'w_south', start: [0, 0] as [number, number], end: [6000, 0] as [number, number], type: 'wall' as const, name: 'w_south', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_east', start: [6000, 0] as [number, number], end: [6000, 4000] as [number, number], type: 'wall' as const, name: 'w_east', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_north', start: [6000, 4000] as [number, number], end: [0, 4000] as [number, number], type: 'wall' as const, name: 'w_north', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_west', start: [0, 4000] as [number, number], end: [0, 0] as [number, number], type: 'wall' as const, name: 'w_west', baseLevelId: 'l0', height: 3000, thickness: 200 },
      ];
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 8,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: hostWalls,
        },
        permissions: {
          editableFields: ['name', 'hostWallId', 'offset', 'width', 'height', 'sill', 'mark', 'fireRating'],
          creatableTypes: ['door'],
          deletableCreated: true,
          editableSeedIds: [],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_doors', type: 'count', elementType: 'door', expected: 1, message: '1 adet kapı gerekli.' },
          { id: 'c_host', type: 'property', elementId: 'd1', field: 'hostWallId', expected: 'w_south', tolerance: 0, message: 'd1: Güney duvarına (w_south) bağlı olmalı.' },
          { id: 'c_offset', type: 'property', elementId: 'd1', field: 'offset', expected: 2550, tolerance: 1, message: 'd1: Ofset 2550 mm olmalı.' },
          { id: 'c_width', type: 'property', elementId: 'd1', field: 'width', expected: 900, tolerance: 1, message: 'd1: Genişlik 900 mm olmalı.' },
          { id: 'c_height', type: 'property', elementId: 'd1', field: 'height', expected: 2100, tolerance: 1, message: 'd1: Yükseklik 2100 mm olmalı.' },
          { id: 'c_mark', type: 'property', elementId: 'd1', field: 'mark', expected: 'D-01', tolerance: 0, message: 'd1: Poz işareti D-01 olmalı.' },
        ],
      };
    } else if (
      spec.fixType === 'door_host' ||
      spec.fixType === 'door_offset' ||
      spec.fixType === 'door_width' ||
      spec.fixType === 'door_sill' ||
      spec.fixType === 'door_mark' ||
      spec.fixType === 'door_fire'
    ) {
      const hostWalls = [
        { id: 'w_south', start: [0, 0] as [number, number], end: [6000, 0] as [number, number], type: 'wall' as const, name: 'w_south', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_east', start: [6000, 0] as [number, number], end: [6000, 4000] as [number, number], type: 'wall' as const, name: 'w_east', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_north', start: [6000, 4000] as [number, number], end: [0, 4000] as [number, number], type: 'wall' as const, name: 'w_north', baseLevelId: 'l0', height: 3000, thickness: 200 },
        { id: 'w_west', start: [0, 4000] as [number, number], end: [0, 0] as [number, number], type: 'wall' as const, name: 'w_west', baseLevelId: 'l0', height: 3000, thickness: 200 },
      ];
      const seedDoor = {
        id: 'd1',
        type: 'door' as const,
        name: 'Giriş Kapısı',
        hostWallId: spec.fixType === 'door_host' ? 'w_north' : 'w_south',
        offset: spec.fixType === 'door_offset' ? 1200 : 2550,
        width: spec.fixType === 'door_width' ? 750 : 900,
        height: 2100,
        sill: spec.fixType === 'door_sill' ? 300 : 0,
        mark: spec.fixType === 'door_mark' ? 'D-99' : 'D-01',
        fireRating: 'none' as const,
      };
      const expectedFire = spec.fixType === 'door_fire' ? 'EI30' : 'none';
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 6,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: [...hostWalls, seedDoor],
        },
        permissions: {
          editableFields: ['hostWallId', 'offset', 'width', 'height', 'sill', 'mark', 'fireRating', 'name'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['d1'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_host', type: 'property', elementId: 'd1', field: 'hostWallId', expected: 'w_south', tolerance: 0, message: 'd1: Güney duvarına (w_south) bağlı olmalı.' },
          { id: 'c_offset', type: 'property', elementId: 'd1', field: 'offset', expected: 2550, tolerance: 1, message: 'd1: Ofset 2550 mm olmalı.' },
          { id: 'c_width', type: 'property', elementId: 'd1', field: 'width', expected: 900, tolerance: 1, message: 'd1: Genişlik 900 mm olmalı.' },
          { id: 'c_sill', type: 'property', elementId: 'd1', field: 'sill', expected: 0, tolerance: 0, message: 'd1: Eşik kotu (sill) 0 mm olmalı.' },
          { id: 'c_mark', type: 'property', elementId: 'd1', field: 'mark', expected: 'D-01', tolerance: 0, message: 'd1: Poz işareti D-01 olmalı.' },
          { id: 'c_fire', type: 'property', elementId: 'd1', field: 'fireRating', expected: expectedFire, tolerance: 0, message: `d1: Yangın sınıfı ${expectedFire} olmalı.` },
        ],
      };
    } else if (spec.fixType === 'multi_qa') {
      clonedWalls[0].thickness = 100;
      clonedWalls[3].height = 2600;
      const seedDoor = {
        id: 'd1',
        type: 'door' as const,
        name: 'Giriş Kapısı',
        hostWallId: 'w1',
        offset: 2550,
        width: 750,
        height: 2100,
        sill: 0,
        mark: 'D-01',
        fireRating: 'none' as const,
      };
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 8,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: [...clonedWalls, seedDoor],
        },
        permissions: {
          editableFields: ['height', 'thickness', 'width', 'offset', 'sill', 'mark', 'fireRating'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['w1', 'w2', 'w3', 'w4', 'd1'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_w1_t', type: 'property', elementId: 'w1', field: 'thickness', expected: 200, tolerance: 1, message: 'w1 kalınlığı 200 mm olmalı.' },
          { id: 'c_w4_h', type: 'property', elementId: 'w4', field: 'height', expected: 3000, tolerance: 1, message: 'w4 yüksekliği 3000 mm olmalı.' },
          { id: 'c_d1_w', type: 'property', elementId: 'd1', field: 'width', expected: 900, tolerance: 1, message: 'd1 kapı genişliği 900 mm olmalı.' },
        ],
      };
    } else {
      // wall_height default
      clonedWalls[3].height = 2600;
      result[spec.id] = {
        schemaVersion: '1.0',
        contentVersion: '1.0.0',
        id: spec.id,
        title: meta.title,
        objective: meta.objective,
        prerequisites: [spec.prevId],
        estimatedMinutes: 6,
        initialModel: {
          levels: [{ id: 'l0', elevation: 0, name: 'Zemin Kat' }],
          elements: clonedWalls,
        },
        permissions: {
          editableFields: ['height'],
          creatableTypes: [],
          deletableCreated: false,
          editableSeedIds: ['w1', 'w2', 'w3', 'w4'],
        },
        hints: [
          { id: 'h1', text: meta.hintLevels[0] },
          { id: 'h2', text: meta.hintLevels[1] },
          { id: 'h3', text: meta.hintLevels[2] },
        ],
        recap: `${meta.completionExplanation.whatYouDid} Revit: ${meta.revitPath}`,
        criteria: [
          { id: 'c_h1', type: 'property', elementId: 'w1', field: 'height', expected: 3000, tolerance: 1, message: 'w1: height 3000 mm olmalı.' },
          { id: 'c_h2', type: 'property', elementId: 'w2', field: 'height', expected: 3000, tolerance: 1, message: 'w2: height 3000 mm olmalı.' },
          { id: 'c_h3', type: 'property', elementId: 'w3', field: 'height', expected: 3000, tolerance: 1, message: 'w3: height 3000 mm olmalı.' },
          { id: 'c_h4', type: 'property', elementId: 'w4', field: 'height', expected: 3000, tolerance: 1, message: 'w4: height 3000 mm olmalı.' },
        ],
      };
    }
  }

  // Missions that run on real BIM objects replace the number-tweaking variants.
  for (const spec of allSpecs) {
    const bim = BIM_MISSION_SPECS[spec.id];
    if (!bim) continue;
    const meta = REVIT_LESSONS_BY_ID[spec.id];
    Object.assign(meta, bim.lesson);
    result[spec.id] = buildBimMissionTask(spec.id, meta, spec.prevId);
  }

  // Bölüm 7: one continuous house project, no tool names.
  for (const spec of allSpecs) {
    if (!FINAL_STAGES[spec.id]) continue;
    const meta = REVIT_LESSONS_BY_ID[spec.id];
    Object.assign(meta, finalLessonOverrides(spec.id));
    result[spec.id] = buildFinalMissionTask(spec.id, meta, spec.prevId);
  }

  return result;
}
