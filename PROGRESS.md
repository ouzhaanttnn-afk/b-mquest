# BIM QUEST — Durum (`PROGRESS.md`)

Revit'i oynayarak öğreten mobil öncelikli oyun. React + TypeScript + Vite, three.js, Capacitor (iOS).
Uygulama klasörü: `app/`.

## Oyun akışı

1. **Giriş ekranı** (`TitleScreen`): logo, "Oyuna Başla / Devam Et", "Nasıl Oynanır?". Oturum başına bir kez gösterilir; logoya dokununca geri döner.
2. **Görevler ekranı** (`Dashboard`): sıradaki göreve götüren hero kartı ("Selin Mimar" notuyla), seviye çubuğu, gün serisi, başarım listesi, bölüm sekmeleri ve görev kartları.
3. **Uygulama ekranı** (`Workspace`): 2B plan + 3B sahne, Properties, araç çubuğu, Rehber Turu, koç çubuğu, Kontrol Et, değerlendirme.

## Müfredat: 10 bölüm, 61 görev

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
| 9 (bonus) | 54–58 | Modify araçları: Copy, Mirror, Offset, Align |
| 10 (bonus) | 59–61 | Tip çoğaltma (Duplicate), kata kopyala, üst kat döşemesi ve merdiven |

## Oyun hissi katmanı

- Hikâye çerçevesi: `src/content/story.ts` (Kadıköy Konutu projesi, bölüm başına mentor notu).
- Seri, başarımlar ve seviye ilerlemesi: `src/domain/gameMeta.ts` (kayıt dosyasından ayrı, `bimquest.meta.v1`; başarımlar `completed` verisinden türetilir).
- Görev bitişinde konfeti ve fanfar, yeni başarımda bildirim.
- Revit klavye kısayolları (iki harf, art arda): WA duvar, DR kapı, WN pencere, SB döşeme, RF çatı, RM oda, ST merdiven, GR aks, DI ölçü, TG etiket. Görev o aracı izin veriyorsa çalışır.
- Çizelge ekranı (`SchedulesSheet`): hücre düzenlemek modeldeki nesneyi değiştirir.
- Modify paneli (`ModifySheet`, `domain/modifyOps.ts`): Kopyala, Aynala, Öteleme, Hizala. Duvara bağlı kapı/pencere kopyayla birlikte yeni duvara bağlanır.
- Görünürlük (`VisibilitySheet`, `domain/viewFilter.ts`): kategorileri plan ve 3B'de aç/kapat; yalnızca görüntüyü etkiler, değerlendirme etkilenmez.
- İstatistiklerim (Veri & Ayarlar): toplam kontrol, ilk bakışta başarı oranı, en çok uğraşılan görev. Yalnızca bu cihazda tutulur, hiçbir yere gönderilmez.

- Serbest Atölye (`content/workshop.ts`): görevsiz, tüm araçlar açık; m02 sonrası açılır. Model `bimquest.workshop.v1` anahtarında ayrı saklanır, görev kayıt dosyasına karışmaz.
- Cihaz özellikleri (`native/native.ts`): dokunsal geri bildirim (Capacitor Haptics; iPhone'da `navigator.vibrate` çalışmadığı için), isteğe bağlı günlük hatırlatma (yerel bildirim), sertifika paylaşımı (paylaşım sayfası). Web'de sessizce yedeğe düşer.
- Hakkında & Gizlilik ekranı, gizlilik manifestosu (`PrivacyInfo.xcprivacy`).
- Yön okları ekran yönünü izler (↑ yukarı = −Z). Kuzey oku, görev verisindeki gerçek kuzeye (+Z, aşağı) bakacak şekilde düzeltildi.
- iPad dikey modunda plan ve 3B alt alta; dar panelde 3B kamera geri çekilir.

- Telefon ve tablet: çalışma ekranı tek ekran (sayfa kaymaz), paneller alt sayfa, "Kontrol et" yüzen düğme; pencereler telefonda alttan açılır ve arkadaki sayfa kilitlenir.

## Teknik

- 3B sahne `React.lazy` ile ayrıldı; ana paket ~1,7 MB → ~0,74 MB.
- `npm test` artık tüm vitest dosyalarını çalıştırır.

## Test

```bash
cd app
npx tsc -b
npm test            # vitest
npm run build
npm run test:e2e    # Playwright
```

Bilinen: `bim-docs` (m36/m37) ve `bim-final` (m50) e2e testleri PNG indirme dosya adını denetliyor; bazı Chromium sürümlerinde ad `download` geliyor ve bu iki test başarısız oluyor (oyun koduyla ilgili değil).

## Henüz yok

- Trim ve Array araçları; Modify araçları şimdilik yalnızca duvarlarda çalışır.
- Tam Family editörü (şekil/parametre tanımlama) ve malzemeler; şimdilik yalnızca tip çoğaltma ve tip parametresi düzenleme var.
- Kalan eski görevlerin (m04–m08, m11, m13–m16, m23, m26–m29) bir kısmı ortak şablon duvar/kapı seti kullanır.
- Bulut kaydı ve hesap; uzaktan analitik (şimdiki istatistikler yerel).

## Bilinen kayıt kuralı

Kayıt şeması `m01`–`m99` kimliklerini kabul eder (`MISSION_ID_PATTERN`). Yeni görev eklerken `tests/game-meta.test.ts` içindeki kayıt turu testi bunu doğrular.
