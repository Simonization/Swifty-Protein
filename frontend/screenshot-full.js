const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.getByPlaceholder('e.g. rodolfo').fill('demo');
  await page.getByPlaceholder('••••••••').fill('demopass123');
  await page.getByRole('button', { name: 'Log In' }).click();
  await page.waitForTimeout(2000);

  // First-run onboarding tour — skip it.
  const skip = page.getByText('Skip', { exact: true });
  if (await skip.isVisible().catch(() => false)) {
    await skip.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: '/tmp/screenshots/web-ligand-list-dark.png' });

  await page.getByPlaceholder('Search ligands…').fill('ATP');
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/screenshots/web-search-dark.png' });

  await page.getByText('ATP', { exact: true }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/screenshots/web-viewer-dark.png' });

  await browser.close();
  console.log('Done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
