# BIM QUEST — Geliştirme Planı (40 → 85)

> Bu dosya, BIM QUEST'i bir sonraki seviyeye taşımak için yeni bir yapay zekâ oturumuna (Claude vb.) verilecek **başlangıç brifidir**.
> Önce bu dosyayı baştan sona oku, sonra **Faz 1**'den başla. Fazları sırayla uygula; her faz bitince test et ve commit at.

---

## 0. Ürün Tanımı (değişmeyecek)

BIM QUEST, **Revit'i oynayarak öğreten** mobil öncelikli bir oyundur. Quiz ya da video kurs değildir.
Oyuncu oyunun sonunda gerçek Revit'i açtığında Level/Grid, Wall/Door/Window/Floor/Roof/Stair, Properties, Type/Instance, host ilişkileri, View/Section/Elevation, Dimension/Tag/Room, Sheet ve model kontrolü mantığını tanımalıdır.

**Korunacak olanlar:**
- Koyu BIMQuest görsel dili (light mode da var), mobil dikey yapı
- 2D plan + 3D sahne, nesne seçme, property düzenleme
- Görev akışı: **1. Öğren → 2. Uygula → 3. Kontrol Et → 4. Geri Bildirim → 5. Değerlendir & XP**
- XP, yıldız ve rozet sistemi, Rehber Turu (kademeli ipucu)
- Mevcut 50 görev ve 7 bölüm (silinmeyecek, **gerçek mekaniklere bağlanacak**)

---

## 1. Mevcut Durum — Dürüst Değerlendirme: ~40/100

### Teknik yapı
| Konu | Detay |
|---|---|
| Stack | React + TypeScript + Vite, three.js (react-three-fiber), Capacitor 8 (iOS) |
| Uygulama klasörü | `app/` |
| Test | `npx vitest run` (domain testleri), `npx playwright test` (E2E) |
| iOS CI | `.github/workflows/ios-testflight.yml` → `main`'e her push TestFlight'a yeni build yükler (`macos-26`, Node 22) |
| Bundle ID | `com.bimquest.studio` |

### Ana dosyalar
| Dosya | Satır | Görev |
|---|---|---|
| `app/src/ui/Workspace.tsx` | ~2880 | Görev ekranı, property paneli, akış. **Çok büyük, bölünmeli** |
| `app/src/content/revitLessons.ts` | ~1300 | 50 görevin ders metinleri, Revit yolları, ipuçları |
| `app/src/content/curriculum.ts` | ~140 | 7 bölüm tanımı |
| `app/src/content/content.ts` | ~80 | İçerik yükleyici |
| `app/src/domain/types.ts` | ~170 | **BIM veri modeli** (darboğaz burada) |
| `app/src/domain/commands.ts` | ~1000 | Model komutları (oluştur, düzenle, sil, undo) |
| `app/src/domain/evaluator.ts` | ~325 | Görev doğrulama |
| `app/src/domain/pedagogy.ts` | ~320 | Geri bildirim ve ipucu mantığı |
| `app/src/domain/persistence.ts` | ~390 | Kayıt (SaveEnvelopeV1) |
| `app/src/plan/PlanViewport.tsx` | ~930 | 2D plan (SVG) |
| `app/src/scene/SceneViewport.tsx` | ~670 | 3D sahne |
| `app/src/plan/geometry.ts` | ~240 | Geometri yardımcıları |

### Puan tablosu
| Alan | Puan | Not |
|---|---|---|
| Teknik altyapı (React, 3D, test, CI, TestFlight) | 8/10 | Sağlam |
| Ders içeriği ve pedagojik akış | 7/10 | Metinler iyi |
| Görsel dil ve mobil | 6/10 | `Workspace.tsx` bakımı zor |
| **BIM nesne modeli** | **2/10** | Sadece `wall` ve `door` var |
| **Oynanış çeşitliliği** | **3/10** | Görevlerin ~%70'i "seç → bir sayıyı değiştir" |
| Gerçek Revit'e aktarım | 3/10 | Çizim/yerleştirme kas hafızası oluşmuyor |

