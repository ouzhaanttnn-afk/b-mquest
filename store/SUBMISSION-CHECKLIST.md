# Yayın Kontrol Listesi

Durum: ✅ hazır · 🟡 senin yapman gerekiyor · ⚠️ doğrulanamadı

## Kod ve proje
- ✅ Gizlilik manifestosu: `app/ios/App/App/PrivacyInfo.xcprivacy` (izleme yok, toplanan veri yok) ve Xcode projesine eklendi. ⚠️ Xcode'da derleyerek doğrulanmadı; ilk derlemede hata verirse dosyayı projeden silip "Add Files" ile yeniden ekle.
- ✅ Native özellikler (4.2 riskini azaltmak için): dokunsal geri bildirim, yerel bildirim, paylaşım sayfası, çevrimdışı çalışma. Eklentiler: `@capacitor/haptics`, `@capacitor/local-notifications`, `@capacitor/share`.
- ✅ Uygulama içi "Hakkında & Gizlilik" ekranı (Ayarlar → Hakkında & Gizlilik).
- ✅ Hesap yok; kullanıcı verisini dışa aktarma ve silme var.
- ✅ Şifreleme beyanı: `ITSAppUsesNonExemptEncryption = false`.
- ✅ TestFlight iş akışı önce tip kontrolü, test ve web derlemesi yapar.
- ⚠️ iOS derlemesi bu ortamda (Linux) çalıştırılamaz; yeni eklentiler `cap sync` ile `Package.swift`'e yazıldı, ama gerçek derleme ilk macOS çalışmasında görülecek.

## App Store Connect
- 🟡 Gizlilik politikası URL'si: `store/PRIVACY.md` herkese açık bir adreste yayınlanmalı (ör. GitHub Pages).
- 🟡 Metinler: `store/LISTING.md`'den kopyala.
- 🟡 Ekran görüntüleri: `store/screenshots/` yükle (6.9" iPhone ve 13" iPad).
- 🟡 Yaş derecelendirmesi anketi ve App Privacy ("Veri toplanmıyor") yanıtları.
- 🟡 İnceleme notları: `LISTING.md` sonundaki metin.
- 🟡 Gerçek iPhone ve iPad'de elle deneme (haptics ve bildirim yalnızca cihazda çalışır).

## Bilinen riskler
- **Guideline 4.2 (minimum işlevsellik):** Web teknolojisiyle yapılmış uygulamalar "siteyi sarmalayan uygulama" sayılırsa reddedilebiliyor. Bu uygulama zengin etkileşimli bir oyun ve cihaz özellikleri kullanıyor; yine de inceleme notlarında bunu açıkça belirt.
- **Markalar:** Açıklamada "Revit" geçiyor; Autodesk ile bağlantı olmadığı açıkça yazıldı.
