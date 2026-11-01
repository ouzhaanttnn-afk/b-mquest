# BIM QUEST — Durum (`PROGRESS.md`)

Revit'i oynayarak öğreten mobil öncelikli oyun. React + TypeScript + Vite, three.js, Capacitor (iOS).
Uygulama klasörü: `app/`.

## Oyun akışı

1. **Giriş ekranı** (`TitleScreen`): logo, "Oyuna Başla / Devam Et", "Nasıl Oynanır?". Oturum başına bir kez gösterilir; logoya dokununca geri döner.
2. **Görevler ekranı** (`Dashboard`): sıradaki göreve götüren hero kartı ("Selin Mimar" notuyla), seviye çubuğu, gün serisi, başarım listesi, bölüm sekmeleri ve görev kartları.
3. **Uygulama ekranı** (`Workspace`): 2B plan + 3B sahne, Properties, araç çubuğu, Rehber Turu, koç çubuğu, Kontrol Et, değerlendirme.

## Akış (Kasım 2026)

Giriş ekranı → **Ana ekran** (`campaign/HomeScreen.tsx`): sıradaki ev (büyük kart), Evler listesi, tek bir **Görevler** kartı, Yakında evler.
Ayarlar (ses, titreşim, tema, hareketi azalt, hatırlatma, hakkında, ilerlemeyi sıfırla) ana ekranın ⋯ menüsünde.
Görevler ekranı (`ui/Dashboard.tsx`) sadeleştirildi: ← Evler, başlık, bölüm sekmeleri, kısa görev kartları (numara, yıldız, başlık, tek düğme).
XP çubuğu, hikâye metinleri, rota şeridi ve tekrar eden müfredat listesi kaldırıldı; görevlerin kendisi aynen duruyor.

## Evler

- **1. Bahçe Evi** (`house1.ts`): Level, Grid, Wall, Door/Window, Floor/Roof, Room/Tag.
- **2. İki Katlı Ev** (`house2.ts`): iki Level, Wall › Draw: Rectangle/Line, Stair (kat yüksekliğine göre basamak),
  Modify › Clipboard › Paste › Aligned to Selected Levels, merdiven boşluklu üst kat döşemesi, View › Create › Section (sonuç kartında kesit çizimi),
  kat planı geçişi (Zemin Kat / 1. Kat), çatı.
- **3. Teslim** (`house3.ts`, Bahçe Evi'nin bitmiş modeliyle başlar): Annotate › Dimension › Aligned (DI), Tag by Category ile kapı/pencere etiketi,
  View › Create › Elevation (kuzey/güney, sonuç kartında cephe çizimi), Section, View › Sheet Composition › Sheet ve View (A3 pafta, sonuç kartında pafta).
- **4. İkiz Ev** (`house4.ts`): yarım ev (dikdörtgen duvar + kapı), Modify › Mirror - Pick Axis (MM) ile ortak duvardan aynalama, döşeme ve çatı, iki daire (Room + Tag + ad).
- Yakında: Hata Avı (model kontrolü).
- Ortak yapı `model.ts` (komut şeridi, LevelDef/HouseDef), kurallar `engine.ts`, liste `houses.ts`. Bir ev, öncekinin her bölümü bitince açılır.

## Yeni çekirdek: ev ev kampanya (prototip)

İlk ev **Bahçe Evi** (`app/src/campaign/`): 10 × 7 m, tek katlı, iki oda; 6 kısa bölüm.
Ana ekranın en üstündeki turuncu kartla açılır. Eski 65 görev olduğu gibi duruyor.

| Bölüm | Komut (Revit yolu, kısayol) | Hedef |
|---|---|---|
| 1 Katlar | Architecture › Datum › Level (LL) | Görünüşte çatı seviyesini +3,00 m'ye koy |
| 2 Akslar | Architecture › Datum › Grid (GR) | A, B, 1, 2 akslarını çiz |
| 3 Duvarlar | Architecture › Build › Wall (WA) | Dış duvarlar + iç duvar (70 m², 2 oda) |
| 4 Kapı ve pencereler | Door (DR), Window (WN) | Ön duvara kapı, arka duvara 2 pencere |
| 5 Döşeme ve çatı | Floor (SB), Roof › Roof by Footprint | Evin içine dokun |
| 6 Odalar | Room (RM), Annotate › Tag › Tag by Category (TG) | Odaları tanı, etiketle, adlandır |

- Oynanış: şeritten komut seç → kesik çizgili hedefe dokun (1 m'ye yapışır). Adım başında parmak gösterimi (Atla/İzle).
  Yanlış komut ★★'yi götürür; iki yanlıştan sonra doğru komut parlar. Yıldız: ★ bitir · ★★ yanlış komut yok · ★★★ hamle sınırında.
- Bölüm sonu: yıldızlar + "Revit'te bu" (menü yolu, kısayol, AutoCAD köprüsü). Ev bitince 9 komutun listesi ve 3B ev.
- Kurallar `engine.ts`/`house1.ts` saf fonksiyonlar; ekran yalnız çizer. Yıldızlar `bimquest.campaign.v1` anahtarında.
- Dil: tüm metinler `i18n.ts` + bölüm tanımlarındaki `{ tr, en? }` alanlarında; İngilizce için `en` doldurulup `L` değiştirilecek.
- Ses: yalnız efekt (seç, yapış, kur, hata, başarı, yıldız). Müzik yok.
- Düzen: tablet yatay öncelikli (şerit üstte, 3B önizleme yanda); telefonda şerit başparmağın altında, 3B önizleme çizimin altında.
- Testler: `tests/campaign.test.ts` (kurallar, 6 bölüm dokunarak), `tests/campaign.spec.ts` (tablet + telefon baştan sona, yanlış komut).

## Müfredat: 11 bölüm, 65 görev

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
| 11 (bonus) | 62–65 | Kural tabanlı denetim (merdiven, yatak odası, gün ışığı), normalleştirme, sahadan modele (as-built) |

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

- Sade arayüz ilkesi: ekranda yalnızca o görevin gerektirdiği araçlar; gerisi “⋯” menüsünde (çalışma ekranı ve Görevler ekranı).
- Seçili nesnenin ilişkileri tek satırda (Kat · Host · Taşıdığı · Sınır · Alan).
- Sözlükte BIM kavramları (IFC, LOD, ISO 19650, açık/örtük bilgi, normalleştirme, anlamsal zenginleştirme, dijital ikiz…). Arka plan: Sacks, Girolami ve Brilakis (2020); metin bizim, alıntı yok.
- Bölüm 11’deki sınır değerler öğretim amaçlıdır; gerçek projede yürürlükteki yönetmelik kullanılmalıdır.

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
