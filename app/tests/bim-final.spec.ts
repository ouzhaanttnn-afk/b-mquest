import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
  });
});

const SHOTS = path.resolve(process.cwd(), 'evidence', 'screenshots');
test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

const golden = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'tests', 'golden', 'golden-house.json'), 'utf8')
);

async function openWithCarry(page: Page, id: string, lastDone: number, carriedModel: unknown) {
  await page.goto('/');
  await page.evaluate(
    ([n, model]) => {
      const completed: Record<string, unknown> = {};
      for (let i = 1; i <= (n as number); i++) {
        const key = `m${String(i).padStart(2, '0')}`;
        completed[key] = { bestScore: 100, ...(i === n ? { model } : {}) };
      }
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
    },
    [lastDone, carriedModel] as const
  );
  await page.reload();
  const tabs = page.locator('[data-testid^="stage-tab-"]');
  const start = page.getByTestId(`start-mission-${id}`);
  for (let i = 0; i < (await tabs.count()) && !(await start.isVisible()); i++) {
    await tabs.nth(i).click();
  }
  await start.click();
  await expect(page.getByTestId('workspace-screen')).toBeVisible();
}

test.describe('Faz 5 — final proje', () => {
  test('m50: önceki aşamanın modeli taşınır, teslim ekranı kriter tablosunu ve paftayı gösterir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openWithCarry(page, 'm50', 49, golden);
    // The carried house is already on screen (carry-over).
    await expect(page.getByTestId('object-row-w5')).toBeVisible();
    await expect(page.getByTestId('mission-objective-text')).not.toContainText('→');
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('project-delivery-modal')).toBeVisible();
    await expect(page.getByTestId('delivery-sheet')).toBeVisible();
    await expect(page.getByTestId('delivery-criteria-table')).toContainText('Revit:');
    await expect(page.getByTestId('delivery-row-c_clean')).toContainText('✓');
    await page.screenshot({ path: path.join(SHOTS, 'faz5-delivery.png'), fullPage: true });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('delivery-export-btn').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);
  });

  test('m49: modeldeki tutarsızlık yalnızca sayı ve kategoriyle bildirilir (teşhis gizli)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const broken = JSON.parse(JSON.stringify(golden));
    broken.elements = broken.elements.filter((e: { id: string }) => e.id !== 'r2' && e.id !== 'tg7');
    const r1 = broken.elements.find((e: { id: string }) => e.id === 'r1');
    r1.number = '';
    await openWithCarry(page, 'm49', 48, broken);
    await page.getByTestId('check-btn').click();
    const remediation = page.getByTestId('criterion-remediation-c_clean');
    await expect(remediation).toContainText('tutarsızlık');
    await expect(remediation).not.toContainText('r1');
    await page.getByTestId('warnings-btn').click();
    await expect(page.getByTestId('warnings-count')).toContainText('Oda');
    await expect(page.locator('[data-testid^="warning-row-"]')).toHaveCount(0);
  });

  test('m46: kabuğu taşıyan başlangıç, brif yolu göstermeden oyuncuya bırakır', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openWithCarry(page, 'm46', 45, { levels: golden.levels, elements: golden.elements.filter((e: { type: string; id: string }) => ['wall', 'floor', 'roof', 'grid'].includes(e.type) && e.id !== 'w5') });
    await expect(page.getByTestId('object-row-w4')).toBeVisible();
    await expect(page.getByTestId('tool-room-btn')).toBeVisible(); // everything is creatable in the final project
    await expect(page.getByTestId('learning-concept-box')).not.toContainText('Architecture');
  });
});
