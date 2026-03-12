import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Bundle Mode Workflow: Player Full Skin', () => {
  test('Create bundle, upload idle/attack/death sprites, and run', async ({ page }) => {
    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║  BUNDLE MODE WORKFLOW: MULTI-ACTION    ║');
    console.log('╚═════════════════════════════════════════╝\n');

    await page.goto('http://localhost:5071/workbench', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // 1. Select Bundle Template
    console.log('═ STEP 1: Select Player Skin (Full Bundle)');
    await page.locator('#templateSelect').selectOption('player_native_full');
    await page.locator('#templateApplyBtn').click();
    await page.waitForTimeout(1500);

    const idleTab = page.locator('#bundleActionTabs button:has-text("Idle")');
    const attackTab = page.locator('#bundleActionTabs button:has-text("Attack")');
    const deathTab = page.locator('#bundleActionTabs button:has-text("Death")');

    await expect(idleTab).toBeVisible();
    await expect(attackTab).toBeVisible();
    await expect(deathTab).toBeVisible();

    // Setup PNG Paths (assuming they exist or fallback to generic)
    const getPngPath = (name) => {
      const p = path.join(process.cwd(), 'fixtures', name);
      return fs.existsSync(p) ? p : path.join(process.cwd(), 'tests', 'fixtures', 'known_good', 'cat_sheet.png');
    };

    // 2. Upload Idle
    console.log('═ STEP 2: Upload Idle Sprite');
    await idleTab.click();
    await page.waitForTimeout(500);
    await page.locator('#wbFile').setInputFiles(getPngPath('player-sprite.png'));
    await page.locator('#wbUpload').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbAnalyze').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbRun').click();
    await page.waitForTimeout(2000);

    // 3. Upload Attack
    console.log('═ STEP 3: Upload Attack Sprite');
    await attackTab.click();
    await page.waitForTimeout(500);
    await page.locator('#wbFile').setInputFiles(getPngPath('attack-sprite.png'));
    await page.locator('#wbUpload').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbAnalyze').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbRun').click();
    await page.waitForTimeout(2000);

    // 4. Upload Death
    console.log('═ STEP 4: Upload Death Sprite');
    await deathTab.click();
    await page.waitForTimeout(500);
    await page.locator('#wbFile').setInputFiles(getPngPath('death-sprite.png'));
    await page.locator('#wbUpload').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbAnalyze').click();
    await page.waitForTimeout(1000);
    await page.locator('#wbRun').click();
    await page.waitForTimeout(2000);

    // 5. Test Skin in Runtime
    console.log('═ STEP 5: Test Bundle Skin');
    const testSkinBtn = page.locator('#webbuildQuickTestBtn');
    await testSkinBtn.click();
    await page.waitForTimeout(5000); // let it load

    console.log('✓ Bundle Workflow Completed');
  });
});
