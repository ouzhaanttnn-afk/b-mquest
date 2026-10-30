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
