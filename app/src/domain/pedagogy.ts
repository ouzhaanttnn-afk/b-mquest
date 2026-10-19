import type {
  BimModel,
  CriterionEvidence,
  MissionTask,
  SubmittedEvaluation,
  WallElement,
} from './types';
import { REVIT_LESSONS_BY_ID, type RevitLessonMeta } from '../content/revitLessons';

function sameSegment(
  w: WallElement,
  a: [number, number],
  b: [number, number],
  tol: number
): boolean {
  const nearPt = (p1: [number, number], p2: [number, number]) =>
    Math.abs(p1[0] - p2[0]) <= tol && Math.abs(p1[1] - p2[1]) <= tol;
  return (
    (nearPt(w.start, a) && nearPt(w.end, b)) ||
    (nearPt(w.end, a) && nearPt(w.start, b))
  );
}

export interface LearningConceptInfo {
  learningConcept: string;
  whatIsIt: string;
  whyUsed: string;
  actionSummary: string;
  revitPath: string;
  hintLevels: [string, string, string, string];
  completionExplanation: {
    whatYouDid: string;
    whyItIsRight: string;
    revitCounterpart: string;
    nextConcept: string;
  };
  primaryFields: string[];
  secondaryFields: string[];
  difficultyPhase: RevitLessonMeta['difficultyPhase'];
}

export function getMissionLearningGuide(task: MissionTask): LearningConceptInfo {
  const meta = REVIT_LESSONS_BY_ID[task.id];
  if (meta) {
    return {
      learningConcept: meta.learningConcept,
      whatIsIt: meta.learningText,
      whyUsed: meta.whyItMatters,
      actionSummary: meta.objective,
      revitPath: meta.revitPath,
      hintLevels: meta.hintLevels,
      completionExplanation: {
        whatYouDid: meta.completionExplanation.whatYouDid,
        whyItIsRight: meta.completionExplanation.whyRight,
        revitCounterpart: meta.completionExplanation.revitCounterpart,
        nextConcept: meta.completionExplanation.nextConcept,
      },
      primaryFields: meta.primaryFields,
      secondaryFields: meta.secondaryFields,
      difficultyPhase: meta.difficultyPhase,
    };
  }

  return {
    learningConcept: task.title,
    whatIsIt: `${task.title} kapsamında BIM elemanlarının parametrik özelliklerini ve birbirleriyle olan topolojik ilişkilerini yapılandırıyoruz.`,
    whyUsed:
      'Gerçek yapı bilgi modellemesinde her nesne merkezi veritabanında doğrulanabilir kurallara bağlıdır; böylece çizim ve metraj hataları uygulama öncesinde yakalanır.',
    actionSummary: task.objective,
    revitPath: 'Revit: Select Element → Properties Palette → Constraints / Dimensions',
    hintLevels: [
      task.hints[0]?.text ?? 'Sahnedeki elemanların konumunu kontrol et.',
      task.hints[1]?.text ?? 'İlgili nesneyi seçip Properties panelini aç.',
      task.hints[2]?.text ?? 'Parametre değerini hedef ölçüyle eşitle.',
      'Rehber: Nesneyi seç → Properties panelinden hedef değeri gir → Kontrol Et butonuna bas.',
    ],
    completionExplanation: {
      whatYouDid: task.recap,
      whyItIsRight: 'Model verisi ve 3B geometri tam tutarlılığa ulaştı.',
      revitCounterpart: 'Revit: Modify → Properties Palette',
      nextConcept: 'Sonraki BIM Görevi',
    },
    primaryFields: task.permissions.editableFields.slice(0, 2),
    secondaryFields: task.permissions.editableFields.slice(2),
    difficultyPhase: 'intermediate',
  };
}

export interface PedagogicalStepState {
  stepNumber: 1 | 2 | 3 | 4 | 5;
  label: string;
  description: string;
  status: 'completed' | 'active' | 'pending';
}

