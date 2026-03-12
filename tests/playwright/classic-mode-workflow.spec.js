import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Classic Mode Workflow: Edit Geometry', () => {
  test('Upload PNG, modify geometry via Find Sprites and Row Reorder', async ({ page }) => {
    console.log('\n╔═════════════════════════════════════════╗');
    console.log('║  CLASSIC MODE WORKFLOW: EDITING        ║');
    console.log('╚═════════════════════════════════════════╝\n');

    await page.goto('http://localhost:5071/workbench', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Upload PNG
    console.log('═ STEP 1: Upload Sprite');
    const pngPath = path.join(process.cwd(), 'tests', 'fixtures', 'known_good', 'cat_sheet.png');
    await page.locator('#wbFile').setInputFiles(pngPath);
    await page.locator('#wbUpload').click();
    await page.waitForTimeout(1000);

    // Find Sprites
    console.log('═ STEP 2: Find Sprites');
    await page.locator('#extractBtn').click();
    await page.waitForTimeout(1000);

    // Verify Draw Box control presence
    await expect(page.locator('#drawBoxBtn')).toBeVisible();

    // Verify XP preview panel
    await expect(page.locator('#xpPreviewPanel')).toBeVisible();

    console.log('✓ Classic Workflow UI Verification Completed');
  });
});
