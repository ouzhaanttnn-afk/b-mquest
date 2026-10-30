# BIM QUEST — Final Sürüm Kod Planı

Hedef: oyuncu oyunu bitirdiğinde gerçek Revit'i açıp Level/Grid, Wall/Door/Window/Floor/Roof/Stair, Type/Instance, View/Section/Sheet, Schedule ve Modify mantığını tanır; oyun App Store'a gönderilebilir kalitededir.

Bu plan, 30 Ekim 2026 tarihli koddan (58 görev, 9 bölüm) yapılan taramaya dayanır.

## 1. Taramadan çıkan bulgular

### Kullanıcıya dönük
| # | Bulgu | Kanıt |
|---|---|---|
| U1 | `m07 Kat Sistemi` görevi `m01` ile birebir aynı (duvar yüksekliğini 3000 mm yap). Level kavramı oynanmıyor. | `cat.txt` taraması; `revitLessons.ts` m07 `wall_height` |
| U2 | `m11 Aksa Oturan Duvar` aks değil kalınlık/yükseklik düzeltiyor; konu ile oynanış uyuşmuyor. | `FixType: 'wall_thickness'` |
| U3 | `m23 Yanlış Kapı Tipi` Type değiştirmiyor, Instance genişliğini değiştiriyor. | `FixType: 'door_width'` |
| U4 | Tüm oyun için tek bir "ilk açılış" turu var, o da yalnızca m01'de. Yardım, sözlük, kısayol listesi yok. | `tutorial.ts` |
| U5 | Final proje sonunda sertifika/paylaşılabilir sonuç yok; oyun sönük bitiyor. | `ProjectDelivery.tsx` |
| U6 | Görevlerde "bu kavram gerçek Revit'te nerede?" bilgisi var ama tek yerde toplanmış arama/sözlük yok. | `revitLessons.ts` |
| U7 | Yanlış hamlede kullanıcıya yalnızca metin; geri bildirimde ilgili nesne planda vurgulanıyor ama kısa tekrar/öneri akışı yok. | `CheckFeedback.tsx` |

### Teknik
| # | Bulgu | Kanıt |
|---|---|---|
| T1 | Hata sınırı (ErrorBoundary) yok; bir render hatası beyaz ekran verir ve oyuncunun ne yapacağı belli olmaz. | `main.tsx` |
| T2 | CI yalnızca iOS derleyip yüklüyor; push'ta test, tip kontrolü ve lint koşmuyor. Bozuk kod TestFlight'a gidebilir. | `.github/workflows/ios-testflight.yml` |
| T3 | Kullanılmayan şablon dosyalar: `src/assets/hero.png`, `react.svg`, `vite.svg`. | `grep` |
| T4 | Lint uyarıları (set-state-in-effect, refs during render, exhaustive-deps). | `npx oxlint` |
| T5 | Çok büyük dosyalar: `commands.ts` 1263, `PlanViewport.tsx` 1260, `Workspace.tsx` 1199, `PropertyInspector.tsx` 1109 satır. | `wc -l` |
| T6 | Ana paket hâlâ 740 kB; `driver.js` ve Dashboard her zaman yükleniyor. | `vite build` |
| T7 | `MARKETING_VERSION` CI'da sabit `1.0.0`; sürüm notu ve değişiklik görünürlüğü yok. | workflow adım 5 |
| T8 | Erişilebilirlik: plan SVG'sinde nesneler için klavye ile gezinme ve ekran okuyucu özeti yok; viewport `user-scalable=no`. | `index.html`, `PlanViewport.tsx` |
| T9 | E2E testlerinde PNG indirme kontrolü Chromium sürümüne bağlı (dosya adı `download`). | `bim-docs.spec.ts`, `bim-final.spec.ts` |

### İçerik / kapsam
| # | Bulgu |
|---|---|
| C1 | Modify araçları yalnızca duvarlarda çalışıyor (Trim, Array, kapı/pencere kopyalama yok). |
| C2 | Family editörü ve malzeme yok. |
| C3 | Çok katlı ev (Level 1 + merdiven + döşeme ilişkisi) tek bir bağlı projede oynanmıyor; yalnızca ayrı görevlerde. |

## 2. Faz planı

