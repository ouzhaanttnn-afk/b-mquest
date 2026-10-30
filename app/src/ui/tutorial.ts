export async function startMission1Tutorial(): Promise<void> {
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ]);
  const drv = driver({
    showProgress: true,
    animate: true,
    nextBtnText: 'İleri →',
    prevBtnText: '← Geri',
    doneBtnText: 'Anladım, Başla!',
    progressText: '{{current}} / {{total}}',
    steps: [
      {
        element: '[data-tour="mission-brief"]',
        popover: {
          title: '1. Görev Hedefini Oku',
          description:
            'Her görevde senden istenen net ölçü ve kurallar burada yazar. İlk görevde 4 duvarın yüksekliğini 2800 mm’den 3000 mm’ye çıkaracağız.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="viewport-area"]',
        popover: {
          title: '2. Plan ve 3B Sahne Aynı Gerçeği Gösterir',
          description:
            '2B Ortografik Plan ve 3B Sahne aynı yapı modelini (mm cinsinden) yansıtır. Duvarı plandan, 3B sahneden veya sağdaki listeden seçebilirsin.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="object-list"]',
        popover: {
          title: '3. Nesne Listesinden Seçim Yap',
          description:
            'Klavyeyle, fareyle veya dokunarak w1, w2, w3 ve w4 duvarlarını buradan tek tek seçebilirsin.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '[data-tour="property-editor"]',
        popover: {
          title: '4. Sayısal Özelliği Düzenle (mm)',
          description:
            'Seçtiğin duvarın Yükseklik (mm) kutusuna 3000 yazıp Enter tuşuna bas (veya Uygula düğmesine dokun).',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '[data-testid="check-btn"]',
        popover: {
          title: '5. Modeli Kontrol Et',
          description:
            'Dört duvarı da 3000 mm yaptıktan sonra "Kontrol et" düğmesine basarak kuralları doğrula ve bir sonraki görevin kilidini aç!',
          side: 'top',
          align: 'center',
        },
      },
    ],
  });

  drv.drive();
}
