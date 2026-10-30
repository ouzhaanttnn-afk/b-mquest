/**
 * Narrative frame: the player is a junior BIM modeller at Selin Arkitektür and
 * works on one house project from empty site to delivered drawing set.
 */

export const STORY_PROJECT = 'Kadıköy Konutu · 70 m² tek katlı ev';
export const STORY_MENTOR = 'Selin Mimar';

export const CHAPTER_STORIES: Record<string, string> = {
  ch01:
    'İlk gün! Proje dosyasını açıyoruz. Önce modeli okumayı, nesne seçmeyi ve Properties paletini tanıman lazım.',
  ch02:
    'Müşteri kat yüksekliklerini değiştirmek istiyor. Level ve Grid düzenli kurulmazsa her değişiklik felaket olur.',
  ch03:
    'Şimdi evi gerçekten kuruyoruz: duvarlar, kapılar, pencereler, döşeme, çatı, merdiven ve odalar.',
  ch04:
    'Metraj çıkacak. Kapı tipleri, poz numaraları ve oda bilgileri tutarlı olmalı, yoksa şantiye şaşırır.',
  ch05:
    'Şantiyeye model değil pafta gider. Kesit, görünüş, ölçü, etiket ve sheet hazırlama zamanı.',
  ch06:
    'Teslimden önce model denetimi: gizli hataları bul. Revit uyarıları seni kurtarmaz, sen kendini kurtar.',
  ch08:
    'Proje teslim edildi ama şantiye şefi bir kapı listesi ve mahal listesi istiyor. Çizelgeler tam bunun için.',
  ch09:
    'Selin Mimar: “Bir şey daha: usta modelleyici çizmez, çoğaltır. Copy, Mirror, Offset ve Align ile hız kazan.”',
  ch07:
    'Final: boş projeden başlayıp eksiksiz bir proje teslim ediyorsun. Bu kez yol tarifi yok.',
};

export const MENTOR_LINES = {
  start: 'Hazırsan başlayalım.',
  return: 'Hoş geldin! Kaldığımız yerden devam edelim.',
  done: 'Harika iş! Tüm görevleri bitirdin; artık gerçek Revit seni bekliyor.',
};
