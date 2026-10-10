const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto('http://localhost:8123/index.html');
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    P.god = true; document.getElementById('toasts').innerHTML = '';
    // simule 5h pour avoir des gens dehors vers 13h puis place le joueur au centre
    for (let i = 0; i < 30000; i++) Game.step(0.1);
    const f = frontPx(W.byKind.fastfood[0]); P.x = f.x; P.y = f.y + 10; R.cam.x = P.x; R.cam.y = P.y;
    return `${dayStr()} ${timeStr()} out=${G.npcs.filter(n=>n.loc==='out').length}`;
  });
  console.log(r);
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/tmp/claude-0/shots/city_day.png' });
  console.log('errors', errs.length, errs.slice(0,3));
  await browser.close();
})();
