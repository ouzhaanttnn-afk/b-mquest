/**
 * Campaign text lives in one place so a second language is one file away.
 * Turkish is complete; any missing translation falls back to Turkish.
 */

export type Locale = 'tr' | 'en';

export interface Text {
  tr: string;
  en?: string;
}

export const tx = (text: Text, locale: Locale): string =>
  (locale === 'en' && text.en) || text.tr;

export const UI = {
  back: { tr: '← Çıkış' },
  why: { tr: 'Neden?' },
  undo: { tr: 'Geri al' },
  moves: { tr: 'Hamle' },
  ribbon: { tr: 'Revit şeridi' },
  architecture: { tr: 'Architecture' },
  annotate: { tr: 'Annotate' },
  preview3d: { tr: '3B' },
  close: { tr: 'Kapat' },
  pickCommand: { tr: 'Önce şeritten doğru komutu seç.' },
  wrongCommand: { tr: 'Bu değil. Doğru komutu ara.' },
  wrongCommandHint: { tr: 'İpucu: doğru komut parlıyor.' },
  levelDone: { tr: 'Bölüm tamam!' },
  inRevit: { tr: "Revit'te bu" },
  shortcut: { tr: 'Kısayol' },
  next: { tr: 'Sonraki bölüm' },
  replay: { tr: 'Tekrar oyna' },
  houseDone: { tr: 'tamamlandı!' },
  view: { tr: 'View' },
  modify: { tr: 'Modify' },
  floorPlan: { tr: 'Kat planı' },
  elevationView: { tr: 'Görünüş: Güney' },
  pasteTitle: { tr: 'Hangi kata yapıştırılsın? (Select Levels)' },
  sheetTitle: { tr: 'Pafta boyutu (Title block)' },
  placeTitle: { tr: 'Hangi görünüm paftaya? (Views)' },
  houseDoneSub: { tr: "Bu komutlarla Revit'te aynı evi kurabilirsin:" },
  backToHub: { tr: 'Ana ekrana dön' },
  skipDemo: { tr: 'Atla' },
  watch: { tr: 'İzle' },
  nameRoom: { tr: 'Bu odanın adı ne?' },
  locked: { tr: 'Kilitli: önceki bölümü bitir.' },
  level: { tr: 'Bölüm' },
  starsInfo: { tr: '★ bitir · ★★ hiç yanlış komut yok · ★★★ hamle sınırında' },
  step: { tr: 'Adım' },
  play: { tr: 'Oyna' },
  open3d: { tr: '3B görünümü büyüt' },
  stars: { tr: 'Yıldız' },
  seeHouse: { tr: 'Evi gör' },
  whyTitle: { tr: 'Neden böyle?' },
  fromAutocad: { tr: "AutoCAD'den geliyorsan" },
  namePickHint: { tr: 'Doğru adı seç; yanlış seçersen odaya tekrar dokun.' },
} satisfies Record<string, Text>;
