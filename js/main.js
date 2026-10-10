'use strict';
// ===== Boucle principale, HUD, sauvegarde, écran titre =====
const Save = {
  key: 'ffrp_save_v1',
  exists() { try { return !!localStorage.getItem(Save.key); } catch (e) { return false; } },
  clear() { try { localStorage.removeItem(Save.key); } catch (e) { /* */ } },
  save(manual) {
    if (!G.started || P.sleeping) return;
    try {
      const pcopy = JSON.parse(JSON.stringify(P, (k, v) => (['escort', 'ticket', 'mission', 'carry'].includes(k) ? undefined : v)));
      const posts = G.posts.map((p, i) => ({ ...p, img: i < 3 ? p.img : null }));
      const d = {
        v: 1, t: G.t, mode: G.mode, settings: G.settings, p: pcopy, eco: G.eco, biz: G.biz, gangs: G.gangs, msgs: G.msgs, posts, loans: G.loans, news: G.news, uid: G.uid,
        npcs: NPC.saveAll(), prisoners: G.prisoners || [], scene: G.scene === 'out' ? 'out' : G.scene,
        vehicles: G.vehicles.filter((v) => v.owner === 'player').map((v) => ({ id: v.id, type: v.type, x: v.x, y: v.y, a: v.a, col: v.col, fuel: v.fuel, hp: v.hp, plate: v.plate })),
      };
      localStorage.setItem(Save.key, JSON.stringify(d));
      if (manual) toast('💾 Partie sauvegardée.', 'good');
    } catch (e) { if (manual) toast('Sauvegarde impossible (stockage plein ?).', 'bad'); }
  },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(Save.key)); if (!d || d.v !== 1) return false;
      Game.reset();
      G.t = d.t; G.mode = d.mode; Object.assign(G.settings, d.settings); G.eco = d.eco; G.biz = d.biz; G.gangs = d.gangs; G.msgs = d.msgs; G.posts = d.posts; G.loans = d.loans; G.news = d.news; G.uid = d.uid;
      G.prisoners = d.prisoners;
      NPC.generate(); NPC.loadAll(d.npcs);
      Object.assign(G.gangs, d.gangs);
      P = d.p; P.escort = []; P.carry = []; P.mission = null; P.ticket = null;
      G.vehicles = []; for (const v of d.vehicles) { const q = Veh.create(v.type, v.x, v.y, v.a, { owner: 'player', col: v.col, fuel: v.fuel, hp: v.hp, plate: v.plate }); q.id = v.id; }
      P.veh = null; P.ownV = d.vehicles.map((v) => v.id);
      // retour dehors ou dans le même bâtiment
      if (d.scene !== 'out') { const b = W.buildings[d.scene]; G.scene = b.id; Interior.load(b); } else G.scene = 'out';
      G.started = true; Game.snapNpcs();
      return true;
    } catch (e) { console.error(e); return false; }
  },
};

