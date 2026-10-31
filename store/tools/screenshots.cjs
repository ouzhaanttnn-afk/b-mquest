// Generates App Store screenshots from the built web app.
// Usage (from app/): npm run build && node ../store/tools/screenshots.cjs
// Needs Playwright and a Chromium: set CHROMIUM=/path if the default is missing.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');

const OUT = path.resolve(__dirname, '..', 'screenshots');
const PORT = 4179;
const SIZES = [
  { name: 'iphone-6.9', w: 440, h: 956, dsf: 3 }, // 1320 x 2868
  { name: 'ipad-13', w: 1032, h: 1376, dsf: 2 }, // 2064 x 2752
];

const completed = {};
for (let i = 1; i <= 12; i++) completed[`m${String(i).padStart(2, '0')}`] = { bestScore: i % 3 === 0 ? 100 : 92 };

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: path.resolve(__dirname, '..', '..', 'app'),
    stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 3500));
  const browser = await chromium.launch(
    process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}
  );
  try {
    for (const size of SIZES) {
      const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        deviceScaleFactor: size.dsf,
        hasTouch: true,
        isMobile: size.name.startsWith('iphone'),
      });
      const page = await ctx.newPage();
      await page.addInitScript((save) => {
        window.localStorage.setItem('bimquest.save.v1', JSON.stringify(save));
        window.localStorage.setItem(
          'bimquest.meta.v1',
          JSON.stringify({ introDone: true, announced: ['first-mission','ten-missions','perfect','chapter-1','chapter-2','level-5','half-way','five-gold'], streak: 4, bestStreak: 4, lastPlayDay: new Date().toISOString().slice(0, 10) })
        );
      }, { saveVersion: 1, contentVersion: '1.0.0', completed, drafts: {}, settings: { sound: false, reducedMotion: true } });
      const shot = (n) => page.screenshot({ path: path.join(OUT, `${size.name}-${n}.png`) });

      await page.goto(`http://127.0.0.1:${PORT}/`);
      await page.waitForTimeout(2200);
      await shot('1-title');
      await page.getByTestId('title-play-btn').click();
      await page.waitForTimeout(600);
      await shot('2-missions');
      await page.getByTestId('start-mission-m01').click();
      await page.waitForTimeout(1500);
      await page.getByTestId('view-mode-split').click().catch(() => {});
      await page.waitForTimeout(2500);
      await shot('3-workspace');
      await page.getByTestId('view-mode-3d').click();
      await page.waitForTimeout(2500);
      await shot('4-3d');
      await page.getByTestId('back-dashboard-btn').click();
      await page.waitForTimeout(400);
      await page.getByTestId('help-btn').click();
      await page.getByTestId('help-search').fill('level');
      await page.waitForTimeout(400);
      await shot('5-glossary');
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
})();