Her faz sonunda: `npx tsc -b`, `npm test`, `npm run build`, `npx playwright test`; ardından anlamlı commit. Faz 0–5 bu oturumda uygulanır; Faz 6–7 sonraki dönem.

### Faz 0 — Güvenlik ağı (T1, T2, T3, T4)
- `ErrorBoundary` bileşeni: render hatasında "Bir şeyler ters gitti" + "Yeniden dene" + "İlerlemeni dışa aktar" düğmesi. Kayıt silinmez.
- `.github/workflows/ci.yml`: her PR ve `main` push'unda `tsc -b`, `vitest`, `vite build`. iOS iş akışı `ci` başarısız olursa çalışmaz (`needs` yerine `workflow_run` ya da aynı iş akışında ön iş).
- Kullanılmayan şablon dosyaları silinir.
- Lint uyarıları: anlamlı olanlar düzeltilir (set-state-in-effect, exhaustive-deps).
- Kabul: CI yeşil; `ErrorBoundary` için birim testi (hata fırlatan çocuk).

### Faz 1 — Eşleşmeyen görevleri düzelt (U1, U2, U3)
- `m07` → yeni oynanış: "1. Kat" Level'ını ekle ve kotunu 3000 mm yap (Levels sayfası; `levelCount` ve elevation kriteri).
- `m11` → duvar akstan 150 mm kaymış; aks A'ya oturt (`compare`: duvar `axisPos` = aks `axisPos`).
- `m23` → kapı yanlış tipte (800); Type'ı 900'e çevir (`typeUsage`), Instance genişliği kilitli.
- Her biri için birim testi (başlangıçta kalır, çözümle geçer) ve eski kayıt uyumu (görev kimlikleri değişmez).
- Kabul: 3 görev de yeni kriterle geçer; katalog testi yeşil; Playwright'ta m07 oynanır.