const Game = {
  last: 0, hudT: 0, saveT: 0, slowT: 0, lastHour: -1, lastDay: -1,
  reset() {
    G.t = 1440 + 8 * 60; G.mode = 'accel'; G.scene = 'out'; G.npcs = []; G.vehicles = []; G.biz = {}; G.gangs = {}; G.msgs = {}; G.posts = []; G.incidents = []; G.loans = []; G.news = []; G.ff = 0; G.uid = 1; G.prisoners = [];
    NPC.fields = {}; RP.scenes = {}; Interior.unload();
  },
  snapNpcs() {
    for (const n of G.npcs) { n.think = 0; n.destKey = null; n.visitedAt = -999; }
    G.ff = 1; NPC.update(0.01); NPC.update(0.01); G.ff = 0;
    for (const n of G.npcs) n.visitedAt = G.t - rand(0, 20);
    if (G.scene !== 'out') { Interior.load(W.buildings[G.scene]); }
  },
  newGame(name, col, gender) {
    Game.reset();
    NPC.generate(); Eco.init(); Player.create(name, col, gender);
    for (let i = 0; i < 8; i++) Social.npcPost();
    const crims = G.npcs.filter((n) => n.crim > 0.5 && n.gr < 3 && !['police', 'guard', 'fire', 'ems'].includes(n.job)).sort(() => Math.random() - 0.5).slice(0, 6);
    for (const n of crims) Police.imprison(n, randi(200, 1800));
    G.started = true; Game.snapNpcs();
    Eco.addNews('Bienvenue dans la ville ! Les emplois sont à pourvoir.');
    setTimeout(() => {
      Msg.push('Mairie', `Bienvenue ${P.name} ! Ouvrez 📱 > Métier pour postuler (police, pompiers, ambulance, fast food, banque, prison) ou rejoignez un gang depuis son QG. Votre domicile est indiqué dans le GPS.`);
      toast('🕹️ Joystick : bouger · A : agir · 🚗 : véhicule · 📱 : téléphone', '');
    }, 800);
    P.wp = { ...frontPx(W.buildings[W.byKind.fastfood[0].id]), label: 'Fast Fast Food' };
  },
  frame(ts) {
    const dt = Math.min(0.05, (ts - Game.last) / 1000 || 0.016); Game.last = ts;
    if (G.started) {
      try {
        const paused = Phone.isOpen() && G.settings.pausePhone;
        if (!paused) Game.step(dt);
        Game.hud(dt);
      } catch (e) { console.error(e); window.__err = (window.__err || 0) + 1; window.__lastErr = String(e && e.stack || e); }
      render();
    }
    requestAnimationFrame(Game.frame);
  },
  step(dt) {
    _rt += dt;
    const rate = G.ff > 0 ? G.ff : minPerSec();
    const dm = dt * rate;
    const oldDay = dayN(), oldHour = Math.floor(G.t / 60);
    G.t += dm;
    if (Math.floor(G.t / 1440) > oldDay) { for (let d = oldDay; d < Math.floor(G.t / 1440); d++) Eco.daily(); }
    if (Math.floor(G.t / 60) > oldHour) Game.hourly();
    Player.needs(dm);
    // simulation
    NPC.update(dt);
    if (G.scene !== 'out') Interior.update(dt);
    Traffic.update(dt);
    const veh = Player.inVeh();
    // PNJ vs joueur / véhicules
    if (G.scene === 'out') Game.vehicleVsPeds(dt);
    const frozen = UI.modalOpen || Phone.isOpen();
    if (frozen && veh) { veh.thr = 0; veh.brake = 1; Veh.step(veh, dt); P.x = veh.x; P.y = veh.y; } else if (!frozen || P.sleeping) Player.update(dt);
    // véhicules inactifs (roulent encore un peu)
    for (const v of G.vehicles) if (v !== veh && v.driver !== 'ai' && v.owner !== 'cop') { if (Math.abs(v.v) > 1) { v.thr = 0; v.brake = 1; Veh.step(v, dt); } }
    if (veh) for (const v of G.vehicles) if (v !== veh && Math.abs(v.x - veh.x) < 60 && Math.abs(v.y - veh.y) < 60) Veh.collide(veh, v);
    Combat.update(dt); NPC.fightUpdate(dt);
    Wanted.update(dt); Police.update(dt);
    Incidents.update(dt); Missions.update(dt); Jobs.update(dt, dm); Escort.update(dt); Jail.update(); Dating.update(); Social.tick(dt);
    UI.progUpdate(dt);
    Game.slowT -= dt;
    if (Game.slowT <= 0) { Game.slowT = 4; Police.prisonUpdate(); EMS.hospitalUpdate(); Phone.isOpen() && Phone.state.app !== 'messages' && Phone.render(); }
    // entrées
    Game.input(dt);
    // sauvegarde auto
    Game.saveT += dt; if (Game.saveT > 30) { Game.saveT = 0; Save.save(false); }
  },
  hourly() {
    if (chance(0.7)) Social.npcPost();
    // revenus du joueur propriétaire de vues: rien
    if (G.mode === 'accel' || true) { if (chance(0.25)) Msg.pushRandom && Msg.pushRandom(); }
  },
  vehicleVsPeds(dt) {
    for (const v of G.vehicles) {
      if (Math.abs(v.v) < 90) continue;
      for (const n of G.npcs) {
        if (n.loc !== 'out' || n.state === 'down' || n.state === 'dead' || n.cuffed) continue;
        const dx = n.x - v.x, dy = n.y - v.y;
        if (Math.abs(dx) < 24 && Math.abs(dy) < 24 && Math.hypot(dx, dy) < VEH[v.type].w * 0.55) {
          n.hp -= Math.abs(v.v) / 5;
          if (v.driver === 'player') { Wanted.crime(1.2, 'délit de fuite / renversement', false); Snd.crash(); P.crimes++; }
          if (n.hp <= 0) { NPC.knockout(n); } else NPC.panic(n);
          NPC.say(n, 'Aïe !', 2);
        }
      }
    }
  },
  input(dt) {
    const E = Input.edge;
    if (UI.modalOpen || Phone.isOpen()) { E.act = E.veh = E.atk = false; UI.setPrompt(null); return; }
    if (P.sleeping) { if (E.act) Sleep.stop(); E.act = E.veh = E.atk = false; return; }
    if (P.dead) return;
    // interaction
    const cur = Interact.scan(); Interact.cur = cur;
    if (cur) {
      UI.setPrompt('[A] ' + cur.label, () => { E.act = true; });
      if (cur.hold && Input.held.act) { cur.run(dt); E.act = false; }
      else if (E.act && !cur.hold) { E.act = false; cur.run(dt); }
      else if (E.act && cur.hold) { E.act = false; toast('Maintenez le bouton A.', 'warn'); }
    } else { UI.setPrompt(null); if (E.act) { E.act = false; } }
    if (E.veh) { E.veh = false; Player.toggleVeh(); }
    if (E.atk) {
      E.atk = false;
      const v = Player.inVeh();
      if (v && v.forJob) { v.siren = !v.siren; toast(v.siren ? '🚨 Sirène activée' : 'Sirène coupée'); }
      else Combat.attack();
    }
    if (Input.held.atk && P.weapon === 'pistol') Combat.attack();
  },
  hud(dt) {
    Game.hudT -= dt; if (Game.hudT > 0) return; Game.hudT = 0.12;
    $('clock').textContent = `${dayStr()} ${timeStr()}${G.ff > 0 ? ' ⏩' : ''}`;
    $('cash').textContent = `${money(P.cash)}`;
    $('b-hp').style.width = Math.max(0, P.hp) + '%'; $('b-hun').style.width = P.hun + '%'; $('b-thi').style.width = P.thi + '%'; $('b-ene').style.width = P.ene + '%';
    $('wanted').textContent = P.wanted > 0 ? '★'.repeat(P.wanted) : '';
    const duty = [];
    if (P.onDuty) duty.push(`${JOBS[P.job].emoji} En service — ${Jobs.rankName()}`);
    if (P.gang) duty.push(`${GANGS[P.gang].emoji} ${Gangs.myRankName()}`);
    if (P.jail) duty.push(`🔒 Peine : ${Jail.fmt(Math.max(0, P.jail.until - G.t))}`);
    if (P.alc > 25) duty.push('🥴 Ivre');
    $('duty').textContent = duty.join(' · ');
    $('objective').textContent = Game.objective();
    const v = Player.inVeh();
    const vi = $('vehinfo');
    if (v) { vi.classList.remove('hidden'); vi.textContent = `${VEH[v.type].emoji} ${Math.round(Math.abs(v.v) * 0.45)} km/h · ⛽ ${Math.round(v.fuel)} L · 🔧 ${Math.round(v.hp)}%`; } else vi.classList.add('hidden');
    // balise GPS atteinte
    if (P.wp && Math.hypot(P.wp.x - P.x, P.wp.y - P.y) < 50 && G.scene === 'out' && !P.mission) P.wp = null;
  },
  objective() {
    if (P.jail) return 'Purgez votre peine, travaillez à l\'atelier ou évadez-vous.';
    if (P.mission) return '🎯 ' + Missions.text();
    if (P.heat > 0) return P.wanted >= 3 ? '🚔 Semez la police ou cachez-vous dans un bâtiment !' : '👮 La police vous recherche.';
    if (P.escort && P.escort.length) return P.escort[0].escortType === 'patient' ? '🚑 Conduisez le patient à l\'hôpital' : '👮 Ramenez le suspect au commissariat';
    if (P.onDuty && P.job === 'fastfood') { if (P.ticket) { const miss = P.ticket.items.filter((k) => !P.carry.includes(k)); return miss.length ? `🍳 À préparer : ${miss.map((k) => ITEMS[k].e).join(' ')} → ${P.ticket.name}` : '✅ Servez le client au comptoir'; } const b = W.buildings[P.empBid]; return G.scene === b.id ? ((b.tickets || []).some((t) => t.state === 'new') ? '🧾 Un client attend : prenez la commande au comptoir' : 'Attendez un client…') : '🍔 Rendez-vous à votre fast food'; }
    if (P.onDuty && P.job === 'banker') return G.scene === P.empBid ? ((W.buildings[P.empBid].requests || []).length ? '🏦 Un client vous attend au bureau' : 'Attendez un client…') : '🏦 Rendez-vous à la banque';
    if (P.onDuty && P.job === 'guard') return G.scene === P.empBid ? (Prison.hasFight ? '⚔️ Séparez la bagarre !' : `📍 Ronde : point ${'ABCD'[Prison.patrol.next]}`) : '🔒 Rendez-vous à la prison';
    if (P.onDuty && ['police', 'fire', 'ems'].includes(P.job)) { const i = Incidents.nearestFor(P.job); if (i) return `${{ fire: '🔥 Incendie', medical: '🚑 Urgence', robbery: '🚨 Braquage', fight: '👊 Bagarre' }[i.type]} — ${Math.round(Math.hypot(i.x - P.x, i.y - P.y) / TS * 3)} m`; return 'En service — attente d\'un appel…'; }
    if (P.wp) return '📍 ' + (P.wp.label || 'Destination');
    if (P.hun < 25) return '🍔 Vous avez faim !';
    if (P.ene < 20) return '😴 Vous êtes épuisé : dormez.';
    if (P.job === 'none' && !P.gang) return '💼 Postulez via 📱 Métier ou rejoignez un gang dans son QG';
    if (P.job !== 'none' && !P.onDuty) return `${JOBS[P.job].emoji} Prenez votre service : casier au ${W.buildings[P.empBid].name}`;
    return '';
  },
};

