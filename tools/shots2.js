const B = require('./browser'); const sh = B.SHOTS;
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto(B.URL);
  await page.click('#t-new'); await page.click('#t-go'); await page.waitForTimeout(500);
  const shot = async (name, js, wait) => { await page.evaluate(js); await page.waitForTimeout(wait || 500); await page.screenshot({ path: sh + name + '.png' }); };
  await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; P.god = true; });
  // fast food à midi
  await shot('s_ff_noon', `(()=>{ G.t=1440*2+12*60+30; Game.snapNpcs(); const b=W.byKind.fastfood[0]; Player.enter(b); Jobs.apply('fastfood'); Jobs.duty(true); Jobs.ff.ghost(b); Jobs.ff.ghost(b); document.getElementById('toasts').innerHTML=''; const f=Interior.S.furn.find(x=>x.act==='ff_counter'); P.x=(f.x+4)*TS; P.y=(f.y-0.6)*TS; for(let i=0;i<60;i++)Game.step(0.05); })()`, 700);
  await shot('s_club_night', `(()=>{ Jobs.duty(false); Player.leave(); G.t=1440*5+23*60+30; Game.snapNpcs(); const b=W.byKind.club[0]; Player.enter(b); document.getElementById('toasts').innerHTML=''; P.x=9*TS; P.y=8*TS; for(let i=0;i<100;i++)Game.step(0.05); })()`, 700);
  await shot('s_bank_in', `(()=>{ Player.leave(); G.t=1440*2+10*60; Game.snapNpcs(); const b=W.byKind.bank[0]; Player.enter(b); for(let i=0;i<60;i++)Game.step(0.05); })()`, 700);
  await shot('s_phone_bank', `Phone.open('bank')`);
  await shot('s_phone_news', `(()=>{ for(let i=0;i<6;i++){ Eco.daily(); G.t+=1440; } Phone.open('news'); })()`);
  await shot('s_phone_insta', `(()=>{ Phone.close(); Phone.open('insta'); })()`);
  await shot('s_phone_flamme', `Phone.open('flamme')`);
  await shot('s_phone_gps', `Phone.open('gps')`);
  await shot('s_phone_settings', `Phone.open('settings')`);
  console.log('errors', errs.length, errs.slice(0, 3)); console.log(sh);
  await browser.close();
})();