### Kritik sorun
`types.ts` içinde:
```ts
export type CreatableElementType = 'wall' | 'door';
export type BimElement = WallElement | DoorElement;
export type TaskCriterion = CountCriterion | PropertyCriterion | RectangleCriterion;
```
Bu yüzden:
- "Çatı Kabuğu" görevi aslında "tüm duvarları 3000 mm yap" görevidir. Oyunda çatı nesnesi yoktur.
- Pencere, sill değeri olan bir kapıdır.
- Floor, Roof, Stair, Room, Grid, Section, Sheet, Tag ve Dimension görevleri gerçek nesne değil, **duvar/kapı üzerinden anlatı** olarak yürür.

**Ders metinleri ve Revit yolları gerçek; oynanış henüz gerçek değil.** Planın amacı bu farkı kapatmaktır.

---

## 2. Genel Kurallar (her fazda geçerli)

1. **Sıfırdan yazma.** Mevcut sistemi genişlet. Mevcut 50 görev her fazdan sonra hâlâ açılmalı ve bitirilebilmeli.
2. **Kayıt uyumluluğu:** `persistence.ts` sürümünü yükseltirsen (V1 → V2) eski kayıtları taşıyan bir migrasyon yaz. Oyuncunun ilerlemesi silinmemeli.
3. **Mobil UI kuralları (320px genişlik):**
   - Yatay taşma yok, buton taşması yok, okunamayacak küçük font yok.
   - Input/select fontu mobilde **en az 16px** olmalı (iOS otomatik zoom yapar; `App.css` sonunda kural var, koru).
   - Ekranda aynı anda: görev + model + seçili nesne + gerekli property + **tek ana aksiyon**.
   - Uzun metinler collapse / bottom sheet / info butonu arkasına.
   - Gereksiz badge, ikon, panel, başlık ekleme. Aynı bilgiyi iki yerde tekrarlama.
4. **Çözümü verme.** Görev metni hedefi söyler, yolu söylemez. Yol yalnızca Rehber Turu'nun son kademesinde verilir.
   - ⚠️ Bilinen ihlal: `Workspace.tsx` içindeki `⚡ 3000 mm Yap` butonu görevin cevabını veriyor. **Faz 0'da kaldırılacak.**
5. **Geri bildirim öğretici olmalı:** "Yanlış." değil → "w4 duvarı hâlâ 2600 mm; diğerleri 3000 mm olduğu için üst kotlar eşleşmiyor. Duvarı seç → Properties → Height'ı kontrol et."
6. **Her fazın sonunda:**
   ```powershell
   cd app
   npx tsc -b
   npx vitest run
   npx playwright test
   npm run build
   npx cap sync ios
   ```
   Ardından anlamlı bir commit. (`main`'e push otomatik TestFlight build'i tetikler; bilinçli yap.)
7. **Graphify:** Kod değiştirdikten sonra repo kökünde `graphify update .` çalıştır.
8. **Asla** sırları (token, `.p8`, `.p12`, profil) koda, md dosyasına veya commit'e yazma. `.gitignore` bunları zaten engelliyor; bozma.

---

## 3. Faz 0 — Hızlı Temizlik (yarım gün)

- [ ] `Workspace.tsx` → `⚡ 3000 mm Yap` butonunu kaldır. Yerine genel sayısal stepper koy: `−100 / −10 / +10 / +100` (klavye açmadan düzenleme imkânı korunur, cevap verilmez).
- [ ] Stepper'ı height ile sınırlı bırakma; tüm mm alanlarında (thickness, offset, width, sill, elevation) kullanılabilir tek bir `<MmStepperField>` bileşeni yap.
- [ ] `Workspace.tsx`'i böl (davranış değişmeden):
  - `ui/workspace/MissionPanel.tsx` (Öğren / Uygula metinleri)
  - `ui/workspace/PropertyInspector.tsx`
  - `ui/workspace/CheckFeedback.tsx` (Kontrol + Geri Bildirim)
  - `ui/workspace/RecapModal.tsx` (Değerlendir & XP)
  - `ui/workspace/GuideTour.tsx` (ipuçları)
- [ ] Rehber Turu kullanımı yıldız/XP'ye yansısın (ör. son kademe kullanıldıysa en fazla 2 yıldız).

**Kabul:** Tüm testler yeşil, görsel değişiklik yok (stepper hariç), `Workspace.tsx` < 800 satır.

---

## 4. Faz 1 — Gerçek BIM Nesne Modeli (→ ~55)

