const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Reach Settings without logging in, via the login screen's server-address link.
  await page.getByText("Can’t connect? Set the server address").click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/screenshots/web-settings-dark.png' });

  // Flip "Dark mode".
  const darkSwitch = page.getByRole('switch', { name: 'Dark mode' });
  await darkSwitch.click();
  await page.waitForTimeout(500);

  // Save.
  await page.getByRole('button', { name: 'Save' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/screenshots/web-after-toggle-light.png' });

  await browser.close();
  console.log('Done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
