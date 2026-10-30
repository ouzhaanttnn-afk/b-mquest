# BIM QUEST — Durum (`PROGRESS.md`)

Revit'i oynayarak öğreten mobil öncelikli oyun. React + TypeScript + Vite, three.js, Capacitor (iOS).
Uygulama klasörü: `app/`.

## Oyun akışı

1. **Giriş ekranı** (`TitleScreen`): logo, "Oyuna Başla / Devam Et", "Nasıl Oynanır?". Oturum başına bir kez gösterilir; logoya dokununca geri döner.
2. **Görevler ekranı** (`Dashboard`): sıradaki göreve götüren hero kartı ("Selin Mimar" notuyla), seviye çubuğu, gün serisi, başarım listesi, bölüm sekmeleri ve görev kartları.
3. **Uygulama ekranı** (`Workspace`): 2B plan + 3B sahne, Properties, araç çubuğu, Rehber Turu, koç çubuğu, Kontrol Et, değerlendirme.

## Müfredat: 8 bölüm, 53 görev

| Bölüm | Görevler | Konu |
|---|---|---|
| 1 | 01–06 | Revit & BIM temelleri |
| 2 | 07–12 | Level, Grid |
| 3 | 13–22 | Temel mimari modelleme |
| 4 | 23–29 | BIM bilgisi ve parametreler |
| 5 | 30–37 | View, Section, Elevation, Sheet |
| 6 | 38–43 | Model kontrolü |
| 7 | 44–50 | Final proje (konut teslimi) |
| 8 (bonus) | 51–53 | Çizelgeler (Schedules): kapı, yangın sınıfı, oda |

## Oyun hissi katmanı

- Hikâye çerçevesi: `src/content/story.ts` (Kadıköy Konutu projesi, bölüm başına mentor notu).
- Seri, başarımlar ve seviye ilerlemesi: `src/domain/gameMeta.ts` (kayıt dosyasından ayrı, `bimquest.meta.v1`; başarımlar `completed` verisinden türetilir).
- Görev bitişinde konfeti ve fanfar, yeni başarımda bildirim.
- Revit klavye kısayolları (iki harf, art arda): WA duvar, DR kapı, WN pencere, SB döşeme, RF çatı, RM oda, ST merdiven, GR aks, DI ölçü, TG etiket. Görev o aracı izin veriyorsa çalışır.
- Çizelge ekranı (`SchedulesSheet`): hücre düzenlemek modeldeki nesneyi değiştirir.

## Teknik

- 3B sahne `React.lazy` ile ayrıldı; ana paket ~1,7 MB → ~0,74 MB.
- `npm test` artık tüm vitest dosyalarını çalıştırır.

## Test

```bash
cd app
npx tsc -b
npm test            # vitest, 122 test
npm run build
npm run test:e2e    # Playwright
```

Bilinen: `bim-docs` (m36/m37) ve `bim-final` (m50) e2e testleri PNG indirme dosya adını denetliyor; bazı Chromium sürümlerinde ad `download` geliyor ve bu iki test başarısız oluyor (oyun koduyla ilgili değil).

## Henüz yok

- Modify araçları (Move, Copy, Mirror, Align, Trim, Offset).
- Family editörü, Visibility/Graphics, malzemeler.
- Kalan eski görevlerin (m04–m08, m11, m13–m16, m23, m26–m29) bir kısmı ortak şablon duvar/kapı seti kullanır.
- Analitik ve bulut kaydı.