**Amaç:** Revit'in temel kategorileri oyunda gerçek nesneler olarak var olsun.

### 4.1 Veri modeli (`domain/types.ts`)
Yeni tipler ekle (mevcutları bozmadan):

```ts
interface Grid      { id; type:'grid'; name; start:[x,y]; end:[x,y] }
interface Level     { id; name; elevation }                     // zaten var
interface WallElement {                                          // genişlet
  ...mevcut alanlar,
  topConstraint: string | null;   // Level id, null = Unconnected
  topOffset: number;              // mm
  wallTypeId: string;             // Type'a referans
}
interface WindowElement { id; type:'window'; hostWallId; offset; width; height; sill; mark; windowTypeId }
interface FloorElement  { id; type:'floor'; levelId; boundary:[x,y][]; thickness; floorTypeId }
interface RoofElement   { id; type:'roof'; baseLevelId; footprint:[x,y][]; slope; overhang; roofTypeId }
interface CeilingElement{ id; type:'ceiling'; levelId; boundary:[x,y][]; heightOffset }
interface StairElement  { id; type:'stair'; baseLevelId; topLevelId; start:[x,y]; direction; width; riserHeight; treadDepth }
interface RoomElement   { id; type:'room'; levelId; seedPoint:[x,y]; name; number }  // sınır hesaplanır
```

### 4.2 Family / Type / Instance
```ts
interface ElementType { id; category:'wall'|'door'|'window'|'floor'|'roof'; family; name; params: Record<string, number|string> }
// ör. { id:'wt-200', category:'wall', family:'Basic Wall', name:'Generic - 200mm', params:{ thickness:200, material:'Beton' } }
```
- Type parametresi değişince o tipi kullanan **tüm** instance'lar değişmeli (Bölüm 4 görevleri bunu öğretir).
- Instance parametresi yalnızca seçili elemanı değiştirir.
- Property panelinde Type ve Instance parametreleri **ayrı bölümlerde** görünmeli, tıpkı Revit'teki gibi ("Edit Type" düğmesi bir bottom sheet açar).

### 4.3 Türetilmiş değerler (`domain/derived.ts` — yeni)
- `wallTopElevation(wall, levels)` → topConstraint varsa Level kotu + topOffset, yoksa base + height.
- `roomBoundary(room, model)` → seedPoint'ten duvar ağına göre kapalı poligon ya da `{ open: true, gapAt }`.
- `roomArea`, `roomVolume`.
- `hostedElements(wallId)` → o duvara bağlı kapı/pencere.

### 4.4 İlişkilerin gerçekten çalışması (`domain/commands.ts`)
- Level kotu değişince topConstraint'i o Level olan duvarlar **otomatik** yükselsin.
- Duvar silinince host ettiği kapı/pencere de silinsin (veya kullanıcıya sorulsun).
- Duvar taşınınca hosted elemanlar duvarla birlikte gitsin.
- Tüm komutlar mevcut undo/redo sistemine dahil olmalı.

### 4.5 Görselleştirme
- `PlanViewport.tsx`: grid çizgileri ve balonları, pencere sembolü, floor/room dolgusu, room etiketi (ad + numara + m²), stair okları.
- `SceneViewport.tsx`: pencere boşluğu + cam, floor plakası, roof (eğimli kırma/beşik çatı), stair basamakları.

### 4.6 Doğrulama (`domain/evaluator.ts`)
Yeni kriter tipleri:
```ts
| { type:'exists'; category; where?: Partial<props> }
| { type:'hosted'; category:'door'|'window'; hostCategory:'wall' }
| { type:'constraint'; elementId|category; topConstraint: levelId }
| { type:'roomClosed'; roomId? }
| { type:'typeUsage'; category; typeId; count? }
| { type:'allEqual'; category; field }         // "tüm duvarlar aynı üst kotta" gibi
```

### 4.7 İçerik bağlama
Aşağıdaki görevler yeni nesnelere bağlanmalı (görev id'leri `revitLessons.ts`'te):
- Pencere görevleri → `WindowElement`
- Floor → `FloorElement`, Roof → `RoofElement` (artık "duvarları 3000 yap" değil; gerçek çatı oluşturulur ve duvar üst kotu ile oturuşu kontrol edilir)
- Stair → `StairElement` (riser × adet = katlar arası yükseklik kontrolü)
- Room / Room Name-Number → `RoomElement`
- Grid → `Grid`
- Top Constraint → `WallElement.topConstraint`
- Type görevleri (Bölüm 4) → `ElementType`

