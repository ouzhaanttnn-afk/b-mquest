import { expect, test } from '@playwright/test';

test.describe('Giriş ekranı ve ana görev ekranı', () => {
  test('giriş ekranı açılır, Oyuna Başla ile görev ekranına geçer', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('title-play-btn')).toContainText('Oyuna Başla');
    await page.getByTestId('title-play-btn').click();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await expect(page.getByTestId('first-run-tour')).toBeVisible();
    await expect(page.getByTestId('tour-title')).toContainText('Plan ve 3B');
    await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('first-run-tour')).toBeHidden();
    await expect(page.getByTestId('hero-card')).toContainText('İlk görevin');

    // Same session: reload skips the title screen.
    await page.reload();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();

    // Logo goes back to the title screen.
    await page.getByTestId('brand-title-btn').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
  });

  test('"Nasıl Oynanır?" rehberi görev ekranında açar', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
    await page.getByTestId('title-howto-btn').click();
    await expect(page.getByTestId('dashboard-info-modal')).toBeVisible();
  });

  test('hero kartı ilk görevi başlatır, başarımlar listesi açılır', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByTestId('title-play-btn').click();
    await page.getByTestId('tour-skip').click();
    await page.getByTestId('achievements-btn').click();
    await expect(page.getByTestId('achievements-modal')).toBeVisible();
    await expect(page.getByTestId('ach-first-mission')).toBeVisible();
    await page.getByRole('button', { name: /Kapat/ }).click();
    await page.getByTestId('hero-continue-btn').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();
  });

  test('390 px genişlikte yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByTestId('title-play-btn').click();
    await page.getByTestId('tour-skip').click();
    const over = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await over()).toBeLessThanOrEqual(0);
    await page.getByTestId('hero-continue-btn').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();
    expect(await over()).toBeLessThanOrEqual(0);
  });
});

test.describe('Bonus bölüm: çizelgeler', () => {
  test('m51: çizelgede poz düzeltilince model değişir ve Kontrol Et geçer', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
    if (!window.localStorage.getItem('bimquest.meta.v1')) {
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    }
      const done = (s: number) => ({ bestScore: s });
      const completed: Record<string, unknown> = {};
      for (let i = 1; i <= 50; i++) completed[`m${String(i).padStart(2, '0')}`] = done(100);
      window.localStorage.setItem(
        'bimquest.save.v1',
        JSON.stringify({ saveVersion: 1, contentVersion: '1.0.0', completed, drafts: {}, settings: { reducedMotion: true, sound: false } })
      );
    });
    await page.goto('/');
    await page.getByTestId('stage-tab-ch08').click();
    await page.getByTestId('start-mission-m51').click();
    await page.getByTestId('schedules-btn').click();
    await expect(page.getByTestId('schedules-sheet')).toBeVisible();
    await page.getByTestId('sched-d2-mark').fill('D-02');
    await page.getByTestId('sched-d2-mark').press('Enter');
    await page.getByTestId('sched-d4-mark').fill('D-04');
    await page.getByTestId('sched-d4-mark').press('Enter');
    await page.getByTestId('schedules-sheet').getByRole('button', { name: /Kapat/ }).click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });
});

test.describe('Bonus bölüm: Modify araçları', () => {
  test('m55: üç duvarı aynala, Kontrol Et geçer', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
    if (!window.localStorage.getItem('bimquest.meta.v1')) {
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    }
      const completed: Record<string, unknown> = {};
      for (let i = 1; i <= 54; i++) completed[`m${String(i).padStart(2, '0')}`] = { bestScore: 100 };
      window.localStorage.setItem(
        'bimquest.save.v1',
        JSON.stringify({ saveVersion: 1, contentVersion: '1.0.0', completed, drafts: {}, settings: { reducedMotion: true, sound: false } })
      );
    });
    await page.goto('/');
    await page.getByTestId('stage-tab-ch09').click();
    await page.getByTestId('start-mission-m55').click();
    await page.getByTestId('modify-btn').click();
    await page.getByTestId('modify-tab-mirror').click();
    for (const w of ['w1', 'w2', 'w3']) await page.getByTestId(`modify-wall-${w}`).check();
    await page.getByTestId('modify-at').fill('3000');
    await page.getByTestId('modify-apply-btn').click();
    await expect(page.getByTestId('modify-message')).toHaveText('Uygulandı.');
    await page.getByTestId('modify-sheet').getByRole('button', { name: /Kapat/ }).click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });
});

test.describe('Görünürlük', () => {
  test('kategori kapatılınca düğme sayıyı gösterir, Hepsini göster sıfırlar', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    });
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await page.getByTestId('hero-continue-btn').click();
    await page.getByTestId('visibility-btn').click();
    await page.getByTestId('vg-wall').uncheck();
    await page.getByTestId('visibility-sheet').getByRole('button', { name: /Kapat/ }).click();
    await expect(page.getByTestId('visibility-btn')).toContainText('(1)');
    await page.getByTestId('visibility-btn').click();
    await page.getByTestId('vg-show-all').click();
    await page.getByTestId('visibility-sheet').getByRole('button', { name: /Kapat/ }).click();
    await expect(page.getByTestId('visibility-btn')).not.toContainText('(');
  });
});

test.describe('Yardım ve sözlük', () => {
  test('sözlükte kavram aranır, kısayol kartı açılır', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    });
    await page.goto('/');
    await page.getByTestId('help-btn').click();
    await expect(page.getByTestId('help-sheet')).toBeVisible();
    await page.getByTestId('help-search').fill('KESIT');
    await expect(page.getByTestId('help-entry-m31')).toBeVisible();
    await page.getByTestId('help-search').fill('zzzzqq');
    await expect(page.getByTestId('help-count')).toContainText('0 sonuç');
    await page.getByTestId('help-tab-keys').click();
    await expect(page.getByTestId('help-shortcuts')).toContainText('WA');
  });
});

