const B = require('./browser');
(async () => {
  const browser = await B.launch();
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + '\n' + (e.stack || '')));
  await page.goto(B.URL);
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
  await test('dating', `
    const n=G.npcs.find(x=>x.age<40&&x.state!=='dead'&&typeof x.loc==='number'&&!x.job.match(/police|guard/)); n.matched=true; n.known=true; n.aff=70; G.msgs[n.name]={name:n.name,msgs:[],unread:0,npc:n.id,col:n.col,last:G.t};
    Dating.propose(n,'restaurant'); const b=bOf(P.date.bid); L('venue '+b.name+' in '+Math.round(P.date.at-G.t));
    G.t=P.date.at-5; step(2); G.ff=1; step(1200,0.05); G.ff=0; L('npc loc '+n.loc+' venue '+b.id);
    P.cash=500; tp(b); Player.enter(b); L('npc inside '+(n.loc===b.id)); const t=Interior.S.furn.find(f=>f.act==='sit'); P.x=(t.x+1)*TS; P.y=(t.y+1.2)*TS; Acts.sit(t,b); L(optLabels()); clickOpt(0); L('aff '+Math.round(n.aff)); Acts.sit(t,b); clickOpt(2); L('partner '+P.partner+' '+n.partner);
  `);
  await test('house door + burglary', `
    P.inv.lockpick=2; const h=W.byKind.house.find(b=>b.id!==P.homeBid&&G.npcs.filter(n=>n.home===b.id).every(n=>n.loc!==b.id)); tp(h); Doors.tryEnter(h); L(optLabels()); clickOpt(1); prog(); L('scene '+G.scene+' heat '+P.heat); const st=Interior.S.furn.find(f=>f.act==='stash'); P.x=(st.x-0.3)*TS; P.y=(st.y+0.5)*TS; const c0=P.cash; Acts.stash(st,h); prog(); L('loot '+Math.round(P.cash-c0)); Player.leave(); P.heat=0;
  `);
  await test('refuel+dealer+bank', `
    const v=Veh.byId(P.ownV[0]); v.fuel=2; const g=W.byKind.gas[0]; P.cash=1000; Shop.refuel(v,g); L(optLabels()); clickOpt(0); L('fuel '+v.fuel);
    const d=W.byKind.dealer[0]; Dealer.menu(d); L(optLabels().slice(0,3)); P.cash=20000; clickOpt(1); document.querySelector('#modal .opt[data-i="0"]').click(); L('own '+P.ownV.length);
    const bk=W.byKind.bank[0]; Bank.menu(bk); L(optLabels().slice(0,6)); clickOpt(5); L('loan '+JSON.stringify(P.loan)); Eco.daily(); L('loan after '+JSON.stringify(P.loan)+' bank '+Math.round(P.bank));
  `);
  await test('taxi+gps', `
    Actions.setwp(W.byKind.bank[0].id); L(JSON.stringify(P.wp)); Phone.open('gps'); Actions.taxi(); await new Promise(r=>setTimeout(r,900)); L('dist '+Math.round(Math.hypot(P.x-P.wp.x,P.y-P.wp.y)));
  `);
  await test('manager', `
    P.job='none'; P.gang=null; Jobs.apply('fastfood'); P.jobXp=800; Jobs.xp(0); L('rank '+P.jobRank+' '+Jobs.rankName()); const b=bOf(P.empBid); Phone.open('job'); L('html '+document.getElementById('phone').innerHTML.includes('Gestion')); const un=G.npcs.find(n=>n.job==='none'&&!n.sjob&&!n.gang); Actions.thire(un.id); L('hired '+un.job+' '+un.work===P.empBid); Actions.tfire(un.id); L('fired '+un.job);
  `);
  console.log('page errors:', errs.length); errs.slice(0, 10).forEach((e) => console.log(e));
  await browser.close();
})();