export function getPedagogicalFlowSteps(
  revision: number,
  lastEvaluation: SubmittedEvaluation | null
): PedagogicalStepState[] {
  const hasEdited = revision > 0;
  const hasChecked = lastEvaluation !== null;
  const isFreshEval = lastEvaluation !== null && !lastEvaluation.stale;
  const isPassed = isFreshEval && lastEvaluation.pass;
  const isFailed = isFreshEval && !lastEvaluation.pass;

  return [
    {
      stepNumber: 1,
      label: '1. Öğren',
      description: 'Kavramın ne olduğunu ve Revit karşılığını incele',
      status: hasEdited || hasChecked ? 'completed' : 'active',
    },
    {
      stepNumber: 2,
      label: '2. Uygula',
      description: '2B Plan, 3B Sahne ve Properties paneliyle modeli düzenle',
      status: isPassed
        ? 'completed'
        : hasEdited && !isFreshEval
        ? 'active'
        : hasEdited
        ? 'completed'
        : 'pending',
    },
    {
      stepNumber: 3,
      label: '3. Kontrol Et',
      description: 'Model durumunu gerçek BIM kurallarıyla analiz et',
      status: isFreshEval ? 'completed' : hasEdited ? 'active' : 'pending',
    },
    {
      stepNumber: 4,
      label: '4. Geri Bildirim',
      description: 'Hata teşhisini ve Revit yönlendirmesini incele',
      status: isPassed
        ? 'completed'
        : isFailed
        ? 'active'
        : 'pending',
    },
    {
      stepNumber: 5,
      label: '5. Değerlendir & XP',
      description: 'Ne yaptığını gör, XP/rozet kazan ve sonraki kavrama geç',
      status: isPassed ? 'active' : 'pending',
    },
  ];
}

export function calculateMissionXp(score: number): number {
  return Math.max(0, Math.round(score * 2));
}

export function calculateTotalPlayerXp(
  completed: Record<string, { bestScore: number }>
): { totalXp: number; level: number; rankTitle: string; nextLevelXp: number } {
  const totalXp = Object.values(completed).reduce(
    (sum, item) => sum + calculateMissionXp(item.bestScore),
    0
  );
  const level = Math.floor(totalXp / 200) + 1;
  const nextLevelXp = level * 200;

  let rankTitle = 'Aday BIM Modellemeci';
  if (totalXp >= 3000) rankTitle = 'Baş BIM Mimarı (Master)';
  else if (totalXp >= 1500) rankTitle = 'BIM Proje Yöneticisi';
  else if (totalXp >= 500) rankTitle = 'Kıdemli BIM Koordinatörü';
  else if (totalXp >= 350) rankTitle = 'BIM Uygulama Uzmanı';
  else if (totalXp >= 150) rankTitle = 'Junior BIM Mimarı';

  return { totalXp, level, rankTitle, nextLevelXp };
}

/**
 * Generates an actionable, educational Turkish diagnostic explanation for any failed criterion.
 * Explains BOTH why the current state is wrong AND gives a concise Revit-oriented direction without spoiling everything.
 */