test.describe('Mezuniyet sertifikası', () => {
  test('final sonrası sertifika açılır, ad yazılır', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
      const completed: Record<string, unknown> = {};
      for (let i = 1; i <= 50; i++) completed[`m${String(i).padStart(2, '0')}`] = { bestScore: 100 };
      window.localStorage.setItem(
        'bimquest.save.v1',
        JSON.stringify({ saveVersion: 1, contentVersion: '1.0.0', completed, drafts: {}, settings: { reducedMotion: true, sound: false } })
      );
    });
    await page.goto('/');
    await page.getByTestId('certificate-btn').click();
    await expect(page.getByTestId('certificate-sheet')).toBeVisible();
    await page.getByTestId('certificate-name').fill('Ayşe Yılmaz');
    await expect(page.getByTestId('certificate-name-text')).toHaveText('Ayşe Yılmaz');
    await expect(page.getByTestId('certificate-svg')).toContainText('50');
  });
  test('final bitmeden sertifika düğmesi yok', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    });
    await page.goto('/');
    await expect(page.getByTestId('certificate-btn')).toHaveCount(0);
  });
});

test.describe('Duvar çizmeyi kolaylaştıranlar', () => {
  const seed = async (page: import('@playwright/test').Page) =>
    page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
      window.localStorage.setItem(
        'bimquest.save.v1',
        JSON.stringify({ saveVersion: 1, contentVersion: '1.0.0', completed: { m01: { bestScore: 100 } }, drafts: {}, settings: { reducedMotion: true, sound: false } })
      );
    });

  test('m02: "4 duvarlı oda" tek dokunuşla görevi çözer', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('start-mission-m02').click();
    await page.getByTestId('tool-wall-btn').click();
    await page.getByTestId('wall-helpers-toggle').click();
    await page.getByTestId('wall-rect-btn').click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m02: ölçüyle duvar — yön okları zinciri çizer', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('start-mission-m02').click();
    await page.getByTestId('tool-wall-btn').click();
    await page.getByTestId('wall-helpers-toggle').click();
    for (const [dir, len] of [['R', '6000'], ['D', '4000'], ['L', '6000'], ['U', '4000']]) {
      await page.getByTestId('wall-len').fill(len);
      await page.getByTestId(`wall-dir-${dir}`).click();
    }
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });
});

test.describe('Serbest Atölye', () => {
  const seed = async (page: import('@playwright/test').Page) =>
    page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      if (!window.localStorage.getItem('bimquest.meta.v1')) {
        window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: ['first-mission'] }));
      }
      if (!window.localStorage.getItem('bimquest.save.v1')) {
        window.localStorage.setItem(
          'bimquest.save.v1',
          JSON.stringify({ saveVersion: 1, contentVersion: '1.0.0', completed: { m01: { bestScore: 100 }, m02: { bestScore: 100 } }, drafts: {}, settings: { reducedMotion: true, sound: false } })
        );
      }
    });

  test('atölye m02 sonrası açılır, model ayrı saklanır ve geri gelir', async ({ page }) => {
    await seed(page);
    await page.goto('/');
    await page.getByTestId('workshop-btn').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();
    await page.getByTestId('tool-wall-btn').click();
    await page.getByTestId('wall-helpers-toggle').click();
    await page.getByTestId('wall-rect-btn').click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toHaveCount(0);

    const stored = await page.evaluate(() => ({
      save: window.localStorage.getItem('bimquest.save.v1') ?? '',
      workshop: window.localStorage.getItem('bimquest.workshop.v1') ?? '',
    }));
    expect(stored.save).not.toContain('atolye');
    expect(JSON.parse(stored.workshop).elements).toHaveLength(4);

    await page.getByTestId('back-dashboard-btn').click();
    await page.getByTestId('workshop-btn').click();
    await expect(page.getByTestId('plan-wall-w4')).toBeAttached();
  });

  test('atölye düğmesi m02 bitmeden görünmez', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    });
    await page.goto('/');
    await expect(page.getByTestId('workshop-btn')).toHaveCount(0);
  });
});

test.describe('Hakkında, gizlilik ve ayarlar', () => {
  test('hakkında ekranı gizlilik özetini ve sürümü gösterir; titreşim ve hatırlatma ayarları durur', async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
      if (!window.localStorage.getItem('bimquest.meta.v1')) {
        window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
      }
    });
    await page.goto('/');
    await page.getByTestId('settings-toggle-btn').click();
    await page.getByTestId('about-btn').click();
    await expect(page.getByTestId('about-sheet')).toBeVisible();
    await expect(page.getByTestId('app-version')).toHaveText('1.0.0');
    await expect(page.getByTestId('privacy-summary')).toContainText('Hiçbir kişisel veri toplanmaz');
    await page.getByTestId('about-sheet').getByRole('button', { name: /Kapat/ }).click();

    await page.getByTestId('toggle-haptics').uncheck();
    await page.getByTestId('toggle-reminder').click();
    await expect(page.getByTestId('reminder-note')).toContainText('yalnızca iPhone');
    await expect(page.getByTestId('toggle-reminder')).not.toBeChecked();
    await page.reload();
    await page.getByTestId('settings-toggle-btn').click();
    await expect(page.getByTestId('toggle-haptics')).not.toBeChecked();
  });
});
