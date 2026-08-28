const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
  page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[pageerror]', err.message));
  page.on('requestfailed', (req) => console.log('[requestfailed]', req.url(), req.failure()?.errorText));
  page.on('response', (res) => { if (!res.ok()) console.log('[response]', res.status(), res.url()); });

  await page.goto('http://localhost:8081', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(4000);
  const html = await page.content();
  console.log('--- body length ---', html.length);
  console.log('--- body snippet ---', html.slice(0, 800));
  await page.screenshot({ path: '/tmp/screenshots/web-diag.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
