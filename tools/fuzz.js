// Fuzz : entrées aléatoires pendant de nombreuses images pour détecter des exceptions
const B = require('./browser');
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto(B.URL);
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(400);
  const seeds = parseInt(process.argv[2] || '3');
  for (let s = 0; s < seeds; s++) {
    const r = await page.evaluate(async (seed) => {
      const out = [];
      let rs = seed * 7919 + 13; const rr = () => { rs = (rs * 1664525 + 1013904223) % 4294967296; return rs / 4294967296; };
      P.god = true; Actions.reset = () => {}; Save.save = () => {}; Menu.open = () => {};
      // tp aléatoire : pour mélanger les situations
      const jobs = ['none', 'police', 'fire', 'ems', 'fastfood', 'banker', 'guard'];
      for (let round = 0; round < 30; round++) {
        try {
          // état aléatoire
          if (P.jail && rr() < 0.5) { Jail.release(false); }
          if (P.job === 'none' && rr() < 0.6) { const e = Jobs.apply(jobs[1 + Math.floor(rr() * 6)]); if (!e && rr() < 0.7) { const b = bOf(P.empBid); if (G.scene !== 'out') Player.leave(); const f = frontPx(b); P.x = f.x; P.y = f.y; Player.enter(b); Jobs.duty(true); } }
          if (!P.gang && rr() < 0.3 && P.job !== 'police' && P.job !== 'guard') Gangs.join(['mafia', 'bikers', 'street'][Math.floor(rr() * 3)]);
          if (P.gang && !P.mission && rr() < 0.7) { const ks = Object.keys(Missions.defs).filter(k => !Missions.defs[k].only || Missions.defs[k].only === P.gang); Missions.start(ks[Math.floor(rr() * ks.length)]); }
          if (rr() < 0.3) { const b = W.buildings[Math.floor(rr() * W.buildings.length)]; if (G.scene !== 'out' && !P.jail) Player.leave(); if (!P.jail && !Player.inVeh()) { const f = frontPx(b); P.x = f.x; P.y = f.y; if (rr() < 0.6) Player.enter(b); } }
          if (rr() < 0.15) Incidents.spawn(null);
          if (rr() < 0.1) Wanted.crime(rr() * 3, 'fuzz', false);
          for (let i = 0; i < 900; i++) {
            Input.mx = Math.sin(i * 0.05 + seed + round) * (rr() < 0.9 ? 1 : 0); Input.my = Math.cos(i * 0.043 + round) * (rr() < 0.9 ? 1 : 0);
            if (i % 15 === 0) { if (rr() < 0.5) Input.edge.act = true; }
            if (i % 70 === 0 && rr() < 0.3) Input.edge.veh = true;
            if (i % 40 === 0 && rr() < 0.3) Input.edge.atk = true;
            Input.held.act = rr() < 0.5; Input.held.run = rr() < 0.3;
            if (i % 33 === 0 && UI.modalOpen) { const bs = [...document.querySelectorAll('#modal .opt')]; if (bs.length) bs[Math.floor(rr() * bs.length)].click(); }
            if (i % 211 === 0 && rr() < 0.4) { Phone.open(['messages', 'insta', 'flamme', 'bank', 'gps', 'job', 'gang', 'dispatch', 'news', 'settings'][Math.floor(rr() * 10)]); const bs = [...document.querySelectorAll('#phone button, #phone .card, #phone .app')]; if (bs.length) { try { bs[Math.floor(rr() * bs.length)].click(); } catch (e) { out.push('phone click err ' + e.message); } } Phone.close(); }
            if (P.sleeping && rr() < 0.05) Sleep.stop();
            if (i % 300 === 0 && rr() < 0.3 && UI.modalOpen) UI.close(true);
            Game.step(0.05);
          }
        } catch (e) { out.push('ERR ' + (e.stack || e).toString().split('\n').slice(0, 5).join(' | ')); break; }
      }
      out.push(`seed ${seed} done: ${dayStr()} ${timeStr()} money ${Math.round(P.cash)} jail ${!!P.jail} job ${P.job} gang ${P.gang}`);
      return out;
    }, s);
    r.forEach((x) => console.log(x));
  }
  console.log('page errors:', errs.length); errs.slice(0, 8).forEach((e) => console.log(e));
  await browser.close();
})();