const Menu = {
  open() {
    if (UI.modalOpen) { UI.close(); return; }
    UI.menu('☰ Menu', `${P.name} · ${dayStr()} ${timeStr()}`, [
      { label: '💾 Sauvegarder', fn: () => Save.save(true) },
      { label: '📊 Statistiques', fn: () => Menu.stats() },
      { label: '📖 Aide & commandes', fn: () => Menu.help() },
      { label: G.mode === 'accel' ? '🕰️ Passer en temps réel' : '⏩ Passer en temps accéléré (10 min = 1 h)', fn: () => { Actions.mode(G.mode === 'accel' ? 'real' : 'accel'); } },
      { label: '🏠 Écran titre', fn: () => { Save.save(false); G.started = false; Title.show(); } },
    ]);
  },
  stats() {
    const s = P.stats;
    UI.alert('📊 Statistiques', `Argent gagné via métier : ${money(s.earned)}<br>Arrestations : ${s.arrests} · Incendies éteints : ${s.fires}<br>Patients secourus : ${s.rescues} · Commandes servies : ${s.orders}<br>Prêts accordés : ${s.loans} · Missions de gang : ${s.missions || 0}<br>Abonnés : ${P.followers} · Charme : ${Math.round(P.charm)}<br>Casier : ${s.jailed || 0} condamnation(s)<br>Force ${P.skills.str.toFixed(1)} · Tir ${P.skills.shoot.toFixed(1)}`);
  },
  help() {
    UI.alert('📖 Comment jouer', `<div style="text-align:left;font-size:13px;line-height:1.5"><b>🕹️ Contrôles</b> : joystick pour bouger (en véhicule : gauche/droite = volant, haut = accélérer, bas = reculer), <b>A</b> pour interagir (maintenir pour éteindre un feu), 🚗 pour monter/descendre, 👊 pour frapper/tirer (sirène en véhicule de service), 🏃 pour courir (frein à main en véhicule).<br><br><b>💼 Métiers</b> : 📱 Métier → postulez, allez au bâtiment, ouvrez le casier pour prendre le service. Police : arrêtez des suspects et déposez-les au commissariat. Pompier : éteignez les incendies. Ambulance : soignez/transportez les blessés. Fast food : prenez la commande, préparez gril/friteuse/boissons, servez. Banquier : accordez ou refusez les prêts. Gardien : rondes et bagarres.<br><br><b>🕶️ Gangs</b> : allez au QG (Iron Wolves, Corvino, Diablos), parlez au chef, faites des missions, montez en grade, recrutez et renvoyez des membres.<br><br><b>🏦 Économie</b> : tout est relié (salaires, commerces, TVA, loyers, prêts, prix dynamiques). Si vous êtes arrêté, travaillez en prison pour réduire la peine, dormez pour accélérer le temps.</div>`);
  },
};

