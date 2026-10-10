const B = require('./browser');
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.goto(B.URL);
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(500);
  const res = await page.evaluate(async () => {
    const out = [];
    G.ff = 0;
    const T0 = G.t;
    // 1 jour de simulation à 1 min / s (dt 0.05)
    window.minPerSec = () => 1.5;
    for (let i = 0; i < 28800 / 1.5 * 1; i++) {
      try { Game.step(0.05); } catch (e) { out.push('ERR step ' + e.stack); break; }
      if (i % 1200 === 0) out.push(`${dayStr()} ${timeStr()} out=${G.npcs.filter(n=>n.loc==='out').length} veh=${G.vehicles.length} inc=${G.incidents.filter(x=>!x.done).length} cash=${Math.round(P.cash)} hp=${Math.round(P.hp)}`);
    }
    out.push('treasury ' + Math.round(G.eco.treasury) + ' infl ' + G.eco.infl.toFixed(3) + ' tax ' + G.eco.taxRate.toFixed(3));
    out.push('prices ' + ['burger','meal','grocery'].map(k=>Eco.price(k)).join(','));
    out.push('M ' + JSON.stringify(Eco.stats()));
    return out;
  });
  res.forEach(r => console.log(r));
  console.log('errors:', errs.length); errs.slice(0, 8).forEach((e) => console.log(e));
  await browser.close();
})();