export function explainCriterionFailureTr(
  task: MissionTask,
  model: BimModel,
  ev: CriterionEvidence
): string {
  if (ev.pass) {
    return 'Doğrulandı: Bu kural model verileriyle tam uyumlu.';
  }

  const rule = task.criteria.find((c) => c.id === ev.id);
  if (!rule) {
    return 'Kural doğrulanamadı; lütfen görev hedeflerini kontrol edin.';
  }

  if (rule.type === 'property') {
    const el = model.elements.find((e) => e.id === rule.elementId);
    if (!el) {
      const isDoor = rule.elementId.startsWith('d');
      return isDoor
        ? `Neden Yanlış: Modelde "${rule.elementId}" kapı/açıklık elemanı henüz yerleştirilmemiş. Nasıl Düzeltilir: Architecture → Door (Kapı Oluştur) aracını aç, Host duvarı seç ve elemanı modele yerleştir.`
        : `Neden Yanlış: Modelde "${rule.elementId}" duvar elemanı bulunamadı. Nasıl Düzeltilir: Architecture → Wall (Duvar Oluştur) aracıyla eksik duvarı ekle.`;
    }

    if (rule.field === 'hostWallId') {
      const expectedWall = model.elements.find(
        (e): e is WallElement => e.type === 'wall' && e.id === String(rule.expected)
      );
      const actualWall = model.elements.find(
        (e): e is WallElement => e.type === 'wall' && e.id === String(ev.actual)
      );
      const expectedLabel = expectedWall
        ? `${expectedWall.id} (${expectedWall.name})`
        : String(rule.expected);
      const actualLabel = actualWall
        ? `${actualWall.id} (${actualWall.name})`
        : String(ev.actual ?? 'Yok');

      return `Neden Yanlış: Doğru kapıyı (${rule.elementId}) oluşturdun ancak yanlış host’a (${actualLabel}) yerleştirdin; mimari projede "${expectedLabel}" duvarına bağlanması gerekiyor. Nasıl Düzeltilir: Kapıyı seç → Properties → Host Wall (hostWallId) değerini "${expectedLabel}" olarak kontrol et.`;
    }

    if (rule.field === 'height') {
      return `Neden Yanlış: ${rule.elementId} elemanı hâlâ ${ev.actual} mm yüksekliğinde. Hedef kot (${rule.expected} mm) ile eşleşmediği için üst kotlar hizalanmıyor. Nasıl Düzeltilir: Elemanı seç → Properties → Constraints → Height değerini kontrol et.`;
    }

    if (rule.field === 'thickness') {
      return `Neden Yanlış: ${rule.elementId} duvarının kalınlığı şu anda ${ev.actual} mm; bu duvar tipinde beklenen kalınlık ${rule.expected} mm. Nasıl Düzeltilir: Duvarı seç → Properties → Edit Type → Thickness (Kalınlık) değerini kontrol et.`;
    }

    if (rule.field === 'baseLevelId') {
      return `Neden Yanlış: ${rule.elementId} duvarı yanlış kata (${ev.actual}) bağlanmış; doğru Base Constraint "${rule.expected}" olmalıdır. Nasıl Düzeltilir: Duvarı seç → Properties → Constraints → Base Constraint (Kat) seçimini kontrol et.`;
    }

    if (rule.field === 'offset') {
      return `Neden Yanlış: ${rule.elementId} açıklığının duvar başlangıcından mesafesi (Offset) şu anda ${ev.actual} mm; geçici ölçü (Temporary Dimension) hedefi ${rule.expected} mm olmalıdır. Nasıl Düzeltilir: Elemanı seç → Properties → Offset (mm) değerini kontrol et.`;
    }

    if (rule.field === 'width') {
      return `Neden Yanlış: ${rule.elementId} açıklığının genişliği (Width) şu anda ${ev.actual} mm; proje tip standardı ${rule.expected} mm bekliyor. Nasıl Düzeltilir: Elemanı seç → Properties → Dimensions → Width değerini kontrol et.`;
    }

    if (rule.field === 'sill') {
      return `Neden Yanlış: ${rule.elementId} elemanının eşik/parapet kotu (Sill Height) ${ev.actual} mm; döşeme/cephe standardına göre ${rule.expected} mm olmalıdır. Nasıl Düzeltilir: Elemanı seç → Properties → Constraints → Sill Height değerini kontrol et.`;
    }

    if (rule.field === 'mark') {
      return `Neden Yanlış: ${rule.elementId} elemanının poz/etiket numarası (Mark) "${ev.actual}" girilmiş; metraj ve pafta standardı "${rule.expected}" bekliyor. Nasıl Düzeltilir: Elemanı seç → Properties → Identity Data → Mark alanını kontrol et.`;
    }

    if (rule.field === 'fireRating') {
      return `Neden Yanlış: ${rule.elementId} elemanının yangın dayanım sınıfı (Fire Rating) "${ev.actual}" seçilmiş; yangın senaryosu "${rule.expected}" gerektiriyor. Nasıl Düzeltilir: Elemanı seç → Properties → Identity Data → Fire Rating değerini kontrol et.`;
    }

    return `Neden Yanlış: "${rule.elementId}" nesnesinin "${rule.field}" parametresi beklenen değerle (${rule.expected}) eşleşmiyor (Mevcut: ${ev.actual}). Nasıl Düzeltilir: Nesneyi seç → Properties panelinden ilgili parametreyi kontrol et.`;
  }

  if (rule.type === 'count') {
    const typeTr = rule.elementType === 'wall' ? 'duvar (Wall)' : 'kapı/açıklık (Door/Opening)';
    const currentCount = Number(ev.actual ?? 0);
    const targetCount = rule.expected;
    if (currentCount < targetCount) {
      return `Neden Yanlış: Modelde şu anda ${currentCount} adet ${typeTr} var, ancak proje tam olarak ${targetCount} adet gerektiriyor. Nasıl Düzeltilir: Architecture sekmesinden "${rule.elementType === 'wall' ? 'Duvar Oluştur' : 'Kapı Oluştur'}" aracını kullanarak eksik ${targetCount - currentCount} elemanı yerleştir.`;
    }
    return `Neden Yanlış: Modelde şu anda ${currentCount} adet ${typeTr} bulunuyor (Hedef: ${targetCount}). Fazladan eklenen ${currentCount - targetCount} eleman Room Boundary / model topolojisini bozuyor. Nasıl Düzeltilir: Fazla elemanı seç → Modify → Delete (Sil) komutuyla kaldır.`;
  }

  if (rule.type === 'rectangle') {
    const walls = model.elements.filter((e): e is WallElement => e.type === 'wall');
    const [ox, oz] = rule.origin;
    const x2 = ox + rule.width;
    const z2 = oz + rule.depth;
    const tol = rule.tolerance ?? 10;

    const requiredEdges: Array<{ name: string; a: [number, number]; b: [number, number] }> = [
      { name: `Güney Kenarı (${ox},${oz} → ${x2},${oz})`, a: [ox, oz], b: [x2, oz] },
      { name: `Doğu Kenarı (${x2},${oz} → ${x2},${z2})`, a: [x2, oz], b: [x2, z2] },
      { name: `Kuzey Kenarı (${x2},${z2} → ${ox},${z2})`, a: [x2, z2], b: [ox, z2] },
      { name: `Batı Kenarı (${ox},${z2} → ${ox},${oz})`, a: [ox, z2], b: [ox, oz] },
    ];

    const missingEdges = requiredEdges.filter(
      (edge) => !walls.some((w) => sameSegment(w, edge.a, edge.b, tol))
    );

    const wrongHeightWall = walls.find(
      (w) => Math.abs(w.height - rule.wallHeight) > tol
    );
    const wrongThicknessWall = walls.find(
      (w) => Math.abs(w.thickness - rule.thickness) > tol
    );
    const wrongLevelWall = walls.find((w) => w.baseLevelId !== rule.levelId);

    const issues: string[] = [];
    if (walls.length < 4) {
      issues.push(`Room Boundary açık: modelde 4 yerine ${walls.length} duvar bulunuyor`);
    }
    if (missingEdges.length > 0) {
      issues.push(
        `Açık veya aksı kaymış kenarlar: ${missingEdges.map((e) => e.name).join(', ')}`
      );
    }
    if (wrongHeightWall) {
      issues.push(
        `${wrongHeightWall.id} duvarının yüksekliği ${wrongHeightWall.height} mm (Hedef: ${rule.wallHeight} mm)`
      );
    }
    if (wrongThicknessWall) {
      issues.push(
        `${wrongThicknessWall.id} duvarının kalınlığı ${wrongThicknessWall.thickness} mm (Hedef: ${rule.thickness} mm)`
      );
    }
    if (wrongLevelWall) {
      issues.push(
        `${wrongLevelWall.id} duvarı ${rule.levelId} katına bağlı değil`
      );
    }

    return `Neden Yanlış: ${
      issues.length > 0
        ? issues.join('; ')
        : 'Duvarlar kesintisiz kapalı oda sınırını (Room Bounding) oluşturmuyor'
    }. Nasıl Düzeltilir: 2B Planda açık kalan kenarı kontrol et → Architecture → Wall (Duvar Oluştur) veya Properties panelinden köşe koordinatlarını (${rule.width}×${rule.depth} mm, Height:${rule.wallHeight}, Thickness:${rule.thickness}) hizala.`;
  }

  return 'Lütfen ilgili nesneyi seçip Properties panelinden hedef ölçülerle karşılaştırın.';
}
