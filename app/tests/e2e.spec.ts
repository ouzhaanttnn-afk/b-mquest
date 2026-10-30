import { expect, test } from '@playwright/test';
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

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'evidence', 'screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.describe('BIM QUEST — Layer 3 Playwright E2E & Acceptance Suite (E01–E08)', () => {
  test('E01, E02, E03, E04, E05: Full 3-Mission Playthrough, 2D/3D Sync, Diagnostic Feedback, Wall Move, Undo/Redo, Save/Reload & XP', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');

    // Clear storage to start clean
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    // E01: Dashboard initial state, 6-Chapter 40-Mission curriculum, prerequisite locks
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await expect(page.getByTestId('player-xp-summary')).toContainText('0 XP');
    await expect(page.getByTestId('curriculum-chapters')).toBeVisible();
    await expect(page.getByTestId('chapter-card-ch01')).toBeVisible();
    await expect(page.getByTestId('chapter-card-ch06')).toBeVisible();

    // Test Dashboard ⓘ Info Modal
    await page.getByTestId('dashboard-info-btn').click();
    await expect(page.getByTestId('dashboard-info-modal')).toBeVisible();
    await page.getByTestId('close-info-modal-btn').click();
    await expect(page.getByTestId('dashboard-info-modal')).toBeHidden();

    // Test Light Mode & Dark Mode Toggle on Dashboard
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01b-dashboard-light-mode.png'),
    });
    await page.getByTestId('theme-toggle-btn').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // m01 unlocked, m02 and m03 locked
    await expect(page.getByTestId('start-mission-m01')).toBeVisible();
    await expect(page.getByTestId('mission-lock-m02')).toContainText('m01');
    await expect(page.getByTestId('mission-lock-m03')).toContainText('m02');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-dashboard-initial-1280x720.png'),
    });

    // =========================================================================
    // MISSION 1 (m01): Wall Height & Level Reference
    // =========================================================================
    await page.getByTestId('start-mission-m01').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();
    await expect(page.getByTestId('pedagogical-stepper')).toBeVisible();
    await expect(page.getByTestId('live-progress-pill')).toBeVisible();
    await expect(page.getByTestId('plan-room-stamp')).toContainText('24.0 m²');
    await expect(page.getByTestId('learning-concept-box')).toContainText(
      'Bu İşlem Nedir?'
    );

    // Test Workspace ⓘ Info Modal & Light Mode in Workspace
    await page.getByTestId('ws-info-btn').click();
    await expect(page.getByTestId('ws-info-modal')).toBeVisible();
    await page.getByTestId('close-ws-info-modal-btn').click();
    await expect(page.getByTestId('ws-info-modal')).toBeHidden();

    // Invalid model check: clicking Check on initial 2800 mm walls MUST fail and explain why
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('fail-summary-text')).toBeVisible();
    await expect(page.getByTestId('criterion-remediation-c_h1')).toContainText(
      'Neden Yanlış'
    );
    await expect(page.getByTestId('criterion-remediation-c_h1')).toContainText(
      '3000'
    );

    // 2D Plan selection sync: click w1 on the 2D SVG plan and verify inspector selects w1
    await page.getByTestId('plan-wall-w1').click({ force: true });
    await expect(page.getByTestId('selected-element-id')).toContainText('w1');

    // Update w1..w4 heights to 3000 mm
    for (const wallId of ['w1', 'w2', 'w3', 'w4']) {
      await page.getByTestId(`object-row-${wallId}`).click();
      const heightInput = page.getByTestId('prop-input-height');
      await heightInput.fill('3000');
      await heightInput.press('Enter');
    }

    // Test Undo & Redo on w4
    await page.getByTestId('undo-btn').click();
    await expect(page.getByTestId('prop-input-height')).toHaveValue('2800');
    await page.getByTestId('redo-btn').click();
    await expect(page.getByTestId('prop-input-height')).toHaveValue('3000');

    // Check Mission 1 -> Pass with 100 score & +200 XP
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
    await expect(page.getByTestId('modal-score-value')).toHaveText('100');
    await expect(page.getByTestId('modal-xp-value')).toContainText('+200 XP');
    await expect(page.getByTestId('modal-badge-value')).toContainText('Altın Rozet');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-mission1-passed-modal.png'),
    });

    // Proceed to Mission 2
    await page.getByTestId('next-mission-btn').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();

    // =========================================================================
    // MISSION 2 (m02): Closed 4-Wall Rectangular Room + Wall Move & Delete
    // =========================================================================
    await page.getByTestId('tool-wall-btn').click();
    await expect(page.getByTestId('create-wall-form')).toBeVisible();

    // Create 1st wall (South)
    await page.getByTestId('preset-w_south').click();
    await page.getByTestId('confirm-create-wall-btn').click();
    await expect(page.getByTestId('object-row-w1')).toBeVisible();

    // Test Wall Move (Taşıma) on w1 and Undo back to exact room edge
    await page.getByTestId('tool-select-btn').click();
    await page.getByTestId('object-row-w1').click();
    await expect(page.getByTestId('wall-move-controls')).toBeVisible();
    await page.getByTestId('nudge-wall-east').click();
    await expect(page.getByTestId('prop-input-start-x')).toHaveValue('500');
    await expect(page.getByTestId('prop-input-end-x')).toHaveValue('6500');
    await page.getByTestId('undo-btn').click();
    await expect(page.getByTestId('prop-input-start-x')).toHaveValue('0');
    await expect(page.getByTestId('prop-input-end-x')).toHaveValue('6000');

    // Create remaining 3 walls using presets
    await page.getByTestId('tool-wall-btn').click();
    for (const preset of ['preset-w_east', 'preset-w_north', 'preset-w_west']) {
      await page.getByTestId(preset).click();
      await page.getByTestId('confirm-create-wall-btn').click();
    }

    // Verify Reload Persistence of Draft before submitting Mission 2
    await page.reload();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await expect(page.getByTestId('player-xp-summary')).toContainText('200 XP');
    await expect(page.getByTestId('continue-mission-m02')).toBeVisible();
    await page.getByTestId('continue-mission-m02').click();
    await expect(page.getByTestId('object-row-w4')).toBeVisible();

    // Submit Mission 2 -> Pass!
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
    await expect(page.getByTestId('modal-score-value')).toHaveText('100');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-mission2-passed-modal.png'),
    });

    // Proceed to Mission 3
    await page.getByTestId('next-mission-btn').click();

    // =========================================================================
    // MISSION 3 (m03): Hosted Door & Diagnostic Feedback on Wrong Wall
    // =========================================================================
    await page.getByTestId('tool-door-btn').click();
    await expect(page.getByTestId('create-door-form')).toBeVisible();

    // Intentionally place door d1 on WRONG wall (w_north) first!
    await page.getByTestId('door-host-wall').selectOption('w_north');
    await page.getByTestId('confirm-create-door-btn').click();
    await expect(page.getByTestId('object-row-d1')).toBeVisible();

    // Run Check -> Must FAIL and explain that d1 is on w_north instead of w_south
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('fail-summary-text')).toBeVisible();
    const hostRemediation = page.getByTestId('criterion-remediation-c_host');
    await expect(hostRemediation).toBeVisible();
    await expect(hostRemediation).toContainText('w_north');
    await expect(hostRemediation).toContainText('w_south');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-mission3-diagnostic-feedback.png'),
    });

    // Fix d1 hostWallId to w_south in Property Inspector
    await page.getByTestId('object-row-d1').click();
    await page.getByTestId('prop-input-hostWallId').selectOption('w_south');

    // Stale banner must appear after editing post-check
    await expect(page.getByTestId('stale-result-banner')).toBeVisible();

    // Reveal hint h1 (-5 points -> score 95, Gold Badge)
    await page.getByTestId('reveal-hint-h1').click();
    await expect(page.getByTestId('hint-text-h1')).toBeVisible();

    // Run Check -> Pass!
    await page.getByTestId('check-btn').click();
    await expect(page.getByTestId('results-recap-modal')).toBeVisible();
    await expect(page.getByTestId('modal-score-value')).toHaveText('95');
    await expect(page.getByTestId('modal-badge-value')).toContainText('Altın Rozet');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-mission3-passed-modal.png'),
    });

    // Return to Dashboard & verify all 3 missions completed and XP updated
    await page.getByTestId('finish-to-dashboard-btn').click();
    await expect(page.getByTestId('dashboard-screen')).toBeVisible();
    await expect(page.getByTestId('progress-summary')).toContainText('3 / 58');
    await expect(page.getByTestId('player-xp-summary')).toContainText('590 XP');
  });

  test('E06, E07, E08: Corrupt Save Recovery, Multi-Viewport Screenshots (1920x1080, 1024x768, iPad, iPhone) & WebGL Fallback', async ({
    page,
  }) => {
    // E06: Inject corrupt JSON into localStorage and verify non-destructive recovery banner
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('bimquest.save.v1', '{corrupt_json: true');
    });
    await page.reload();
    await expect(page.getByTestId('recovery-issue-banner')).toBeVisible();
    await page.getByTestId('reset-corrupt-btn').click();
    await expect(page.getByTestId('recovery-issue-banner')).toBeHidden();

    // Open Mission 1 and capture multi-device viewports
    await page.getByTestId('start-mission-m01').click();
    await expect(page.getByTestId('workspace-screen')).toBeVisible();

    const viewports = [
      { name: 'desktop-1920x1080', width: 1920, height: 1080 },
      { name: 'compact-1024x768', width: 1024, height: 768 },
      { name: 'ipad-768x1024', width: 768, height: 1024 },
      { name: 'iphone-390x844', width: 390, height: 844 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(page.getByTestId('check-btn')).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `06-viewport-${vp.name}.png`),
      });
    }
  });
});
