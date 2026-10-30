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
