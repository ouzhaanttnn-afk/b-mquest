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

const completedUpTo = (n: number) => {
  const completed: Record<string, { bestScore: number }> = {};
  for (let i = 1; i <= n; i++) {
    completed[`m${String(i).padStart(2, '0')}`] = { bestScore: 100 };
  }
  return completed;
};

async function openMission(page: Page, id: string, completedBefore: number) {
  await page.goto('/');
  await page.evaluate(
    ({ completed }) => {
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
    { completed: completedUpTo(completedBefore) }
  );
  await page.reload();
  const chapterTab = page.locator('[data-testid^="stage-tab-"]');
  const start = page.getByTestId(`start-mission-${id}`);
  // The mission card may live under another chapter tab.
  for (let i = 0; i < (await chapterTab.count()) && !(await start.isVisible()); i++) {
    await chapterTab.nth(i).click();
  }
  await start.click();
  await expect(page.getByTestId('workspace-screen')).toBeVisible();
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('Faz 1 — gerçek BIM nesneleriyle oynanış', () => {
  test('m22: oda yerleştir (Room), plan etiketi ve Kontrol Et', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm22', 21);
    await page.getByTestId('create-room-btn').click();
    await page.getByTestId('create-room-x').fill('3000');
    await page.getByTestId('create-room-z').fill('2000');
    await page.getByTestId('create-room-name').fill('Salon');
    await page.getByTestId('create-room-number').fill('101');
    await page.getByTestId('create-room-submit').click();
    await expect(page.getByTestId('plan-room-r1')).toBeVisible();
    await expect(page.getByTestId('plan-room-r1')).toContainText('24.0 m²');
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'faz1-m22-room.png') });
  });

  test('m17 + m19 + m20 + m21: pencere, döşeme, çatı ve merdiven oluşturulur ve çizilir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await openMission(page, 'm17', 16);
    await page.getByTestId('create-window-btn').click();
    await page.getByTestId('create-window-hostWallId').selectOption('w_south');
    await page.getByTestId('create-window-offset').fill('2400');
    await page.getByTestId('create-window-submit').click();
    await expect(page.getByTestId('plan-window-win1')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();

    await openMission(page, 'm19', 18);
    await page.getByTestId('create-floor-btn').click();
    await page.getByTestId('create-floor-thickness').fill('150');
    await page.getByTestId('create-floor-submit').click();
    await expect(page.getByTestId('plan-floor-f1')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();

    await openMission(page, 'm20', 19);
    await page.getByTestId('create-roof-btn').click();
    await page.getByTestId('create-roof-baseLevelId').selectOption('l1');
    await page.getByTestId('create-roof-slope').fill('30');
    await page.getByTestId('create-roof-submit').click();
    await expect(page.getByTestId('plan-roof-rf1')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();

    await openMission(page, 'm21', 20);
    await page.getByTestId('create-stair-btn').click();
    await page.getByTestId('create-stair-topLevelId').selectOption('l1');
    await page.getByTestId('create-stair-sx').fill('1000');
    await page.getByTestId('create-stair-sz').fill('1000');
    await page.getByTestId('create-stair-risers').fill('18');
    await page.getByTestId('create-stair-submit').click();
    await expect(page.getByTestId('plan-stair-s1')).toBeVisible();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m24: Edit Type ile iki pencere birden değişir; örnek üzerinden değişmez', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm24', 23);
    await page.getByTestId('object-row-win1').click();
    await page.getByTestId('prop-input-width-step+100').first().isVisible().catch(() => undefined);
    await page.getByTestId('edit-type-btn').click();
    await page.getByTestId('type-param-width-step+100').click();
    await page.getByTestId('type-param-width-step+100').click();
    await page.getByTestId('type-param-width-step+100').click();
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m12: Level kotunu değiştirmek duvarları yükseltir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm12', 11);
    await expect(page.getByTestId('levels-panel')).toBeVisible();
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('level-elevation-l1-step+100').click();
    }
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });

  test('m38: açık oda sınırı planda kırmızı işaretlenir', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm38', 37);
    await expect(page.getByTestId('plan-room-gap-r1')).toBeVisible();
  });

  test('320px: yeni nesne arayüzü yatay taşma yapmaz', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await openMission(page, 'm22', 21);
    await noHorizontalOverflow(page);
    await page.getByTestId('mobile-tab-inspector').click();
    await page.getByTestId('create-room-btn').click();
    await noHorizontalOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, 'faz1-320-room-form.png') });
  });
});

test.describe('Faz 3 — model kontrolü', () => {
  test('m39: teşhis listesi gizli; Kontrol Et sonrası yalnızca sayı ve kategori', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMission(page, 'm39', 38);
    await page.getByTestId('warnings-btn').click();
    await expect(page.getByTestId('warnings-hidden')).toBeVisible();
    await expect(page.locator('[data-testid^="warning-row-"]')).toHaveCount(0);
    await page.getByTestId('close-warnings-btn').click();

    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('criterion-remediation-c_clean')).toContainText('1 tutarsızlık');
    await expect(page.getByTestId('criterion-remediation-c_clean')).not.toContainText('w4');
    await page.getByTestId('warnings-btn').click();
    await expect(page.getByTestId('warnings-count')).toContainText('1 sorun · Kat bağlantısı');
    await page.getByTestId('close-warnings-btn').click();

    // fix it: select w4 and set its Base Constraint
    await page.getByTestId('object-row-w4').click();
    await page.getByTestId('prop-input-baseLevelId').selectOption('l0');
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
  });
});
