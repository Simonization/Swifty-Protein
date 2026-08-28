const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.getByPlaceholder('e.g. rodolfo').fill('demo');
  await page.getByPlaceholder('••••••••').fill('demopass123');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForTimeout(2000);

  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1000);
  }

  // Go to Settings, switch to light, save.
  await page.screenshot({ path: '/tmp/screenshots/debug-before-settings.png' });
  await page.getByLabel('Settings').click();
  await page.waitForTimeout(800);
  await page.getByRole('switch', { name: 'Dark mode' }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: '/tmp/screenshots/web-ligand-list-light.png' });

  await page.getByPlaceholder('Search ligands…').fill('ATP');
  await page.waitForTimeout(500);
  await page.getByText('ATP', { exact: true }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/screenshots/web-viewer-light.png' });

  await browser.close();
  console.log('Done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
