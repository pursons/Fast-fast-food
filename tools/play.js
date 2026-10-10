// Test headless : charge le jeu, démarre une partie, capture erreurs + screenshot
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://localhost:8123/index.html');
  await page.waitForTimeout(500);
  await page.screenshot({ path: process.argv[2] || '/tmp/title.png' });
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: (process.argv[2] || '/tmp/title.png').replace('.png', '_game.png') });
  console.log('errors:', errs.length); errs.slice(0, 10).forEach((e) => console.log(e));
  const r = await page.evaluate(() => ({ err: window.__err, last: window.__lastErr, npcs: G.npcs.length, out: G.npcs.filter(n => n.loc==='out').length }));
  console.log(JSON.stringify(r));
  await browser.close();
})();
