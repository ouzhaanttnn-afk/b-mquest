import { expect, test } from '@playwright/test';

test.describe('Giriş ekranı ve ana ekran', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload();
  });

  test('giriş ekranından ana ekrana geçilir: evler ve görevler kartı', async ({ page }) => {
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('title-play-btn')).toContainText('Oyuna Başla');
    await page.getByTestId('title-play-btn').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('home-next-house')).toContainText('Bahçe Evi');
    await expect(page.getByTestId('home-house-bahce-evi')).toBeEnabled();
    await expect(page.getByTestId('home-house-iki-katli-ev')).toBeDisabled();

    // The missions are one card away, as a simple list.
    await expect(page.getByTestId('home-missions-btn')).toContainText('0/65');
    await page.getByTestId('home-missions-btn').click();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await expect(page.getByTestId('start-mission-m01')).toBeVisible();
    await expect(page.getByTestId('first-run-tour')).toBeVisible();
    for (let i = 0; i < 3; i++) await page.getByTestId('tour-next').click();
    await page.getByTestId('missions-back-btn').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // Same session: reload skips the title screen and returns to the same screen.
    await page.getByTestId('home-missions-btn').click();
    await page.reload();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await page.getByTestId('missions-back-btn').click();
    await page.reload();
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.getByTestId('brand-title-btn').click();
    await expect(page.getByTestId('title-screen')).toBeVisible();
  });

  test('"Nasıl Oynanır?" ana ekranda kısa rehberi açar', async ({ page }) => {
    await page.getByTestId('title-howto-btn').click();
    await expect(page.getByTestId('howto-sheet')).toBeVisible();
    await page.getByTestId('howto-close').click();
    await expect(page.getByTestId('howto-sheet')).toBeHidden();
  });

  test('ayarlar: tema, ses ve ilerlemeyi sıfırlama', async ({ page }) => {
    await page.getByTestId('title-play-btn').click();
    await page.getByTestId('home-menu-btn').click();
    await page.getByTestId('theme-toggle-btn').check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByTestId('toggle-sound').uncheck();
    expect(await page.evaluate(() => localStorage.getItem('bimquest.soundMuted.v1'))).toBe('true');
    await page.getByTestId('about-btn').click();
    await expect(page.getByTestId('about-sheet')).toBeVisible();
    await page.getByTestId('about-sheet').click({ position: { x: 5, y: 5 } });

    await page.evaluate(() => localStorage.setItem('bimquest.campaign.v1', JSON.stringify({ stars: { 'h1-1': 3 } })));
    await page.reload();
    await expect(page.getByTestId('home-total-stars')).toContainText('3');
    await page.getByTestId('home-menu-btn').click();
    await page.getByTestId('reset-progress-btn').click();
    await page.getByTestId('reset-confirm-btn').click();
    await expect(page.getByTestId('home-total-stars')).toContainText('0');
  });
});