**Kabul:**
- Yeni tiplerin her biri için birim test (oluştur, düzenle, sil, undo, türetilmiş değer).
- Level kotu değişimi → bağlı duvar yüksekliği testi.
- Type parametre değişimi → tüm instance'lar testi.
- Eski kayıt dosyası yüklenince çökmeden migrasyon.

---

## 5. Faz 2 — Gerçek Modelleme Araçları (→ ~68)

**Amaç:** Oyuncu form doldurmak yerine **çizerek ve yerleştirerek** model kursun.

- [ ] **Duvar zinciri aracı:** Planda dokun-dokun-dokun → zincirleme duvar. Grid/duvar uçlarına **snap**. Çift dokunma veya "Bitir" ile sonlandır. Mobilde parmak altını gösteren büyüteç/crosshair.
- [ ] **Hosted yerleştirme:** Kapı/pencereyi seç → duvar üzerinde sürükle; yalnızca duvar üzerinde geçerli, duvar dışında kırmızı önizleme. Kapı swing yönü tek dokunuşla çevrilebilir (flip).
- [ ] **Room aracı:** Kapalı alana dokun → room oluşur. Alan açıksa boşluğu plan üzerinde kırmızı işaretle.
- [ ] **Floor / Roof by Footprint:** "Duvarları seç" modu ya da sınır çizimi. Roof için overhang ve eğim.
- [ ] **Grid aracı:** İki dokunuşla grid çizgisi, otomatik isim (A, B, C… / 1, 2, 3…).
- [ ] **Level yönetimi:** Basit bir "Project Browser / Levels" bottom sheet'i; level ekle, kotunu değiştir, aktif level seç.
- [ ] Araç çubuğu Revit sekme mantığını yansıtsın (**Architecture**: Wall, Door, Window, Floor, Roof, Room, Stair; **Datum**: Level, Grid) ama mobilde tek satır, kaydırılabilir.

**Kabul:** Playwright testleri: dokunarak 4 duvarlı kapalı oda çiz, kapı yerleştir, room oluştur. Ekran genişliği 320px'te çalışmalı.

---

## 6. Faz 3 — Gerçek Model Kontrolü (→ ~75)

**Amaç:** Bölüm 6 (Model QA) görevleri gerçek hata tespitine dayansın; evaluator yalnızca true/false değil **teşhis** üretsin.

`domain/modelCheck.ts` (yeni). Her kontrol `{ code, severity, elementIds, message, revitHint }` döndürür:
| Kod | Tespit |
|---|---|
| `ROOM_OPEN_BOUNDARY` | Room sınırı kapalı değil; boşluğun yeri |
| `ROOM_NOT_PLACED` | Kapalı alan var ama room yok |
| `WALL_WRONG_LEVEL` | Duvar beklenen Level'a bağlı değil |
| `WALL_TOP_MISMATCH` | Komşu duvarların üst kotu farklı |
| `HOST_MISSING` | Kapı/pencerenin host duvarı yok |
| `OPENING_OUT_OF_WALL` | Açıklık duvar sınırlarının dışında |
| `TYPE_INCONSISTENT` | Aynı işlevli elemanlarda farklı tip |
| `SILL_INCONSISTENT` | Pencere parapet yükseklikleri tutarsız |
| `ROOM_DATA_MISSING` | Room adı/numarası boş |
| `TAG_MISSING` / `DIMENSION_MISSING` | Faz 4'ten sonra |

- Geri bildirim bu teşhislerden üretilir ve pedagojiye göre kademelenir (önce alan, sonra kategori, sonra property — Rehber Turu ile aynı merdiven).
- Plan ve 3D'de hatalı elemanlar vurgulanır ("Warnings" paneli; Revit'teki uyarı listesine benzer, ama tek bottom sheet).
- İleri görevlerde (Bölüm 6–7) teşhis listesi **gizli** başlar; oyuncu "Kontrol Et"e basınca sadece hata sayısı ve kategori gösterilir.

**Kabul:** Her kontrol kodu için en az bir pozitif ve bir negatif birim testi.

---

