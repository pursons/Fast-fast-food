const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const sh = '/tmp/claude-0/shots/';
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto('http://localhost:8123/index.html');
  await page.screenshot({ path: sh + 'p_title.png' });
  await page.click('#t-new'); await page.screenshot({ path: sh + 'p_create.png' }); await page.click('#t-go');
  await page.waitForTimeout(600);
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
  // marcher vers la porte de la maison: placer le joueur devant
  await page.evaluate(() => { const b = W.buildings[W.playerHome]; const f = frontPx(b); P.x = f.x; P.y = f.y; });
  await page.waitForTimeout(300);
  await page.keyboard.press('e'); await page.waitForTimeout(700);
  console.log('scene after E:', await page.evaluate(() => G.scene));
  await page.screenshot({ path: sh + 'p_house.png' });
  // aller au lit
  await page.evaluate(() => { const f = Interior.S.furn.find(x => x.act === 'sleep'); P.x = (f.x + 2) * TS + 8; P.y = (f.y + 2.5) * TS; });
  await page.waitForTimeout(300);
  console.log('prompt:', await page.evaluate(() => document.getElementById('prompt').textContent));
  await page.keyboard.press('e'); await page.waitForTimeout(300);
  await page.screenshot({ path: sh + 'p_bed_menu.png' });
  await page.click('#modal .opt[data-i="1"]'); await page.waitForTimeout(2500);
  console.log('sleeping', await page.evaluate(() => !!P.sleeping), await page.evaluate(() => timeStr()));
  await page.screenshot({ path: sh + 'p_sleep.png' });
  await page.mouse.click(200, 400); await page.waitForTimeout(500);
  console.log('after wake', await page.evaluate(() => [!!P.sleeping, timeStr(), Math.round(P.ene)]));
  // téléphone portrait
  await page.click('#btn-phone'); await page.waitForTimeout(300);
  await page.click('.app:nth-child(6)'); await page.waitForTimeout(300);
  await page.screenshot({ path: sh + 'p_phone_job.png' });
  console.log('errors', errs.length, errs.slice(0, 3));
  await browser.close();
})();
