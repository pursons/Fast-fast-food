const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errs.push('CONSOLE ' + m.text()); });
  await page.goto('http://localhost:8123/index.html');
  await page.click('#t-new'); await page.click('#t-go');
  await page.waitForTimeout(400);
  const test = async (name, js) => {
    try {
      const r = await page.evaluate(`(async()=>{ const log=[]; const L=(x)=>log.push(typeof x==='string'?x:JSON.stringify(x));
        const step=(n,dt)=>{ for(let i=0;i<n;i++) Game.step(dt||0.05); };
        const prog=()=>{ let k=0; while(UI.prog && k++<900) Game.step(0.05); };
        const clickOpt=(i)=>{ const b=document.querySelector('#modal .opt[data-i="'+i+'"]'); if(!b) throw new Error('no opt '+i); b.click(); };
        const optLabels=()=>[...document.querySelectorAll('#modal .opt')].map(b=>b.innerText.replace(/\\n/g,' | '));
        const tp=(b)=>{ if(G.scene!=='out'){Player.leave();} const f=frontPx(b); P.x=f.x; P.y=f.y; };
        P.god=true; Phone.close(); UI.close(true);
        ${js}
        return log; })()`);
      console.log('== ' + name); r.forEach((l) => console.log('   ' + l));
    } catch (e) { console.log('== ' + name + ' FAILED: ' + e.message.slice(0, 500)); }
  };
  await test('chase', `
    P.god=false; P.hp=100; const f=frontPx(W.buildings[W.playerHome]); P.x=f.x; P.y=f.y; Wanted.crime(3,'test',false); L('stars '+P.wanted);
    let k=0; while(!P.jail && k++<2400){ Game.step(0.05); if(k%400===0) L('t'+k+' cops='+G.vehicles.filter(v=>v.owner==='cop').map(v=>Math.round(Math.hypot(v.x-P.x,v.y-P.y))).join('/')+' n'+' chasing='+G.npcs.filter(n=>n.chase).length+' heat='+P.heat.toFixed(2)); }
    L('jailed '+!!P.jail+' after steps '+k+' sentence '+(P.jail&&P.jail.total)); await new Promise(r=>setTimeout(r,3500)); L('scene '+G.scene);
    P.jail=null; G.scene='out'; Interior.unload();
  `);
  await test('mission steal_car', `
    P.gang='mafia'; P.gangRank=1; Missions.start('steal_car'); const m=P.mission; L('mission '+(m&&m.type)); const v=Veh.byId(m.data.vid); L('veh '+v.type+' '+v.col);
    P.x=v.x+20; P.y=v.y; Player.useVeh(v); optLabels().length && clickOpt(0); L('stage '+m.stage+' driver '+v.driver+' veh '+P.veh);
    const hq=W.buildings[Gangs.G().hq]; const hf=frontPx(hq); v.x=hf.x; v.y=hf.y; step(2); L('completed '+!P.mission+' cash='+Math.round(P.cash)+' resp='+P.respect);
    if(P.veh){ Player.toggleVeh(); }
  `);
  await test('mission deal', `
    P.gang='street'; P.gangRank=1; const hq=W.byKind.street[0]; tp(hq); Player.enter(hq); Missions.start('deal'); const st=Interior.S.furn.find(f=>f.act==='gang_stash'); Acts.gang_stash(st,hq); L('colis '+P.inv.colis+' stage '+P.mission.stage);
    Player.leave(); for(const s of P.mission.data.spots){ P.x=s.x; P.y=s.y; const c=[]; Missions.scan(c); c[0].run(); } L('done '+!P.mission+' cash '+Math.round(P.cash));
  `);
  await test('mission collect', `
    P.gang='bikers'; P.gangRank=1; Missions.start('collect'); const m=P.mission; for(const id of m.data.targets.slice()){ const b=bOf(id); tp(b); const c=[]; Missions.scan(c); c[0].run(); prog(); }
    L('stage '+m.stage+' cash '+m.data.cash); const hq=W.byKind.biker[0]; tp(hq); Player.enter(hq); const sf=Interior.S.furn.find(f=>f.act==='gang_safe'); P.x=(sf.x)*TS; P.y=(sf.y+1.3)*TS; Acts.gang_safe(sf,hq); L(optLabels()); clickOpt(0); L('complete '+!P.mission);
    Player.leave();
  `);
  await test('mission rob+turf', `
    P.gang='mafia'; P.gangRank=2; P.heat=0; Missions.start('rob_store'); const m=P.mission; const b=bOf(m.data.bid); tp(b); Player.enter(b); const c=Interior.S.furn.find(f=>f.act==='shop'||f.act==='shop_gas'); P.x=(c.x+1)*TS; P.y=(c.y+1.4)*TS; Acts[c.act](c,b); clickOpt(1); prog(); L('stage '+m.stage+' heat '+P.heat);
    Player.leave(); P.heat=0; step(2); L('stage after '+m.stage+' '+Missions.text());
    Missions.cancel(); Missions.start('turf'); const t=P.mission; P.x=t.data.at.x; P.y=t.data.at.y; step(3); L('rivals '+t.data.rivals.length); for(const n of t.data.rivals){ n.hp=0; NPC.knockout(n);} step(2); L('turf done '+!P.mission);
  `);
  await test('run', `
    P.gang='bikers'; P.gangRank=1; P.heat=0; Missions.start('run'); const m=P.mission; L('convoy '+m.data.convoy.length); const loan=Veh.byId(m.data.loan); P.x=loan.x+10; P.y=loan.y; Player.useVeh(loan); L('veh '+(P.veh===loan.id));
    for(let i=0;i<4;i++){ const cp=m.data.cps[i]; P.x=cp.x; P.y=cp.y; loan.x=cp.x; loan.y=cp.y; step(2);} L('i '+m.data.i); const cp=m.data.cps[4]; P.x=cp.x; P.y=cp.y; loan.x=cp.x; loan.y=cp.y; step(2); L('complete '+!P.mission);
    if(P.veh) Player.toggleVeh();
  `);
  await test('heist', `
    P.gang='mafia'; P.gangRank=2; P.heat=0; Missions.start('heist'); const m=P.mission; const b=bOf(m.data.bid); G.t=Math.floor(G.t/1440)*1440+23*60; tp(b); L('open '+Doors.isOpen(b)); Player.enter(b); const v=Interior.S.furn.find(f=>f.act==='vault'); P.x=v.x*TS; P.y=(v.y+2.3)*TS; Acts.vault(v,b); clickOpt(0); prog(); L('stage '+m.stage+' heat '+P.heat.toFixed(1)+' cash '+Math.round(P.cash));
    Player.leave();
  `);
  await test('boss challenge', `
    P.gang='bikers'; P.gangRank=3; P.respect=5000; let r; let n=0; do { r=Gangs.challenge(); n++; if(r){ P.gangRank=3; P.respect=5000; P.hp=100;} } while(r && n<40); L('boss? rank '+P.gangRank+' tries '+n);
  `);
  await test('save/load', `
    Save.save(true); const cash=P.cash, t=G.t; const ok=Save.load(); L('load '+ok+' cash same '+(P.cash===cash)+' scene '+G.scene+' npcs '+G.npcs.length); Title.hide(); step(40);
  `);
  await test('economy long', `
    window.minPerSec=()=>3; P.cash=900; const st=[]; for(let d=0; d<12; d++){ for(let i=0;i<9600/12*0+ 480;i++) Game.step(0.1); } L(Eco.stats()); L('prices '+['burger','meal','grocery','beer'].map(k=>Eco.price(k)).join(', ')); L('unemp hist '+G.eco.hist.slice(-3).map(h=>h.un.toFixed(2)).join(',')); L('biz cash '+Object.values(G.biz).slice(0,5).map(b=>Math.round(b.cash)).join(','));
  `);
  console.log('page errors:', errs.length); errs.slice(0, 10).forEach((e) => console.log(e));
  await browser.close();
})();
