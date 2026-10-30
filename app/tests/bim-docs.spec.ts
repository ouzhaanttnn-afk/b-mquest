import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
    if (!window.localStorage.getItem('bimquest.meta.v1')) {
      window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true, announced: [] }));
    }
  });
});

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

const mmToPage = (page: Page, x: number, z: number) =>
  page.evaluate(
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

async function tapMm(page: Page, x: number, z: number) {
  const p = await mmToPage(page, x, z);
  await page.mouse.click(p.x, p.y);
}

test.describe('Faz 4 — görünümler ve dokümantasyon', () => {
  test('m31: kesit çiz, Proje Tarayıcısı’ndan aç, çizim modelden gelir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm31', 30);
    await page.getByTestId('tool-section-btn').click();
    await tapMm(page, 0, 2000);
    await tapMm(page, 6000, 2000);
    await expect(page.getByTestId('plan-section-v1')).toBeAttached();
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('view-open-v1').click();
    await expect(page.getByTestId('view-drawing')).toBeVisible();
    await expect(page.getByTestId('view-pane-title')).toContainText('Kesit 1');
    await page.screenshot({ path: path.join(SHOTS, 'faz4-section.png') });
    await page.getByTestId('view-back-btn').click();
    await expect(page.getByTestId('plan-viewport')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m32: cephe yön işaretiyle eklenir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm32', 31);
    await page.getByTestId('tool-elevation-btn').click();
    await page.getByTestId('tool-elev-S').click();
    await expect(page.getByTestId('plan-elevation-v1')).toBeAttached();
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('view-open-v1').click();
    await expect(page.getByTestId('view-drawing')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m34 + m35: ölçü iki duvara dokunarak, etiket dokunarak', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm34', 33);
    await page.getByTestId('tool-dimension-btn').click();
    await tapMm(page, 3000, 0);
    await tapMm(page, 3000, 4000);
    await expect(page.getByTestId('plan-dimension-value-dim1')).toHaveText('4000');
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();

    await openMission(page, 'm35', 34);
    await page.getByTestId('tool-tag-btn').click();
    await tapMm(page, 600 + 450, 0);
    await tapMm(page, 3200 + 600, 0);
    await tapMm(page, 3000, 2000);
    await expect(page.getByTestId('plan-tag-tg1')).toBeAttached();
    await expect(page.getByTestId('plan-tag-tg2')).toBeAttached();
    await expect(page.getByTestId('plan-tag-tg3')).toBeAttached();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m36 + m37: pafta oluştur, adlandır; plan + kesit yerleştir, PNG', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm36', 35);
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('add-sheet-btn').click();
    await page.getByTestId('sheet-open-sh1').click();
    await page.getByTestId('sheet-name-input').fill('Zemin Kat Planı');
    await page.getByTestId('sheet-name-input').blur();
    await expect(page.getByTestId('sheet-title-name')).toHaveText('Zemin Kat Planı');
    await expect(page.getByTestId('sheet-title-number')).toHaveText('A-101');
    await page.getByTestId('close-sheet-editor-btn').click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();

    await openMission(page, 'm37', 36);
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('sheet-open-sh1').click();
    await page.getByTestId('place-view-v1').click();
    await page.getByTestId('place-view-v2').click();
    await expect(page.getByTestId('sheet-view-v1')).toBeAttached();
    await expect(page.getByTestId('sheet-view-v2')).toBeAttached();
    await page.screenshot({ path: path.join(SHOTS, 'faz4-sheet.png') });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-sheet-png-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/A-101.*\.png$/);
    await page.getByTestId('close-sheet-editor-btn').click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m33: kadraj açılır ve köşe tutamağı sürüklenir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm33', 32);
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('view-open-v1').click();
    await page.getByTestId('object-row-v1').click();
    await page.getByTestId('toggle-crop-btn').click();
    await expect(page.getByTestId('plan-crop-region')).toBeAttached();
    const from = await mmToPage(page, -500, -500);
    const to = await mmToPage(page, 3000, 0);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByTestId('prop-input-cropMinX')).toHaveValue('3000');
  });

  test('m30: Kesme düzlemi pencere sembolünü etkiler', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm30', 29);
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('view-open-v1').click();
    await expect(page.locator('[data-testid="plan-window-win1"] g[data-cut="no"]')).toBeAttached();
    await page.getByTestId('object-row-v1').click();
    for (let i = 0; i < 9; i++) await page.getByTestId('prop-input-cutHeight-step-100').click();
    await expect(page.locator('[data-testid="plan-window-win1"] g[data-cut="yes"]')).toBeAttached();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('320px: görünüm ve pafta ekranları taşmaz', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openMission(page, 'm37', 36);
    await page.getByTestId('project-browser-btn').click();
    await page.getByTestId('sheet-open-sh1').click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, 'faz4-320-sheet.png') });
  });
});
