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
  const tab = ['tag', 'dimension'].includes(id)
    ? 'annotate'
    : ['section', 'elevation', 'sheet', 'place'].includes(id)
      ? 'view'
      : ['paste', 'mirror'].includes(id)
        ? 'modify'
        : 'architecture';
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
  await page.getByTestId('home-house-bahce-evi').click();
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
  await page.getByTestId('campaign-exit-btn').click();
}

async function playSecondHouse(page: Page) {
  await expect(page.getByTestId('home-house-iki-katli-ev')).toBeEnabled();
  await page.getByTestId('home-house-iki-katli-ev').click();
  await page.getByTestId('campaign-level-1').click();

  await pick(page, 'level');
  await tapAt(page, 0, 3000, true);
  await tapAt(page, 0, 6000, true);
  await finish(page);

  await pick(page, 'wall');
  await page.getByTestId('campaign-draw-rect').click();
  await tapAt(page, 0, 0);
  await tapAt(page, 8000, 6000);
  await expect(page.getByTestId('campaign-goal')).toContainText('iç duvar');
  await pick(page, 'wall');
  await page.getByTestId('campaign-draw-line').click();
  await tapAt(page, 4000, 0);
  await tapAt(page, 4000, 6000);
  await finish(page);

  await pick(page, 'stair');
  await tapAt(page, 700, 700);
  await tapAt(page, 700, 5000);
  await finish(page);

  await pick(page, 'paste');
  await page.getByTestId('campaign-choice-l1').click();
  await expect(page.getByTestId('campaign-view-name')).toContainText('1. Kat');
  await pick(page, 'floor');
  await tapAt(page, 5000, 3000);
  await finish(page);

  await pick(page, 'section');
  await tapAt(page, 1000, -1000);
  await tapAt(page, 1000, 7000);
  await expect(page.getByTestId('campaign-reveal')).toBeVisible();
  await finish(page);

  await pick(page, 'door');
  await tapAt(page, 2500, 0);
  await expect(page.getByTestId('campaign-view-name')).toContainText('1. Kat');
  await pick(page, 'window');
  await tapAt(page, 2000, 0);
  await tapAt(page, 6000, 0);
  await pick(page, 'roof');
  await tapAt(page, 4000, 3000);
  await finish(page);

  await expect(page.getByTestId('campaign-house-done')).toBeVisible();
  await page.getByTestId('campaign-house-back').click();
  await expect(page.getByTestId('campaign-total-stars')).toContainText('18 / 18');
}

test.describe('Bahçe Evi', () => {
  test('tablet: iki ev dokunarak baştan sona oynanır, yıldızlar kaydedilir', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await playWholeHouse(page);
    await expect(page.getByTestId('home-next-house')).toContainText('İki Katlı Ev');
    await playSecondHouse(page);

    // Progress survives a reload and shows on the home screen.
    await page.reload();
    await expect(page.getByTestId('home-total-stars')).toContainText('36');
  });

  test('telefon: sayfa yana taşmaz, oyun baştan sona oynanır', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await freshStart(page);
    await page.getByTestId('home-next-house').click();
    await page.getByTestId('campaign-level-1').click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByTestId('campaign-level-exit').click();
    await page.getByTestId('campaign-exit-btn').click();
    await playWholeHouse(page);
    await playSecondHouse(page);
  });

  test('yanlış komut ikinci yıldızı götürür, iki yanlıştan sonra doğru komut parlar', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await page.getByTestId('home-next-house').click();
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

  test('tablet: Teslim ve İkiz Ev dokunarak baştan sona oynanır', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await freshStart(page);
    await page.evaluate(() => {
      const stars: Record<string, number> = {};
      for (const h of [1, 2]) for (let i = 1; i <= 6; i++) stars[`h${h}-${i}`] = 3;
      window.localStorage.setItem('bimquest.campaign.v1', JSON.stringify({ stars }));
    });
    await page.reload();

    // Teslim
    await expect(page.getByTestId('home-next-house')).toContainText('Teslim');
    await page.getByTestId('home-next-house').click();
    await page.getByTestId('campaign-level-1').click();
    await pick(page, 'dimension');
    await tapAt(page, 0, 3500);
    await tapAt(page, 10000, 3500);
    await expect(page.getByTestId('campaign-goal')).toContainText('derinlik');
    await pick(page, 'dimension');
    await tapAt(page, 5000, 0);
    await tapAt(page, 5000, 7000);
    await expect(page.getByTestId('cmp-dimension')).toHaveCount(2);
    await finish(page);

    await pick(page, 'tag');
    await tapAt(page, 3000, 0);
    await tapAt(page, 3000, 7000);
    await tapAt(page, 8000, 7000);
    await finish(page);

    await pick(page, 'elevation');
    await tapAt(page, 5000, 8200);
    await tapAt(page, 5000, -1200);
    await expect(page.getByTestId('campaign-reveal')).toBeVisible();
    await finish(page);

    await pick(page, 'section');
    await tapAt(page, -1000, 4000);
    await tapAt(page, 11000, 4000);
    await finish(page);

    await pick(page, 'sheet');
    await page.getByTestId('campaign-choice-A3').click();
    await pick(page, 'place');
    await page.getByTestId('campaign-list-sheet').getByRole('button', { name: /Kat Planı/ }).click();
    await page.getByTestId('campaign-list-sheet').getByRole('button', { name: /Güney/ }).click();
    await expect(page.getByTestId('campaign-reveal')).toBeVisible();
    await finish(page);
    await expect(page.getByTestId('campaign-house-done')).toBeVisible();
    await page.getByTestId('campaign-house-back').click();
    await expect(page.getByTestId('campaign-total-stars')).toContainText('15 / 15');
    await page.getByTestId('campaign-exit-btn').click();

    // İkiz Ev
    await expect(page.getByTestId('home-next-house')).toContainText('İkiz Ev');
    await page.getByTestId('home-next-house').click();
    await page.getByTestId('campaign-level-1').click();
    await pick(page, 'wall');
    await page.getByTestId('campaign-draw-rect').click();
    await tapAt(page, 0, 0);
    await tapAt(page, 6000, 8000);
    await pick(page, 'door');
    await tapAt(page, 2000, 0);
    await finish(page);

    await pick(page, 'mirror');
    await tapAt(page, 6000, 4000);
    await finish(page);

    await pick(page, 'floor');
    await tapAt(page, 6000, 4000);
    await pick(page, 'roof');
    await tapAt(page, 6000, 4000);
    await finish(page);

    await pick(page, 'room');
    await tapAt(page, 3000, 4000);
    await tapAt(page, 9000, 4000);
    await pick(page, 'tag');
    await tapAt(page, 3000, 4000);
    await page.getByTestId('campaign-name-A Dairesi').click();
    await tapAt(page, 9000, 4000);
    await page.getByTestId('campaign-name-B Dairesi').click();
    await finish(page);
    await expect(page.getByTestId('campaign-house-done')).toBeVisible();
    await page.getByTestId('campaign-house-back').click();
    await expect(page.getByTestId('campaign-total-stars')).toContainText('12 / 12');
  });
});
