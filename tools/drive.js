const B = require('./browser');
const sh = B.SHOTS;
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto(B.URL);
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    P.god = true; document.getElementById('toasts').innerHTML = '';
    G.t = 1440 * 3 + 22 * 60 + 30;
    const v = Veh.create('sport', 0, 0, 0, { owner: 'player', col: '#dc2626' }); P.ownV.push(v.id);
    v.x = 19.5 * TS; v.y = 17.5 * TS + 40; v.a = 0;
    P.x = v.x; P.y = v.y; P.veh = v.id; v.driver = 'player';
    for (let i = 0; i < 40; i++) Traffic.spawn(P);
    R.cam.x = P.x; R.cam.y = P.y;
    for (let i = 0; i < 70; i++) { Input.mx = 0; Input.my = -0.8; Game.step(0.05); }
    Wanted.crime(3, 'test', false);
  });
  await page.evaluate(() => { for (let i = 0; i < 25; i++) { Input.mx = 0; Input.my = -0.5; Game.step(0.05); } });
  await page.waitForTimeout(500);
  await page.screenshot({ path: sh + 'drive_night.png' });
  console.log(await page.evaluate(() => `veh ${!!Player.inVeh()} jail ${!!P.jail} speed ${Player.inVeh() ? Math.round(Player.inVeh().v) : -1} cops ${G.vehicles.filter(v => v.owner === 'cop').length} traffic ${G.vehicles.filter(v => v.owner === 'traffic').length}`));
  console.log('errors', errs.length, errs.slice(0, 3));
  await browser.close();
})();