## 7. Faz 4 — Görünüşler ve Dokümantasyon (→ ~82)

- [ ] **View sistemi:** `ViewElement { id; kind:'plan'|'3d'|'section'|'elevation'; levelId?; cutLine?; direction?; crop? }`. Project Browser'da listelenir.
- [ ] **Section:** Planda iki dokunuşla kesit çizgisi → modelden 2D kesit görüntüsü üret (duvar kesitleri dolu, görünen kenarlar çizgi). Basit bir ortografik three.js render'ı veya geometriden SVG üretimi olabilir.
- [ ] **Elevation:** K/G/D/B yön işaretleri; seçilen yönden ortografik görünüş.
- [ ] **Crop region:** View üzerinde sürüklenebilir dikdörtgen.
- [ ] **Dimension:** İki duvar yüzü/ekseni seç → ölçü çizgisi; model değişince ölçü güncellenir.
- [ ] **Tag:** Kapı/pencere/room seç → etiket (mark / ad + numara). Eksik tag tespiti `TAG_MISSING`.
- [ ] **Sheet:** A3 pafta çerçevesi + antet; view'ları sürükleyip yerleştir, ölçek seç. Sheet numarası/adı.
- [ ] (Opsiyonel) Sheet'i PNG/PDF olarak dışa aktar, oyuncu ilk "paftasını" kaydedebilsin.

**Kabul:** Section/elevation görüntüsü model değişince güncellenir; sheet üzerinde en az bir plan + bir kesit yerleştirilebilir.

---

## 8. Faz 5 — Final Proje (→ ~85)

- [ ] Boş projeden başlama (yalnızca Level 0 var).
- [ ] Brif: "65–80 m² tek katlı konut" + başarı kriterleri listesi (Level sistemi, Grid, dış/iç duvar, kapı, pencere, döşeme, çatı, oda bilgileri, ölçüler, ≥1 kesit, ≥1 görünüş, 1 sheet, model kontrolü temiz).
- [ ] **Hiçbir buton/yol söylenmez.** Rehber Turu yalnızca kavram hatırlatır.
- [ ] Değerlendirme `modelCheck` + kriterlerden puanlanır; her kriter için kısa teşhis ve Revit karşılığı.
- [ ] Final raporu: "Proje Teslimi" ekranı — sheet önizlemesi, kriter tablosu, toplam XP, rozet.
- [ ] Bölüm 7'deki görevler (44–50) bu tek projenin aşamaları olarak birbirine bağlanır (model bir görevden diğerine taşınır).

---

## 9. 85'in Üstü (sonraki dönem, opsiyonel)

- Basit Family editörü (parametrik kapı: width/height parametreleri, Type oluşturma)
- Çok katlı projeler, Level'lar arası stair ve floor ilişkileri
- Malzeme ve görünürlük ayarları (Visibility/Graphics mantığı)
- Schedules (kapı/pencere/room çizelgeleri) — BIM verisinin tablo hâli
- Analitik: hangi görevde bırakılıyor, kaç ipucu kullanılıyor, kaç kez Kontrol'e basılıyor → zorluk eğrisini veriyle ayarla
- Performans: 3D sahneyi lazy-load et (şu an tek JS paketi ~1.5 MB)

---

## 10. Önerilen Çalışma Sırası (yeni oturum için)

1. Bu dosyayı oku. `graphify-out/graph.json` varsa mimari soruları için önce `graphify query "..."` kullan.
2. `app/src/domain/types.ts`, `evaluator.ts`, `commands.ts` ve `content/revitLessons.ts`'in ilk 3 görevini oku.
3. **Faz 0**'ı uygula → testler → commit.
4. **Faz 1**'i küçük dilimlerle uygula (her dilim: tip + komut + test + görsel + 1 görev bağlama):
   1. `ElementType` (Type/Instance) + duvar tiplerine bağlama
   2. `topConstraint` + Level kotu ilişkisi
   3. `WindowElement`
   4. `FloorElement` + `RoomElement` + `roomBoundary`
   5. `Grid`
   6. `RoofElement`
   7. `StairElement`
5. Her dilimden sonra 320px mobil görünümü kontrol et (Playwright ile ekran görüntüsü).
6. Faz 2'ye geçmeden önce kullanıcıya kısa bir durum raporu ver.
