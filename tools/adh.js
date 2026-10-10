const B = require('./browser');
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto(B.URL);
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const out = []; const t0 = performance.now();
    P.god = true;
    for (let i = 0; i < 30000; i++) {
      Game.step(0.1);
      if (i % 3000 === 0) {
        const total = G.npcs.filter(n => n.loc !== 'prison' && !n.busy && !n.hospital && n.state !== 'dead');
        const adh = total.filter(n => n.dest && (typeof n.loc === 'number' ? n.dest.bid === n.loc : false) || (n.dest && n.dest.bid == null && n.loc === 'out')).length;
        out.push(`${dayStr()} ${timeStr()} adherence ${adh}/${total.length} out=${G.npcs.filter(n=>n.loc==='out').length} inc=${G.incidents.length}`);
      }
    }
    out.push('ms/step ' + ((performance.now() - t0) / 30000).toFixed(2));
    out.push('fields ' + Object.keys(NPC.fields).length);
    return out;
  });
  r.forEach(x => console.log(x));
  console.log('errors', errs.length, errs.slice(0,3));
  await browser.close();
})();
