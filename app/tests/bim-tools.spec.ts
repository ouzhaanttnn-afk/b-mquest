import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOTS = path.resolve(process.cwd(), 'evidence', 'screenshots');
test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

async function openMission(page: Page, id: string, completedBefore: number) {
  await page.goto('/');
  await page.evaluate((n) => {
    const completed: Record<string, { bestScore: number }> = {};
    for (let i = 1; i <= n; i++) completed[`m${String(i).padStart(2, '0')}`] = { bestScore: 100 };
    window.localStorage.setItem(
      'bimquest.save.v1',
      JSON.stringify({
        saveVersion: 1,
        contentVersion: '1.0.0',
        completed,
        drafts: {},
        settings: { sound: false, reducedMotion: true },
      })
    );
  }, completedBefore);
  await page.reload();
  const tabs = page.locator('[data-testid^="stage-tab-"]');
  const start = page.getByTestId(`start-mission-${id}`);
  for (let i = 0; i < (await tabs.count()) && !(await start.isVisible()); i++) {
    await tabs.nth(i).click();
  }
  await start.click();
  await expect(page.getByTestId('workspace-screen')).toBeVisible();
}

/** Plan millimetres → page pixels (viewBox with xMidYMid meet). */
async function tapMm(page: Page, x: number, z: number) {
  const p = await page.evaluate(
    ([mx, mz]) => {
      const svg = document.querySelector('.bq-plan-svg') as SVGSVGElement;
      const vb = (svg.getAttribute('viewBox') as string).split(' ').map(Number);
      const r = svg.getBoundingClientRect();
      const scale = Math.min(r.width / vb[2], r.height / vb[3]);
      const ox = (r.width - vb[2] * scale) / 2;
      const oy = (r.height - vb[3] * scale) / 2;
      return { x: r.left + ox + (mx - vb[0]) * scale, y: r.top + oy + (mz - vb[1]) * scale };
    },
    [x, z]
  );
  await page.mouse.click(p.x, p.y);
}

async function dragMm(page: Page, from: [number, number], to: [number, number]) {
  const at = (mx: number, mz: number) =>
    page.evaluate(
      ([x, z]) => {
        const svg = document.querySelector('.bq-plan-svg') as SVGSVGElement;
        const vb = (svg.getAttribute('viewBox') as string).split(' ').map(Number);
        const r = svg.getBoundingClientRect();
        const scale = Math.min(r.width / vb[2], r.height / vb[3]);
        const ox = (r.width - vb[2] * scale) / 2;
        const oy = (r.height - vb[3] * scale) / 2;
        return { x: r.left + ox + (x - vb[0]) * scale, y: r.top + oy + (z - vb[1]) * scale };
      },
      [mx, mz]
    );
  const a = await at(...from);
  const b = await at(...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
}

test.describe('Faz 2 — dokunarak modelleme', () => {
  test('m02: zincirleme 4 duvar çiz, zincir kendiliğinden kapanır, Kontrol Et geçer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm02', 1);
    await page.getByTestId('tool-wall-btn').click();
    await expect(page.getByTestId('tool-options-bar')).toBeVisible();
    await tapMm(page, 0, 0);
    await expect(page.getByTestId('plan-chain-start')).toBeVisible();
    await tapMm(page, 6000, 0);
    await tapMm(page, 6000, 4000);
    await tapMm(page, 0, 4000);
    await tapMm(page, 0, 0);
    await expect(page.getByTestId('plan-chain-start')).toHaveCount(0);
    await expect(page.getByTestId('object-row-w4')).toBeVisible();
    await expect(page.getByTestId('plan-room-stamp')).toContainText('24.0 m²');
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'faz2-m02-chain.png') });
  });

  test('m17: pencere aracı duvara dokununca yerleşir, seçip sürükleyerek kaydırılır', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm17', 16);
    await page.getByTestId('tool-window-btn').click();
    await tapMm(page, 3000, 0);
    await expect(page.getByTestId('plan-window-win1')).toBeVisible();
    // back to Select, pick the window and drag it along the wall
    await page.getByTestId('tool-select-btn').click();
    await page.getByTestId('object-row-win1').click();
    await dragMm(page, [2999, 0], [1500, 0]);
    await page.getByTestId('object-row-win1').click();
    const offset = await page.getByTestId('prop-input-offset').inputValue();
    expect(Number(offset)).toBeLessThan(2400);
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m03: kapı aracı + yönü çevir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm03', 2);
    await page.getByTestId('tool-door-btn').click();
    await tapMm(page, 3000, 0);
    await expect(page.getByTestId('plan-door-d1')).toBeVisible();
    await page.getByTestId('tool-select-btn').click();
    await page.getByTestId('object-row-d1').click();
    await page.getByTestId('hud-flip-door').click();
    await expect(page.getByTestId('plan-door-d1')).toBeVisible();
  });

  test('m22: oda aracı kapalı alana dokununca oda yerleşir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm22', 21);
    await page.getByTestId('tool-room-btn').click();
    await tapMm(page, 3000, 2000);
    await expect(page.getByTestId('plan-room-r1')).toContainText('24.0 m²');
  });

  test('m10: aks aracı iki dokunuşla aks çizer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm10', 9);
    await page.getByTestId('tool-grid-btn').click();
    await tapMm(page, 0, -1000);
    await tapMm(page, 0, 4900);
    await expect(page.getByTestId('plan-grid-g1')).toBeAttached();
  });

  test('320px: araç çubuğu kaydırılır, yatay taşma yok', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openMission(page, 'm22', 21);
    await page.getByTestId('tool-room-btn').click();
    await expect(page.getByTestId('tool-options-bar')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, 'faz2-320-tools.png') });
  });
});
