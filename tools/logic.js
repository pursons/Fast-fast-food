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
        const prog=()=>{ let k=0; while(UI.prog && k++<600) Game.step(0.05); };
        const clickOpt=(i)=>{ const b=document.querySelector('#modal .opt[data-i="'+i+'"]'); if(!b) throw new Error('no opt '+i); b.click(); };
        const optLabels=()=>[...document.querySelectorAll('#modal .opt')].map(b=>b.innerText.replace(/\\n/g,' | '));
        const tp=(b)=>{ if(G.scene!=='out'){Player.leave();} const f=frontPx(b); P.x=f.x; P.y=f.y; };
        ${js}
        return log; })()`);
      console.log('== ' + name); r.forEach((l) => console.log('   ' + l));
    } catch (e) { console.log('== ' + name + ' FAILED: ' + e.message.slice(0, 400)); }
  };
  await test('fastfood', `
    L(Jobs.apply('fastfood')); const b=bOf(P.empBid); tp(b); Player.enter(b); Jobs.duty(true);
    Jobs.ff.ghost(b); step(2); L('tickets '+b.tickets.length);
    // placer le joueur au comptoir
    const S=Interior.S; const f=S.furn.find(x=>x.act==='ff_counter'); P.x=(f.x+4)*TS; P.y=(f.y-0.3)*TS;
    Acts.ff_counter(f,b); L('ticket '+JSON.stringify(P.ticket&&P.ticket.items));
    for (const it of P.ticket.items){ const st=S.furn.find(x=>x.act==={burger:'ff_grill',fries:'ff_fryer',soda:'ff_drink'}[it]); Acts[st.act](st,b); prog(); }
    L('carry '+P.carry.join(','));
    Acts.ff_counter(f,b); L('after deliver ticket='+(!!P.ticket)+' orders='+P.stats.orders+' cash='+Math.round(P.cash)+' xp='+P.jobXp);
    step(2400); L('wage after 2 min dutyAcc ok bank='+Math.round(P.bank));
  `);
  await test('banker', `
    P.job='none'; P.onDuty=false; L(Jobs.apply('banker')); const b=bOf(P.empBid); tp(b); Player.enter(b); Jobs.duty(true);
    Jobs.bank.gt=0; step(3); L('reqs '+Jobs.bank.reqs(b).length);
    Acts.bank_desk(null,b); L(optLabels()); clickOpt(0); step(2); L('loans '+G.loans.length+' bank='+Math.round(P.bank)+' xp='+P.jobXp);
  `);
  await test('police+robbery', `
    P.job='none'; P.onDuty=false; if(P.jail)P.jail=null; L(Jobs.apply('police')); const b=bOf(P.empBid); tp(b); Player.enter(b); Jobs.duty(true);
    Player.leave(); Police.spawnRobbery(); const inc=G.incidents.find(i=>i.type==='robbery'); L('inc '+!!inc);
    const n=G.npcs[inc.suspect]; P.x=n.x+10; P.y=n.y; step(1); 
    Talk.open(n); L(optLabels().slice(0,4)); const labs=optLabels(); const idx=labs.findIndex(x=>/Menotter/.test(x)); clickOpt(idx); prog(); step(2);
    L('escort '+(P.escort&&P.escort.length)+' cuffed='+n.cuffed);
    const pb=W.byKind.police[0]; tp(pb); Player.enter(pb); step(3); const bk=Interior.S.furn.find(f=>f.act==='booking'); P.x=(bk.x+1)*TS; P.y=(bk.y+1.5)*TS;
    Acts.booking(bk,pb); clickOpt(0); step(2); L('arrests '+P.stats.arrests+' prisoners '+G.prisoners.length+' suspect loc='+n.loc);
  `);
  await test('fire', `
    P.job='none'; P.onDuty=false; L(Jobs.apply('fire')); const b=bOf(P.empBid); tp(b); Player.enter(b); Jobs.duty(true); Player.leave();
    Fire.spawn(); const inc=G.incidents.find(i=>i.type==='fire'&&!i.done); const fb=bOf(inc.bid); P.x=(fb.front.x+0.5)*TS; P.y=(fb.front.y+0.5)*TS;
    const c=[]; Fire.hook(c); L('hook '+c.length); let k=0; while(!inc.done&&k++<400){ c[0].run(0.05); }
    L('fire done '+inc.done+' fires='+P.stats.fires+' bank='+Math.round(P.bank));
  `);
  await test('ems', `
    P.job='none'; P.onDuty=false; L(Jobs.apply('ems')); const b=bOf(P.empBid); tp(b); Player.enter(b); Jobs.duty(true); Player.leave();
    EMS.spawnMedical(); const inc=G.incidents.find(i=>i.type==='medical'&&!i.done); const n=G.npcs[inc.npc]; P.x=n.x+8; P.y=n.y;
    Talk.open(n); L(optLabels().slice(0,3)); clickOpt(0); step(2); L('escort '+(P.escort&&P.escort.length));
    Acts.hospital_desk(null,W.byKind.hospital[0]); L(optLabels()); clickOpt(0); step(2); L('rescues '+P.stats.rescues+' bank='+Math.round(P.bank));
  `);
  await test('gang', `
    P.job='none'; P.onDuty=false; P.cash=5000; const hq=W.byKind.street[0]; tp(hq); Player.enter(hq);
    Gangs.joinFlow('street'); L(optLabels()); clickOpt(0); L('gang '+P.gang+' rank '+P.gangRank);
    const meet=Interior.S.furn.find(f=>f.act==='gang_meeting'); P.x=(meet.x+1)*TS; P.y=(meet.y+1.4)*TS; Acts.gang_meeting(meet,hq); L(optLabels()); clickOpt(0); L(optLabels().slice(0,4));
    clickOpt(0); L('mission '+(P.mission&&P.mission.type)); 
    Gangs.addRespect(600); L('rank '+P.gangRank+' '+Gangs.myRankName());
    L('members '+Gangs.members('street').length); const cand=G.npcs.find(n=>!n.gang&&n.crim>0.3&&n.state!=='dead'); let tries=0, r; do { r=Gangs.recruit(cand);} while(r&&tries++<30); L('recruit '+r);
    L('fire '+Gangs.fire(cand)); 
    ['messages','insta','flamme','bank','gps','job','gang','dispatch','news','settings'].forEach(a=>{ Phone.open(a); const h=document.getElementById('phone').innerHTML.length; L(a+' '+h); }); Phone.close();
  `);
  await test('jail', `
    Jail.send(90,'test'); await new Promise(r=>setTimeout(r,4000)); L('scene '+G.scene+' jail '+!!P.jail);
    const S=Interior.S; const w=S.furn.find(f=>f.act==='prison_work'); P.x=(w.x+1)*TS; P.y=(w.y-0.3)*TS; Acts.prison_work(w,Interior.b); prog(); L('left '+Math.round(P.jail.until-G.t));
    Acts.prison_phone(); L(optLabels()); UI.close(true);
    G.t=P.jail.until+1; step(2); await new Promise(r=>setTimeout(r,2500)); L('released scene='+G.scene+' jail='+!!P.jail);
  `);
  await test('social', `
    Phone.open('flamme'); for(let i=0;i<12;i++){ Actions.swipe(1); } L('matches '+G.npcs.filter(n=>n.matched).length);
    const m=G.npcs.find(n=>n.matched); if(m){ Actions.newthread(m.id); Phone.render(); Dating.propose(m,'restaurant'); L('date '+JSON.stringify(P.date)); }
    Phone.open('insta'); Phone.state.tab=1; Phone.render(); Social.post(true); L('posts '+G.posts.length+' img='+!!G.posts[0].img); Social.sponsor(); Phone.close();
    Save.save(true); L('saved '+Save.exists()); 
  `);
  await test('vehicles', `
    if(G.scene!=='out'){Player.leave();} const v=Veh.byId(P.ownV[0]); P.x=v.x+10; P.y=v.y; Player.toggleVeh(); L('in veh '+P.veh);
    for(let i=0;i<120;i++){ Input.mx=0; Input.my=-1; Game.step(0.05);} L('speed '+Math.round(P.veh?Veh.byId(P.veh).v:-1)+' pos '+Math.round(P.x)+','+Math.round(P.y)+' fuel '+Veh.byId(P.veh).fuel.toFixed(2)); Input.my=0; step(40); Player.toggleVeh(); L('out '+P.veh);
  `);
  console.log('page errors:', errs.length); errs.slice(0, 10).forEach((e) => console.log(e));
  await browser.close();
})();