### Faz 2 — Yardım, sözlük, ilk açılış (U4, U6)
- **Yardım & Sözlük** ekranı (Görevler ekranında ve Workspace'te `?` düğmesi): Revit kavramı arama (Level, Host, Type/Instance, Top Constraint, ...), her kavram için "Revit'te nerede" yolu ve ilgili görev bağlantısı. Veri `revitLessons.ts`'ten türetilir; yeni içerik yazılmaz.
- **Kısayol kartı**: tüm Revit kısayolları (WA, DR, ...) ve oyundaki karşılıkları.
- **İlk açılış turu**: ilk girişte 3 adımlı kısa kart ("Plan ve 3B", "Properties", "Kontrol et"); `meta.introDone` ile bir kez.
- Kabul: aramayla bir kavram bulunur; ilk açılışta tur çıkar, ikinci açılışta çıkmaz.

### Faz 3 — Bitiş deneyimi (U5)
- **Sertifika ekranı**: Görev 50 teslim sonrası "BIM QUEST Mezuniyet" kartı (ad girilebilir, toplam XP, rozetler, görev sayısı, tarih). SVG'den PNG indirme (mevcut Sheet PNG koduyla aynı yol).
- Sertifika Dashboard'da kalıcı olarak açılabilir.
- Kabul: ad girilince kart güncellenir; PNG indirilir.

### Faz 4 — Geri bildirim ve oynanış cilası (U7)
- Başarısız kontrolde, ilgili kriter için "Planda göster" düğmesi: ilgili nesneyi seçip vurgular.
- Görev başına "tahmini süre" ile gerçek süre karşılaştırması (yerel istatistiğe eklenir).
- Kabul: düğme nesneyi seçer; birim test.

### Faz 5 — Erişilebilirlik ve performans (T6, T8)
- Plan SVG'sinde nesne listesi için ekran okuyucu özeti (`aria-label` ile "4 duvar, 1 kapı...").
- Viewport'ta yakınlaştırma izni (`user-scalable=no` kaldırılır; iOS input zoom zaten 16 px ile önlenmiş).
- `driver.js` ve Dashboard'daki büyük modallar `lazy`.
- Kabul: ana paket < 700 kB; 320 px taşma testleri geçer.

### Faz 6 — Kod sağlığı (T5) (sonraki dönem)
- `commands.ts`'i `commands/` altında konuya göre böl (wall, openings, datum, docs, modify).
- `PlanViewport.tsx` ve `PropertyInspector.tsx` için aynısı.
- Davranış değişmez; testler aynen geçer.

### Faz 7 — Kapsam genişletme (C1–C3) (sonraki dönem)
- Modify: kapı/pencere kopyalama, Trim, Array.
- Basit Family editörü (parametrik kapı: width/height ve Type üretme).
- Tek bağlı çok katlı proje (Level 1, merdiven, döşeme).
- Malzeme/Visibility ayarlarının görev kriterlerine bağlanması.

## 3. Uygulama kuralları
1. Mevcut görev kimlikleri ve kayıt uyumu bozulmaz; kayıt şeması değişirse migrasyon yazılır.
2. Cevap verme kuralı: görev metni hedefi söyler, yolu yalnızca son ipucu verir.
3. 320 px genişlikte yatay taşma, 16 px altı input fontu olmaz.
4. Sırlar (anahtar, p8, p12, profil) koda ve repoya girmez.
5. `main`'e birleştirme TestFlight build'i tetikler; yalnızca kullanıcı isteyince yapılır.

## 4. Uygulama durumu (30 Ekim 2026)

| Faz | Durum | Not |
|---|---|---|
| 0 Güvenlik ağı | Yapıldı | ErrorBoundary, CI kapısı (iOS build'inden önce tsc + test + build), şablon dosyalar silindi. Kalan lint uyarıları eski koda ait ve davranışa dokunduğu için bırakıldı. |
| 1 Görev düzeltmeleri | Yapıldı | m07, m11, m23 yeniden yazıldı. |
| 2 Yardım ve sözlük | Yapıldı | Sözlük araması, kısayol kartı, 3 kartlık ilk açılış turu. |
| 3 Sertifika | Yapıldı | Görev 50 sonrası, ad yazılır, PNG indirilir. |
| 4 Geri bildirim | Gereksiz bulundu | Kriter satırına dokununca ilgili nesne zaten seçiliyor. Yeni iş yapılmadı. |
| 5 Erişilebilirlik/performans | Kısmen | Plan için ekran okuyucu özeti ve lazy yükleme yapıldı (ana paket 758 → 617 kB). `user-scalable=no` bilerek korundu: planda parmakla yakınlaştırma sayfayı yakınlaştırırdı. |
| 6 Kod sağlığı | Yapılmadı | Büyük dosyaların bölünmesi. |
| 7 Kapsam | Yapılmadı | Family editörü, çok katlı tek proje vb. |

Ek (kullanıcı geri bildirimiyle): duvar çizmek zor geldiği için "Ölçüyle çiz" eklendi: yön oklarıyla ölçülü duvar zinciri ve tek dokunuşta 4 duvarlı oda; çizim sırasında canlı uzunluk etiketi.

## 5. Yayın ve ürün olgunluğu turu (30 Ekim 2026)

Web araştırmasından çıkan kararlar (kaynaklar ikincil; Apple'ın güncel metniyle doğrulanmalı):
- **4.2 riski:** Capacitor ile sarılmış uygulamalar "yeterli native işlev yok" gerekçesiyle reddedilebiliyor. Önlem: gerçek cihaz özellikleri eklendi (haptics, yerel bildirim, paylaşım) ve inceleme notlarına yazıldı. Garanti değildir.
- **Gizlilik manifestosu:** `PrivacyInfo.xcprivacy` eklendi (izleme yok, toplanan veri yok).
- **iPhone'da titreşim:** `navigator.vibrate` iOS'ta yok; Capacitor Haptics ile çözüldü.
- **Mağaza paketi:** `store/` (metinler, gizlilik politikası, kontrol listesi, ekran görüntüsü üreticisi ve çıktıları).

Bu turda ekran görüntülerinden bulunup düzeltilenler: iPad dikey düzen, 3B kamera uzaklığı, kalın sarı vurgu, kuzey oku yönü, ↑ oklarının ters yöne çizmesi.

Kalanlar: Faz 6 (büyük dosyaları bölme), Faz 7 (Family editörü, çok katlı tek proje), eski şablon görevlerin (m04–m06, m13–m16, m26–m29) çeşitlendirilmesi, Xcode'da gerçek derleme ve cihaz denemesi.
