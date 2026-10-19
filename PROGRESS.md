# BIM QUEST — Geliştirme İlerleme ve Kalite Raporu (`PROGRESS.md`)

**Güncel Durum:** **%100 Tamamlandı** (Zorunlu kabul kriterleri, Oyun HUD & `ⓘ` Bilgi Sistemi, Dark/Light Tema, 2B Plan & 3B Sahne Yüksek Kontrastlı Mimari Görünüm ve Apple TestFlight CI/CD hattı tamamlandı)  
**Yerel Çalışma Adresi:** `http://127.0.0.1:5173/`

---

## 1. Tamamlanan Geliştirme Aşamaları

### %20 — Merkezi BIM Veri Modeli, Komut Motoru ve 40 Görevlik Müfredat Altyapısı
- **Merkezi Veri Modeli ([`types.ts`](file:///c:/Users/Gaming/Desktop/BIM/app/src/domain/types.ts)):** Katlar (`Level`), Duvarlar (`WallElement`) ve Kapılar (`DoorElement`) tek bir merkezi `BimModel` (JSON Schema v1.0) üzerinde tutulur.
- **Düzenlenebilir Modelleme Komutları ([`commands.ts`](file:///c:/Users/Gaming/Desktop/BIM/app/src/domain/commands.ts)):**
  - Duvar oluşturma (`createWallCommand`), seçme, taşıma (`moveWallCommand` + 2B uç nokta sürükleme tutamaçları `onDragWallEndpoint`), silme (`deleteElementCommand`) ve ölçü/özellik düzenleme (`updateElementProperty`).
  - Taşıyıcı duvara bağlı kapı oluşturma (`createDoorCommand`) ve taşıyıcı duvar / ofset / genişlik / yükseklik / eşik / Mark / yangın sınıfı güncelleme.
  - 50 adımlı Geri Al / İleri Al (`undoCommand`, `redoCommand`).
- **6 Bölüm / 40 Görevlik Genişletilebilir Mimari ([`curriculum.ts`](file:///c:/Users/Gaming/Desktop/BIM/app/src/domain/curriculum.ts), [`missions.json`](file:///c:/Users/Gaming/Desktop/BIM/app/public/data/missions.json), [`persistence.ts`](file:///c:/Users/Gaming/Desktop/BIM/app/src/domain/persistence.ts)):**
  - 6 ana bölüm altında 40 görevlik müfredat veri odaklı olarak tanımlandı.
  - Kayıt dosyası (`bimquest.save.v1`) dinamik görev kimliklerini ve oyuncu XP puanını (`xp`) yeni görevler eklendiğinde bozulmadan korur.

### %65 — Oyun Logosu, Kompakt Oyun HUD'u, `ⓘ` Bilgi Butonları ve Dark/Light Mode
- **Oyun Logosu ve App Store İkonu:**
  - [`logo-horizontal.svg`](file:///c:/Users/Gaming/Desktop/BIM/app/public/assets/brand/logo-horizontal.svg), [`favicon.svg`](file:///c:/Users/Gaming/Desktop/BIM/app/public/assets/brand/favicon.svg) ve TestFlight `1024×1024` ikonu [`app-icon-1024.svg`](file:///c:/Users/Gaming/Desktop/BIM/app/public/assets/brand/app-icon-1024.svg) oluşturuldu.
- **Kompakt Oyun Tarzı Arayüz ve `ⓘ` (`i`) Bilgi Butonları ([`Dashboard.tsx`](file:///c:/Users/Gaming/Desktop/BIM/app/src/ui/Dashboard.tsx), [`Workspace.tsx`](file:///c:/Users/Gaming/Desktop/BIM/app/src/ui/Workspace.tsx)):**
  - Uzun açıklamalar ekranı kalabalıklaştırmaz; üst barda ve sol panelde **`ⓘ` (`i`) butonları** ile açılır/kapanır bilgi kartları ve tam ekran **ⓘ Mimari BIM Kılavuzu** penceresi eklendi.
  - Üst barda canlı **🎯 %İlerleme Çubuğu** (`live-progress-pill`) ve oyuncu **Seviye / XP** göstergesi yer alır.
- **Dark Mode & Light Mode Desteği ([`App.tsx`](file:///c:/Users/Gaming/Desktop/BIM/app/src/App.tsx), [`App.css`](file:///c:/Users/Gaming/Desktop/BIM/app/src/App.css)):**
  - Hem Koyu Tema (`🌙 Koyu`) hem Açık Tema (`☀️ Açık`) tüm arayüzde, 2B Planda ve 3B Sahnede anlık olarak çalışır.

### %85 — Belirginleştirilmiş 2B Mimari Plan & 3B Canlı Sahne Düzeni
- **2B Mimari Kat Planı ([`PlanViewport.tsx`](file:///c:/Users/Gaming/Desktop/BIM/app/src/plan/PlanViewport.tsx)):**
  - Mavi/Camgöbeği (`#38BDF8`) mimari pafta çerçevesi, `📐 2B MİMARİ KAT PLANI (ÜSTTEN GÖRÜNÜŞ · mm)` başlığı, Kuzey oku (`K ↑`), dış ölçü çizgisi (`6000 mm (6.0 m)`), otomatik **MAHAL 101 · 24.0 m² · Hacim: 72.0 m³** damgası ve seçili duvarda turuncu uç nokta sürükleme tutamaçları eklendi.
- **3B Canlı Mimari Sahne ([`SceneViewport.tsx`](file:///c:/Users/Gaming/Desktop/BIM/app/src/scene/SceneViewport.tsx)):**
  - Turuncu (`#F97316`) 3B stüdyo çerçevesi, `🧊 3B CANLI MİMARİ SAHNE (PERSPEKTİF · m)` başlığı, binanın altında gerçek **3B Betonarme Temel Plakası (`6.6m × 4.6m`)** ve **Oda İçi Zemin Kaplaması (`6.0m × 4.0m`)**, yakınlaştırılmış kamera açısı ve **👁️ Oda İçi (1.65 m Göz Hizası)** kamera modu eklendi.
- **Dar Pencerelerde Ezilmeyi Önleyen Yan Yana Düzen ([`App.css`](file:///c:/Users/Gaming/Desktop/BIM/app/src/App.css), [`index.css`](file:///c:/Users/Gaming/Desktop/BIM/app/src/index.css)):**
  - Vite şablonundan kalan `#root` kısıtlaması temizlendi; `620px` ve üzeri tüm pencerelerde 2B Plan ve 3B Sahne yan yana (`1fr 1fr`) ve en az `360px` yükseklikle tam boyutta görüntülenir.

### %100 — Apple TestFlight (`AuthKey_SNPBS4JDJA`) & GitHub Actions Otomasyonu ve E2E Testler
- **Capacitor iOS Yapılandırması:** [`capacitor.config.json`](file:///c:/Users/Gaming/Desktop/BIM/app/capacitor.config.json) (`com.bimquest.studio`).
- **GitHub Actions TestFlight İş Akışı:** [`.github/workflows/ios-testflight.yml`](file:///c:/Users/Gaming/Desktop/BIM/.github/workflows/ios-testflight.yml) (`APPSTORE_KEY_ID: SNPBS4JDJA` ile macOS üzerinde otomatik `.ipa` derleme ve TestFlight yükleme).
- **Test Sonuçları:**
  - **Vitest Birim & Entegrasyon Testleri:** `15 / 15` geçti (`tests/domain.test.ts`).
  - **Playwright Tarayıcı E2E Testleri:** `2 / 2` geçti (`tests/e2e.spec.ts`).

---

## 2. Açık Sorunlar (Open Issues)

- **Açık Teknik Sorun:** Yok (0 bilinen hata).
