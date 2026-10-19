# BIM QUEST — Bağımsız Web Tabanlı BIM Öğrenme Oyunu

**Modeli kur. Bilgiyi bağla. Kontrolü geç.**

BIM QUEST; Autodesk Revit veya herhangi bir ücretli bulut/CAD lisansına ihtiyaç duymadan doğrudan tarayıcıda (Masaüstü, iPad ve iPhone uyumlu) çalışan, gerçek parametrik BIM veri modeli üzerinde mimari modelleme mantığını öğreten Türkçe bir eğitim oyunudur.

## Temel Özellikler

1. **Gerçek ve Düzenlenebilir BIM Veri Modeli (`integer mm`)**
   - Tekil merkezi BIM veri modeli (`levels`, `wall`, `door`).
   - Duvar çizme, seçme, taşıma (`ΔX / ΔZ mm`), silme ve boyutlarını (`height`, `thickness`, `start`, `end`, `name`) değiştirme.
   - Gerçek duvar nesnelerine bağlı (`hostWallId`) kapılar; hem 2B SVG planda kapı yayını hem de 3B Three.js sahnesinde gerçek fiziksel duvar boşluğunu otomatik açar.
   - Tam işlem geçmişi (`Geri Al / İleri Al`) ve yerel kayıt/dışa aktarma/içe aktarma (`bimquest.save.v1`).

2. **5 Adımlı Öğreten Görev Döngüsü ve Tanılayıcı Geri Bildirim**
   - **1. Öğren:** İşlemin ne olduğu ve mimari BIM projelerinde neden kullanıldığı açıklanır.
   - **2. Uygula:** Oyuncu 2B Plan, 3B Sahne ve Özellikler paneliyle modeli bizzat kurar/düzenler.
   - **3. Kontrol Et:** Deterministik doğrulayıcı model verilerini kurallarla karşılaştırır.
   - **4. Geri Bildirim:** Hata varsa yalnızca "Yanlış" demez; **Neden Yanlış** olduğunu ve **Nasıl Düzeltileceğini** (ör. kapının hangi duvara bağlanması veya hangi ölçünün girilmesi gerektiğini) açıklar.
   - **5. Değerlendir & XP:** Başarılı oyuncuya Puan, **XP** ve Rozet (`Altın`, `Gümüş`, `Bronz`) verilir, sonraki görevin kilidi açılır.

3. **6 Ana Bölüm / 40 Göreve Genişletilebilir Mimari**
   - İlk 3 görev (`m01`, `m02`, `m03`) tam oynanabilir prototip olarak sunulur.
   - Müfredat 6 Ana Bölüm ve 40 Görev (`m01`..`m40`) yapısında veri odaklı (JSON) tasarlanmıştır; oyun motorunu değiştirmeden yeni görev JSON dosyaları eklenebilir.

## Komutlar

```powershell
# Geliştirme sunucusunu başlat
npm run dev

# Birim ve entegrasyon testlerini çalıştır (Vitest)
npm test

# Üretim derlemesi oluştur (TypeScript + Vite)
npm run build

# Tarayıcı uçtan uca (E2E) testlerini çalıştır (Playwright)
npm run test:e2e
```