const Title = {
  col: '#2563eb', gender: 0,
  show() {
    const t = $('title'); t.style.display = 'flex'; $('hud').classList.add('hidden'); $('controls').classList.add('hidden'); Phone.close(); UI.close(true);
    t.innerHTML = `<h1>🍔 Fast Fast Life</h1><p>Jeu de rôle 2D en ville ouverte : police, pompiers, ambulance, fast food, banque, prison, gangs, motards, mafia, boîtes de nuit… avec un téléphone, des rencontres, Instagram et une économie vivante.</p>
    ${Save.exists() ? '<button class="btn" id="t-cont">▶ Continuer</button>' : ''}<button class="btn ${Save.exists() ? 'alt' : ''}" id="t-new">🆕 Nouvelle partie</button>`;
    if ($('t-cont')) $('t-cont').onclick = () => { Snd.init(); if (Save.load()) Title.hide(); else toast('Sauvegarde illisible.', 'bad'); };
    $('t-new').onclick = () => Title.create();
  },
  create() {
    const cols = ['#2563eb', '#e11d48', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#111827', '#f8fafc'];
    $('title').innerHTML = `<h1>Votre personnage</h1><input class="tx" id="t-name" placeholder="Prénom Nom" value="Alex Martin" style="max-width:300px">
    <div class="swatches">${cols.map((c, i) => `<div class="sw ${i === 0 ? 'on' : ''}" data-c="${c}" style="background:${c}"></div>`).join('')}</div>
    <p>Mode de temps : <b>10 min réelles = 1 h de jeu</b> (modifiable à tout moment dans 📱 Réglages, ou temps réel 1:1 sur l'horloge de votre appareil).</p>
    <button class="btn" id="t-go">Entrer en ville</button><button class="btn alt" id="t-back">Retour</button>`;
    document.querySelectorAll('.sw').forEach((s) => (s.onclick = () => { document.querySelectorAll('.sw').forEach((x) => x.classList.remove('on')); s.classList.add('on'); Title.col = s.dataset.c; }));
    $('t-back').onclick = () => Title.show();
    $('t-go').onclick = () => { Snd.init(); Save.clear(); Game.newGame(($('t-name').value || 'Alex Martin').slice(0, 24), Title.col, 0); Title.hide(); };
  },
  hide() { $('title').style.display = 'none'; $('hud').classList.remove('hidden'); $('controls').classList.remove('hidden'); R.cam.x = P.x; R.cam.y = P.y; },
};

window.addEventListener('load', () => {
  R.cv = $('cv'); R.ctx = R.cv.getContext('2d'); resize(); window.addEventListener('resize', resize);
  Input.init(); generateWorld(); buildGround(); Title.show();
  window.addEventListener('beforeunload', () => Save.save(false));
  document.addEventListener('visibilitychange', () => { if (document.hidden) Save.save(false); });
  requestAnimationFrame(Game.frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
});
