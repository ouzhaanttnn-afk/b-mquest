import { expect, test, type Page } from '@playwright/test';

/** Plays the Bahçe Evi campaign by tapping the drawing like a player. */

async function freshStart(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.sessionStorage.setItem('bimquest.titleSeen.v1', '1');
    window.localStorage.setItem('bimquest.meta.v1', JSON.stringify({ introDone: true }));
    window.localStorage.setItem('bimquest.soundMuted.v1', 'true');
  });
  await page.reload();
}

async function tapAt(page: Page, x: number, z: number, elevation = false) {
  const pt = await page.evaluate(
    ([x, z, elevation]) => {
      const svg = document.querySelector(
        elevation ? '[data-testid=cmp-elevation]' : '[data-testid=cmp-plan]'
      ) as SVGSVGElement;
      const q = new DOMPoint(x as number, elevation ? -(z as number) : (z as number)).matrixTransform(svg.getScreenCTM()!);
      return [q.x, q.y];
    },
    [x, z, elevation] as const
  );
  await page.mouse.click(pt[0], pt[1]);
}

async function pick(page: Page, id: string) {
  const tab = id === 'tag' ? 'annotate' : 'architecture';
  const tabBtn = page.getByTestId(`campaign-tab-${tab}`);
  if ((await tabBtn.getAttribute('aria-selected')) !== 'true') await tabBtn.click();
  await page.getByTestId(`campaign-cmd-${id}`).click();
}

async function finish(page: Page, stars = 3) {
  await expect(page.getByTestId('campaign-level-done')).toBeVisible();
  await expect(page.getByTestId('campaign-stars')).toHaveAttribute('data-stars', String(stars));
  await page.getByTestId('campaign-next').click();
}

async function playWholeHouse(page: Page) {
  await page.getByTestId('campaign-card').click();
  await expect(page.getByTestId('campaign-hub')).toBeVisible();
  await expect(page.getByTestId('campaign-level-2')).toBeDisabled();
  await page.getByTestId('campaign-level-1').click();

  await pick(page, 'level');
  await tapAt(page, 0, 3000, true);
  await finish(page);

  await pick(page, 'grid');
  for (const [a, b] of [
    [[0, -1000], [0, 8000]],
    [[10000, -1000], [10000, 8000]],
    [[-1000, 0], [11000, 0]],
    [[-1000, 7000], [11000, 7000]],
  ] as Array<[[number, number], [number, number]]>) {
    await tapAt(page, ...a);
    await tapAt(page, ...b);
  }
  await finish(page);

  await pick(page, 'wall');
  for (const q of [[0, 0], [10000, 0], [10000, 7000], [0, 7000], [0, 0], [6000, 0], [6000, 7000]] as Array<[number, number]>) {
    await tapAt(page, ...q);
  }
  await finish(page);

  await pick(page, 'door');
  await tapAt(page, 3000, 0);
  await expect(page.getByTestId('campaign-goal')).toContainText('pencere');
  await pick(page, 'window');
  await tapAt(page, 3000, 7000);
  await tapAt(page, 8000, 7000);
  await finish(page);

  await pick(page, 'floor');
  await tapAt(page, 5000, 3500);
  await expect(page.getByTestId('campaign-goal')).toContainText('çatı');
  await pick(page, 'roof');
  await tapAt(page, 5000, 3500);
  await finish(page);

  await pick(page, 'room');
  await tapAt(page, 3000, 3500);
  await tapAt(page, 8000, 3500);
  await expect(page.getByTestId('campaign-goal')).toContainText('etiketle');
  await pick(page, 'tag');
  await tapAt(page, 3000, 3500);
  await page.getByTestId('campaign-name-Salon').click();
  await tapAt(page, 8000, 3500);
  await page.getByTestId('campaign-name-Yatak Odası').click();
  await finish(page);

  await expect(page.getByTestId('campaign-house-done')).toBeVisible();
  await page.getByTestId('campaign-house-back').click();
  await expect(page.getByTestId('campaign-total-stars')).toContainText('18 / 18');
}

test.describe('Bahçe Evi', () => {
  test('tablet: altı bölüm dokunarak oynanır, yıldızlar kaydedilir', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await playWholeHouse(page);

    // Progress survives a reload and shows on the home card.
    await page.reload();
    await expect(page.getByTestId('campaign-card')).toContainText('18/18');
  });

  test('telefon: sayfa yana taşmaz, oyun baştan sona oynanır', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await freshStart(page);
    await page.getByTestId('campaign-card').click();
    await page.getByTestId('campaign-level-1').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByTestId('campaign-level-exit').click();
    await page.getByTestId('campaign-exit-btn').click();
    await playWholeHouse(page);
  });

  test('yanlış komut ikinci yıldızı götürür, iki yanlıştan sonra doğru komut parlar', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await page.getByTestId('campaign-card').click();
    await page.getByTestId('campaign-level-1').click();

    // Tapping the drawing before choosing a command asks for one.
    await tapAt(page, 0, 3000, true);
    await expect(page.getByTestId('campaign-toast')).toContainText('komutu seç');

    await page.getByTestId('campaign-cmd-wall').click();
    await page.getByTestId('campaign-cmd-door').click();
    await expect(page.getByTestId('campaign-cmd-level')).toHaveClass(/hint/);

    await page.getByTestId('campaign-why-btn').click();
    await expect(page.getByTestId('campaign-why')).toContainText('Level');
    await page.getByTestId('campaign-why').getByRole('button').click();

    await pick(page, 'level');
    await tapAt(page, 0, 3000, true);
    await expect(page.getByTestId('campaign-level-done')).toContainText('Architecture › Datum › Level');
    await expect(page.getByTestId('campaign-stars')).toHaveAttribute('data-stars', '2');
  });
});
