'use strict';
// ===== Métiers : police, pompiers, ambulance, fast food, banque, prison + incidents =====
let _rt = 0; // temps réel écoulé (s)
const Jobs = {
  ff: null, bank: null,
  info(job) { return JOBS[job || P.job]; },
  rankName() { const J = JOBS[P.job]; return J.ranks[Math.min(P.jobRank, J.ranks.length - 1)]; },
  wage() { return Eco.wageOf(P.job, P.jobRank); },
  apply(job) {
    if (P.job !== 'none') return 'Quittez d\'abord votre emploi actuel.';
    if (P.jail) return 'Impossible depuis la prison.';
    if (P.gang && (job === 'police' || job === 'guard')) return 'Conflit d\'intérêts : vous appartenez à un gang !';
    if ((job === 'police' || job === 'guard') && (P.stats.jailed || 0) > 0) return 'Votre casier judiciaire n\'est pas vierge.';
    if (job === 'police' && P.crimes > 8) return 'Votre dossier comporte trop d\'infractions récentes.';
    const J = JOBS[job]; const b = nearestOfKind(J.bld, P);
    P.job = job; P.jobRank = 0; P.jobXp = 0; P.empBid = b.id; P.onDuty = false; P.dutyAcc = 0;
    Msg.push(J.emp === 'state' ? 'RH Ville' : b.name, `Bienvenue chez ${J.name} ! Présentez-vous au ${b.name}, passez au casier pour prendre votre service.`);
    P.wp = { x: (b.front.x + 0.5) * TS, y: (b.front.y + 0.5) * TS, label: b.name };
    return null;
  },
  quit() { Jobs.duty(false); P.job = 'none'; P.jobRank = 0; P.jobXp = 0; P.empBid = null; toast('Vous avez quitté votre emploi.', 'warn'); },
  xp(n) {
    if (P.job === 'none') return;
    P.jobXp += n; P.stats.earned += 0;
    const J = JOBS[P.job]; let r = 0;
    for (let i = 0; i < J.ranks.length; i++) if (P.jobXp >= RANK_XP[i]) r = i;
    if (r > P.jobRank) { P.jobRank = r; toast(`🎖️ Promotion ! Nouveau grade : <b>${Jobs.rankName()}</b>`, 'good'); Snd.good(); Msg.push(J.emp === 'state' ? 'RH Ville' : 'Direction', `Félicitations, vous êtes promu(e) ${Jobs.rankName()}. Salaire : ${money(Jobs.wage())}/h.`); }
    else if (r < P.jobRank) { P.jobRank = r; toast('Rétrogradation : ' + Jobs.rankName(), 'bad'); }
  },
  duty(on) {
    if (on === P.onDuty) return;
    P.onDuty = on; P.uniform = on;
    if (on) {
      toast(`✅ En service : ${Jobs.rankName()}`, 'good');
      if (P.job === 'police') { Police.taser = true; if (!P.inv.pistol) { Inv.add('pistol'); } P.ammo = Math.max(P.ammo, 12); }
      Incidents.timer = Math.min(Incidents.timer, rand(20, 40));
    } else {
      toast('Fin de service.');
      if (P.job === 'police') { Police.taser = false; if (P.weapon === 'pistol') P.weapon = 'fists'; delete P.inv.pistol; }
      if (P.svcV) { const v = Veh.byId(P.svcV); if (v && P.veh !== v.id) Veh.remove(v); P.svcV = null; }
      P.ticket = null; P.carry = [];
    }
  },
  update(dt, dm) {
    // paie : toutes les 30 min de service
    if (P.onDuty) {
      P.dutyAcc += dm;
      while (P.dutyAcc >= 30) {
        P.dutyAcc -= 30;
        const J = JOBS[P.job];
        const amt = Eco.pay(J.emp, P.empBid, Jobs.wage() * 0.5);
        P.bank += amt; P.stats.earned += amt;
        if (amt > 0) toast(`💶 Salaire : +${money(amt)} (virement)`, 'good');
        else toast('Votre employeur ne peut pas vous payer !', 'bad');
        Jobs.xp(P.job === 'fastfood' || P.job === 'banker' ? 2 : 3);
      }
      // sortie de service automatique s'il y a trop longtemps hors de la zone
    }
    if (Jobs.ff) Jobs.ff.update(dt);
    if (Jobs.bank) Jobs.bank.update(dt);
    Prison.update(dt);
  },
  onEnter(b) { Escort.sync(); },
  onLeave(b) { Escort.sync(true); },
  // gestion d'équipe pour grades >= 3
  canManage() { return P.job !== 'none' && P.jobRank >= 3; },
  team() { return G.npcs.filter((n) => n.state !== 'dead' && (n.job === P.job && n.work === P.empBid)); },
};

// ================= Escorte (suspects menottés, patients) =================
const Escort = {
  add(n, type) {
    P.escort = P.escort || []; if (!P.escort.includes(n)) P.escort.push(n);
    n.busy = true; n.escortType = type; n.cuffed = type === 'suspect'; n.loc = 'out'; n.state = type === 'suspect' ? 'cuffed' : 'down';
    n.x = P.x - 10; n.y = P.y - 10;
    Escort.sync();
  },
  remove(n) {
    P.escort = (P.escort || []).filter((q) => q !== n);
    Interior.remove(n); n.escortType = null;
  },
  sync(leaving) {
    if (!P.escort || !P.escort.length) return;
    for (const n of P.escort) {
      if (G.scene === 'out') {
        if (P.veh) { n.loc = 'esc'; } else { if (n.loc !== 'out') { n.loc = 'out'; n.x = P.x; n.y = P.y; } Interior.remove(n); }
      } else {
        n.loc = 'esc';
        if (!Interior.list.some((e) => e.n === n)) Interior.list.push({ n, x: P.x - 8, y: P.y + 8, tx: P.x, ty: P.y, role: 'escort', wait: 99, a: 0, follow: true });
      }
    }
  },
  update(dt) {
    if (!P.escort || !P.escort.length) return;
    P.escort = P.escort.filter((n) => n.state !== 'dead');
    P.escort.forEach((n, i) => {
      if (n.loc === 'out' && G.scene === 'out' && !P.veh) {
        const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy), want = 22 + i * 14;
        if (d > want) {
          const sp = Math.min(130, Math.max(60, d)) * dt, nx = n.x + dx / d * sp, ny = n.y + dy / d * sp;
          if (!blockedOut(nx, n.y, 6)) n.x = nx; if (!blockedOut(n.x, ny, 6)) n.y = ny; n.a = Math.atan2(dy, dx); n.step = (n.step || 0) + dt * 8;
          if (d > 200) { n.x = P.x - 14; n.y = P.y; }
        }
      } else if (n.loc === 'esc' && G.scene !== 'out') {
        const e = Interior.list.find((q) => q.n === n);
        if (e) { const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy); if (d > 26) { const sp = 90 * dt; const nx = e.x + dx / d * sp, ny = e.y + dy / d * sp; if (!blockedIn(Interior.S, nx, e.y, 6)) e.x = nx; if (!blockedIn(Interior.S, e.x, ny, 6)) e.y = ny; e.a = Math.atan2(dy, dx); e.moving = true; } else e.moving = false; }
      }
    });
  },
};

// ================= Incidents =================
const Incidents = {
  timer: 40, list() { return G.incidents; },
  forJob(job) { const m = { police: ['robbery', 'fight'], fire: ['fire'], ems: ['medical'] }[job]; return m ? G.incidents.filter((i) => m.includes(i.type) && !i.done) : []; },
  add(inc) { inc.id = G.uid++; inc.age = 0; inc.done = false; G.incidents.push(inc); return inc; },
  update(dt) {
    if (P.jail || P.sleeping) return;
    Incidents.timer -= dt;
    const emergencyDuty = P.onDuty && ['police', 'fire', 'ems'].includes(P.job);
    if (Incidents.timer <= 0 && G.incidents.filter((i) => !i.done).length < 3) {
      Incidents.timer = emergencyDuty ? rand(55, 100) : rand(150, 260);
      Incidents.spawn(emergencyDuty ? P.job : null);
    }
    for (const inc of G.incidents) {
      if (inc.done) { inc.fade = (inc.fade || 0) + dt; continue; }
      inc.age += dt;
      Incidents.tick(inc, dt);
    }
    G.incidents = G.incidents.filter((i) => !i.done || i.fade < 20);
  },
  spawn(job) {
    const r = Math.random(); let type;
    if (job === 'police') type = r < 0.6 ? 'robbery' : 'fight';
    else if (job === 'fire') type = 'fire';
    else if (job === 'ems') type = 'medical';
    else type = r < 0.28 ? 'fire' : r < 0.55 ? 'medical' : r < 0.8 ? 'robbery' : 'fight';
    if (type === 'fire') Fire.spawn();
    else if (type === 'medical') EMS.spawnMedical();
    else if (type === 'robbery') Police.spawnRobbery();
    else Police.spawnFight();
  },
  tick(inc, dt) {
    if (inc.type === 'fire') Fire.tick(inc, dt);
    else if (inc.type === 'medical') EMS.tick(inc, dt);
    else if (inc.type === 'robbery') Police.tickRobbery(inc, dt);
    else if (inc.type === 'fight') Police.tickFight(inc, dt);
  },
  notify(inc, text) {
    const mine = { police: ['robbery', 'fight'], fire: ['fire'], ems: ['medical'] }[P.job];
    if (P.onDuty && mine && mine.includes(inc.type)) {
      Msg.push('Dispatch', text);
      P.wp = { x: inc.x, y: inc.y, label: 'Intervention' };
      Snd.notif();
    }
  },
  nearestFor(job) {
    let best = null, bd = 1e9; for (const i of Incidents.forJob(job)) { const d = Math.hypot(i.x - P.x, i.y - P.y); if (d < bd) { bd = d; best = i; } } return best;
  },
};

// ================= Pompiers =================
const Fire = {
  spawn() {
    const cands = W.buildings.filter((b) => ['house', 'apt', 'store', 'office', 'bar', 'restaurant', 'fastfood', 'gas', 'club'].includes(b.kind));
    const b = pick(cands);
    const inc = Incidents.add({ type: 'fire', bid: b.id, x: (b.x + b.w / 2) * TS, y: (b.y + b.h / 2) * TS, hp: 100, npcResp: rand(110, 160), ember: 0 });
    Eco.addNews(`Incendie signalé : ${b.name} !`);
    Incidents.notify(inc, `🔥 Incendie au ${b.name} ! Rendez-vous sur place avec le camion.`);
    if (!P.onDuty || P.job !== 'fire') toast(`🔥 Un incendie s'est déclaré (${b.name}) !`, 'warn');
  },
  tick(inc, dt) {
    inc.ember += dt;
    const b = W.buildings[inc.bid];
    if (inc.ember > 25) { inc.ember = 0; b.damage = (b.damage || 0) + 1; inc.hp = Math.min(130, inc.hp + 6); }
    if (inc.age > inc.npcResp) { Fire.end(inc, false); }
  },
  end(inc, byPlayer) {
    inc.done = true; const b = W.buildings[inc.bid];
    const cost = 120 * (1 + (b.damage || 0));
    if (b.damage) { const biz = G.biz[b.id]; if (biz) { biz.cash -= cost; } else for (const n of G.npcs) if (n.home === b.id) { const c = Math.min(cost / 2, n.bank + n.money); Eco.charge(n, c); } b.damage = 0; }
    if (byPlayer) Eco.addNews(`Incendie maîtrisé au ${b.name} grâce à un pompier.`);
    else Eco.addNews(`Les pompiers ont éteint l'incendie du ${b.name}.`);
  },
  hook(c) {
    if (G.scene !== 'out') return;
    for (const inc of G.incidents) {
      if (inc.type !== 'fire' || inc.done) continue;
      const b = W.buildings[inc.bid];
      const l = b.x * TS, t = b.y * TS, r = l + b.w * TS, bt = t + b.h * TS;
      const dx = Math.max(l - P.x, 0, P.x - r), dy = Math.max(t - P.y, 0, P.y - bt), d = Math.hypot(dx, dy);
      const veh = Player.inVeh(); const truck = veh && veh.type === 'fire' && d < 150;
      if (d < 60 && !veh || truck) c.push({ d: d - 20, label: truck ? '🚒 Arroser avec la lance (maintenir)' : '🧯 Éteindre l\'incendie (maintenir)', hold: true, run: (dt) => {
        inc.hp -= (truck ? 80 : 34) * (1 + P.jobRank * (P.job === 'fire' ? 0.08 : 0)) * dt; Snd.beep(300 + Math.random() * 60, 0.03, 'sawtooth', 0.02);
        if (inc.hp <= 0 && !inc.done) {
          Fire.end(inc, true);
          if (P.job === 'fire' && P.onDuty) { const pay = 160 + P.jobRank * 30; P.bank += Eco.pay('state', null, pay); P.stats.fires++; Jobs.xp(45); toast(`🧯 Incendie éteint ! +${money(pay)}`, 'good'); }
          else { P.cash += 40; toast('Vous avez éteint l\'incendie. Les voisins vous remercient (+40 €).', 'good'); P.charm += 1; }
          for (const n of G.npcs) if (n.home === b.id) n.rel += 15;
        }
      } });
    }
  },
};

// ================= Ambulance / Hôpital =================
const EMS = {
  spawnMedical() {
    const out = NPC.free().filter((n) => n.loc === 'out' && Math.hypot(n.x - P.x, n.y - P.y) > 250);
    let n = out.length && chance(0.7) ? pick(out) : null;
    if (!n) { n = pick(NPC.free()); if (!n || !NPC.placeRandom(n, 300, 1100)) return; }
    n.hp = 22; n.state = 'down'; n.busy = true; n.downT = 150;
    const inc = EMS.reportDown(n, true);
    Incidents.notify(inc, `🚑 Personne inconsciente (${n.name}). Intervenez !`);
    if (!P.onDuty || P.job !== 'ems') toast('🚑 Quelqu\'un s\'est effondré dans la rue.', 'warn');
  },
  reportDown(n, quiet) {
    const ex = G.incidents.find((i) => i.type === 'medical' && i.npc === n.id && !i.done); if (ex) return ex;
    return Incidents.add({ type: 'medical', npc: n.id, x: n.x, y: n.y, npcResp: rand(100, 150) });
  },
  tick(inc, dt) {
    const n = G.npcs[inc.npc];
    if (!n || n.state === 'dead') { inc.done = true; return; }
    if (n.escortType === 'patient') { inc.x = P.x; inc.y = P.y; return; }
    inc.x = n.x; inc.y = n.y;
    if (n.state !== 'down') { inc.done = true; return; }
    if (inc.age > inc.npcResp) {
      inc.done = true; n.hospital = true; n.loc = 'hospital'; n.hospUntil = G.t + 150; n.state = 'idle'; n.cuffed = false;
      Eco.addNews(`${n.name} a été pris(e) en charge par les secours.`);
    }
  },
  treat(n) {
    n.hp = 70; n.state = 'idle'; n.busy = false; n.planDay = -1; n.rel += 20;
    for (const i of G.incidents) if (i.type === 'medical' && i.npc === n.id) i.done = true;
  },
  hospitalUpdate() {
    for (const n of G.npcs) if (n.hospital && G.t >= n.hospUntil) {
      n.hospital = false; n.busy = false; n.hp = 80; n.loc = 'out'; const hb = W.byKind.hospital[0]; const f = frontPx(hb); n.x = f.x; n.y = f.y; n.state = 'walk'; n.planDay = -1; n.tile = null;
    }
    // sans intervention, les blessés au sol finissent par se relever
    for (const n of G.npcs) if (n.state === 'down' && n.loc === 'out' && !n.escortType && !n.cuffed) { n.downT = (n.downT || 100) - 2; if (n.downT <= 0 && !G.incidents.some((i) => i.npc === n.id && !i.done)) { n.state = 'idle'; n.busy = false; n.hp = 40; } }
  },
  hook(n, items) {
    if (n.state !== 'down') return;
    const ems = P.job === 'ems' && P.onDuty;
    items.unshift({ label: ems ? '🩺 Soigner sur place' : '🩹 Porter secours', sub: ems ? 'Intervention d\'urgence' : 'Gestes de premiers secours', fn: () => {
      UI.progress('Prise en charge…', ems ? Math.max(2, 4.5 - P.jobRank * 0.4) : 6, () => {
        EMS.treat(n);
        if (ems) { const pay = 140 + P.jobRank * 25; P.bank += Eco.pay('state', null, pay); P.stats.rescues++; Jobs.xp(40); toast(`🩺 Patient stabilisé. +${money(pay)}`, 'good'); }
        else { P.charm += 1; toast('Vous avez aidé cette personne. Elle vous remercie !', 'good'); P.cash += 15; }
      });
    } });
    if (ems) items.unshift({ label: '🚑 Charger pour l\'hôpital', sub: 'Rémunération plus élevée', fn: () => { Escort.add(n, 'patient'); toast('Patient pris en charge — conduisez-le à l\'hôpital.', 'good'); P.wp = { ...frontPx(W.byKind.hospital[0]), label: 'Hôpital' }; } });
    else items.unshift({ label: '📞 Appeler une ambulance', fn: () => { EMS.reportDown(n); toast('Les secours ont été prévenus.', 'good'); } });
  },
};

// ================= Police =================
const Police = {
  taser: false, units: [], catchT: 0, spawnT: 0,
  alert(x, y) { Police.spawnT = Math.min(Police.spawnT, 2); },
  copNear(pt, r) {
    for (const v of G.vehicles) if (v.owner === 'cop' && Math.hypot(v.x - pt.x, v.y - pt.y) < r) return true;
    for (const n of G.npcs) if (n.job === 'police' && n.loc === 'out' && Math.hypot(n.x - pt.x, n.y - pt.y) < r * 0.7) return true;
    return false;
  },
  update(dt) {
    const out = G.scene === 'out';
    const stars = P.wanted;
    const cars = G.vehicles.filter((v) => v.owner === 'cop');
    if (stars > 0 && out && !P.jail) {
      Police.spawnT -= dt;
      const want = stars >= 4 ? 4 : stars >= 3 ? 3 : stars >= 2 ? 2 : 1;
      if (cars.length < want && Police.spawnT <= 0) { Police.spawnT = 5; Police.spawnCar(); }
      // policiers à pied
      for (const n of G.npcs) {
        if (n.job !== 'police' || n.loc !== 'out' || n.cuffed) continue;
        const d = Math.hypot(n.x - P.x, n.y - P.y);
        if (d < 380 && !n.chase) { n.chase = true; n.busy = true; }
      }
      // champs de distance vers le joueur (recalculés régulièrement)
      Police.fT = (Police.fT || 0) - dt;
      const gx = clamp(Math.floor(P.x / TS), 0, MAPW - 1), gy = clamp(Math.floor(P.y / TS), 0, MAPH - 1);
      if (Police.fT <= 0 || Police.gx !== gx || Police.gy !== gy && Police.fT < 0.3) { Police.fT = 0.8; Police.gx = gx; Police.gy = gy; Police.fCar = NPC.buildField(gx, gy, (t) => (BUILD_SOLID(t) ? 0 : carCost(t))); Police.fFoot = NPC.buildField(gx, gy, walkCost); }
      // poursuite
      let caught = false;
      const pv = Player.inVeh();
      const pspeed = pv ? Math.abs(pv.v) : (Math.hypot(Input.vec().x, Input.vec().y) > 0.3 ? (Input.running() ? 150 : 92) : 0);
      for (const v of cars) {
        const d = Veh.follow(v, Police.fCar, P.x, P.y, 0.85 + stars * 0.04);
        v.siren = true; v.brake = 0;
        Veh.step(v, dt);
        if (d < 60 && pspeed < 70) caught = true;
        if (d < 24) caught = caught || pspeed < 110;
        if (pv) Veh.collide(v, pv);
        for (const o of cars) if (o !== v) Veh.collide(v, o);
      }
      for (const n of G.npcs) if (n.chase && n.loc === 'out') {
        let dx = P.x - n.x, dy = P.y - n.y; const d = Math.hypot(dx, dy);
        if (d > 90) { const st = NPC.bestStep(Police.fFoot, n.x, n.y); if (st) { dx = (st[0] + 0.5) * TS - n.x; dy = (st[1] + 0.5) * TS - n.y; } }
        const dd = Math.hypot(dx, dy) || 1;
        if (d > 18) { const sp = 108 * dt; const nx = n.x + dx / dd * sp, ny = n.y + dy / dd * sp; if (!blockedOut(nx, n.y, 6)) n.x = nx; if (!blockedOut(n.x, ny, 6)) n.y = ny; n.a = Math.atan2(dy, dx); n.step = (n.step || 0) + dt * 10; }
        if (d < 26 && pspeed < 120 && !pv) caught = true;
        if (d < 14 && pspeed < 160 && !pv && n.job === 'police') caught = true;
      }
      if (caught) Police.catchT += dt; else Police.catchT = Math.max(0, Police.catchT - dt * 2);
      if (Police.catchT > (P.cuffed ? 0 : 1.1)) { Police.catchT = 0; Police.arrestPlayer(); }
    } else {
      Police.catchT = 0;
      if (P.heat <= 0) {
        for (const n of G.npcs) if (n.chase) { n.chase = false; if (n.state !== 'down' && !n.cuffed) { n.busy = false; n.planDay = -1; n.tile = null; } }
        for (const v of cars) { v.siren = false; v.owner = 'traffic'; v.driver = 'ai'; v.dir = Math.round((v.a / (Math.PI / 2)) % 4 + 4) % 4; v.cruise = 0.5; v.keep = false; }
      }
      // dans un bâtiment avec 3 étoiles+ : descente de police
      if (stars >= 3 && !out && !P.jail) { Police.raid = (Police.raid || 0) + dt; if (Police.raid > 45) { Police.raid = 0; Police.arrestPlayer(); } } else Police.raid = 0;
    }
  },
  spawnCar() {
    const near = Player.inVeh() || P;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * 6.283, d = rand(520, 760);
      let x = near.x + Math.cos(a) * d, y = near.y + Math.sin(a) * d;
      x = clamp(x, 40, MAPW * TS - 40); y = clamp(y, 40, MAPH * TS - 40);
      // aligne sur la route la plus proche
      const rx = W.vx.reduce((b, c) => (Math.abs(c * TS - x) < Math.abs(b * TS - x) ? c : b)), ry = W.hy.reduce((b, c) => (Math.abs(c * TS - y) < Math.abs(b * TS - y) ? c : b));
      if (Math.abs(rx * TS - x) < Math.abs(ry * TS - y)) x = (rx + 0.5) * TS; else y = (ry + 0.5) * TS;
      if (Math.hypot(x - near.x, y - near.y) < 380) continue;
      if (G.vehicles.some((o) => Math.hypot(o.x - x, o.y - y) < 60)) continue;
      const v = Veh.create('police', x, y, Math.atan2(near.y - y, near.x - x), { owner: 'cop', col: '#f8fafc', driver: 'ai', siren: true, forJob: 'police', keep: true });
      return v;
    }
  },
  arrestPlayer() {
    if (P.jail) return;
    const stars = Math.max(1, P.wanted);
    Police.catchT = 0;
    for (const n of G.npcs) if (n.chase) { n.chase = false; n.busy = false; }
    for (const v of G.vehicles.filter((q) => q.owner === 'cop')) Veh.remove(v);
    const reason = P.lastCrime || 'infractions multiples';
    const minor = stars <= 1 && P.crimes <= 3 && chance(0.7);
    if (minor) {
      const fine = Math.min(P.cash + P.bank, 250 + P.crimes * 40);
      Eco.charge(P, fine); G.eco.treasury += fine; P.heat = 0; P.wanted = 0; P.crimes = Math.max(0, P.crimes - 2);
      toast(`👮 Contrôlé(e) : amende de ${money(fine)} pour « ${esc(reason)} ». Vous êtes relâché(e).`, 'bad');
      const veh = Player.inVeh(); if (veh) { veh.v = 0; }
      return;
    }
    P.stats.jailed = (P.stats.jailed || 0) + 1;
    if (P.job === 'police' || P.job === 'guard') { Jobs.duty(false); P.job = 'none'; P.jobRank = 0; P.empBid = null; toast('Vous avez été radié(e) de votre corps.', 'bad'); }
    if (P.job !== 'none') { Jobs.duty(false); }
    const mins = clamp(30 + stars * 38 + P.crimes * 5, 30, 420);
    P.crimes = 0;
    Jail.send(mins, reason);
  },
  // ---------- incidents policiers ----------
  spawnRobbery() {
    const shops = W.buildings.filter((b) => ['store', 'gas', 'fastfood', 'bar'].includes(b.kind) && Doors.isOpen(b));
    if (!shops.length) return;
    const b = pick(shops);
    const cands = G.npcs.filter((n) => !n.busy && n.state !== 'dead' && n.job !== 'police' && n.loc !== 'prison' && !n.hospital && n.loc !== 'esc' && n.crim > 0.35);
    if (!cands.length) return;
    const n = cands.sort((a, c) => c.crim - a.crim)[Math.floor(Math.random() * Math.min(5, cands.length))];
    if (typeof n.loc === 'number') { const old = n.loc; n.loc = 'out'; Interior.list = Interior.list.filter((e) => e.n !== n); }
    const f = frontPx(b); n.loc = 'out'; n.x = f.x; n.y = f.y; n.tile = null;
    const biz = G.biz[b.id]; const loot = biz ? Math.min(biz.cash, randi(200, 600)) : 300; if (biz) biz.cash -= loot; n.money += loot;
    const hide = W.buildings[n.home];
    n.state = 'flee'; n.fleeT = 999; n.override = { key: 'b' + n.home, until: G.t + 600 }; n.crimFlag = true; n.destKey = null; n.think = 0; n.speed = 62;
    const inc = Incidents.add({ type: 'robbery', bid: b.id, suspect: n.id, x: f.x, y: f.y, npcResp: rand(130, 190), loot });
    Eco.addNews(`Braquage au ${b.name} !`);
    toast(`🚨 Braquage en cours : ${b.name}`, 'bad');
    Incidents.notify(inc, `🚨 Braquage au ${b.name}. Suspect en fuite : ${n.name}. Interpellez-le !`);
  },
  tickRobbery(inc, dt) {
    const n = G.npcs[inc.suspect];
    if (!n) { inc.done = true; return; }
    if (n.cuffed) { inc.x = n.x; inc.y = n.y; return; }
    if (typeof n.loc === 'number') { // il a rejoint sa planque
      inc.done = true; n.crimFlag = false; n.state = 'idle'; n.override = null; n.speed = rand(38, 54); n.planDay = -1;
      Eco.addNews('Le braqueur a échappé aux forces de l\'ordre.');
      if (P.onDuty && P.job === 'police') toast('Le suspect s\'est enfui dans une habitation.', 'warn');
      return;
    }
    if (n.loc === 'out') { inc.x = n.x; inc.y = n.y; }
    if (inc.age > inc.npcResp) {
      inc.done = true; n.crimFlag = false; n.override = null; n.state = 'idle'; n.speed = rand(38, 54);
      Police.imprison(n, 150);
      Eco.addNews(`La police a arrêté ${n.name} après le braquage.`);
    }
  },
  spawnFight() {
    const fr = NPC.free(); if (fr.length < 2) return;
    const a = pick(fr); if (!NPC.placeRandom(a, 250, 1100)) return;
    const b = pick(fr.filter((n) => n !== a)); if (typeof b.loc === 'number') Interior.remove(b); b.loc = 'out'; b.tile = null; b.x = a.x + 18; b.y = a.y;
    a.busy = b.busy = true; a.state = b.state = 'fight'; b.x = a.x + 18; b.y = a.y;
    a.tile = b.tile = null;
    const inc = Incidents.add({ type: 'fight', a: a.id, b: b.id, x: a.x, y: a.y, npcResp: 75 });
    Incidents.notify(inc, `👊 Bagarre signalée dans la rue.`);
    toast('👊 Une bagarre éclate quelque part…', 'warn');
  },
  tickFight(inc, dt) {
    const a = G.npcs[inc.a], b = G.npcs[inc.b];
    if (inc.age > inc.npcResp) { inc.done = true; Police.endFight(a, b, true); }
  },
  endFight(a, b, hurt) {
    for (const n of [a, b]) { n.busy = false; n.state = 'idle'; n.planDay = -1; n.tile = null; }
    if (hurt) { b.hp = 15; b.state = 'down'; b.busy = true; b.downT = 100; EMS.reportDown(b); a.state = 'flee'; a.fleeT = 8; a.busy = false; }
  },
  imprison(n, mins) {
    G.prisoners = G.prisoners || [];
    n.state = 'idle'; n.cuffed = false; n.busy = false; n.crimFlag = false; n.chase = false; n.override = null;
    if (n.escortType) Escort.remove(n);
    G.prisoners.push({ npc: n.id, until: G.t + mins }); n.loc = 'prison';
    if (Interior.list.length) Interior.list = Interior.list.filter((e) => e.n !== n);
  },
  prisonUpdate() {
    G.prisoners = (G.prisoners || []).filter((pr) => {
      if (G.t < pr.until) return true;
      const n = G.npcs[pr.npc]; if (n && n.loc === 'prison') { n.loc = n.home; n.crim = Math.max(0.1, n.crim - 0.05); n.planDay = -1; n.x = 0; n.y = 0; Interior.list = Interior.list.filter((e) => e.n !== n); }
      return false;
    });
  },
  useTaser() {
    Snd.beep(900, 0.12, 'sawtooth', 0.06); const hit = Combat.target(80); P.punch = 0.25;
    if (hit && hit.n) { const n = hit.n; n.state = 'down'; n.busy = true; n.downT = 5; n.stunned = 5; toast('⚡ Suspect neutralisé.'); setTimeout(() => { if (n.stunned) { n.stunned = 0; if (!n.cuffed && n.state === 'down') { n.state = n.crimFlag ? 'flee' : 'idle'; n.busy = false; } } }, 5000); }
  },
  control(n) {
    // contrôle d'identité
    const r = Math.random();
    if (n.crimFlag) { toast(`${n.name} est recherché(e) !`, 'warn'); return; }
    if (r < n.crim * 0.5) { toast(`${n.name} détient des objets illégaux — arrestation possible.`, 'warn'); n.contraband = true; }
    else if (r < 0.2 + n.crim * 0.3) { const f = randi(60, 120); G.eco.treasury += f; P.bank += Eco.pay('state', null, f * 0.3); Eco.charge(n, Math.min(f, n.money + n.bank)); toast(`Amende de ${money(f)} dressée à ${n.name}.`, 'good'); Jobs.xp(6); n.rel -= 10; }
    else { toast(`${n.name} : papiers en règle.`); Jobs.xp(1); }
  },
  hook(n, items) {
    if (!(P.job === 'police' && P.onDuty)) return;
    if (n.cuffed) { items.unshift({ label: '👮 Relâcher', fn: () => { Escort.remove(n); n.cuffed = false; n.busy = false; n.state = 'idle'; n.planDay = -1; } }); return; }
    items.unshift({ label: '🪪 Contrôler', sub: 'Vérifier l\'identité', fn: () => Police.control(n) });
    items.unshift({ label: '🔗 Menotter / arrêter', sub: n.crimFlag || n.contraband ? 'Motif valable' : 'Sans motif : abus de pouvoir !', fn: () => {
      UI.progress('Menottage…', 2, () => {
        if (!(n.crimFlag || n.contraband)) { Jobs.xp(-30); toast('Arrestation arbitraire ! Vous perdez de l\'expérience.', 'bad'); }
        n.override = null; n.crimFlag = false; n.state = 'cuffed';
        Escort.add(n, 'suspect'); n.suspectReason = n.contraband ? 'détention illégale' : 'braquage';
        for (const i of G.incidents) if (i.type === 'robbery' && i.suspect === n.id) { i.done = true; }
        toast('Suspect menotté — ramenez-le au commissariat.', 'good'); P.wp = { ...frontPx(W.byKind.police[0]), label: 'Commissariat' };
      });
    } });
  },
  scanHook(c) {
    if (G.scene !== 'out') return;
    for (const inc of G.incidents) {
      if (inc.type !== 'fight' || inc.done) continue;
      const d = Math.hypot(inc.x - P.x, inc.y - P.y);
      if (d < 60) c.push({ d, label: '✋ Séparer la bagarre', run: () => UI.progress('Intervention…', 3, () => {
        inc.done = true; Police.endFight(G.npcs[inc.a], G.npcs[inc.b], false);
        if (P.job === 'police' && P.onDuty) { const pay = 90 + P.jobRank * 15; P.bank += Eco.pay('state', null, pay); Jobs.xp(25); toast(`Bagarre calmée. +${money(pay)}`, 'good'); } else { P.charm += 1; toast('Vous avez calmé la bagarre.', 'good'); }
      }) });
    }
  },
};
Talk.hooks.push(Police.hook, EMS.hook);
Interact.hooks.push(Fire.hook, Police.scanHook);

// ================= Prison (détenu + gardien) =================
const Prison = {
  patrol: { next: 0, t: 0 }, fightT: 60, hasFight: null,
  update(dt) {
    if (G.scene === 'out' || !Interior.b || Interior.b.kind !== 'prison') { return; }
    if (P.job === 'guard' && P.onDuty) {
      Prison.fightT -= dt;
      if (Prison.fightT <= 0 && !Prison.hasFight) {
        Prison.fightT = rand(70, 130);
        const pr = Interior.list.filter((e) => e.prisoner && !e.fight);
        if (pr.length >= 2) {
          const a = pr[0], b = pr[1]; a.fight = b.fight = true; a.hold = b.hold = true; b.x = a.x + 16; b.y = a.y; a.tx = a.x; a.ty = a.y; b.tx = b.x; b.ty = b.y; a.moving = b.moving = false;
          Prison.hasFight = { a, b, t: 0 }; toast('⚔️ Bagarre dans la prison ! Intervenez !', 'bad');
          P.wp = null;
        }
      }
      if (Prison.hasFight) { Prison.hasFight.t += dt; if (Prison.hasFight.t > 40) { toast('La bagarre a dégénéré… (−25 XP)', 'bad'); Jobs.xp(-25); Prison.endFight(); } }
    }
  },
  endFight() { const f = Prison.hasFight; if (!f) return; f.a.fight = f.b.fight = false; f.a.hold = f.b.hold = false; Prison.hasFight = null; },
};

// ================= Fast Fast Food =================
Jobs.ff = {
  ticketsOf(b) { b.tickets = b.tickets || []; return b.tickets; },
  addTicket(npc, b, items) {
    const T = Jobs.ff.ticketsOf(b);
    if (T.length >= 4) { let ok = false; for (const w of items) if (Eco.sale(b.id, w, 1, npc)) ok = true; return; }
    T.push({ id: G.uid++, npc: npc.id, name: npc.name, items: items.slice(), state: 'new', born: _rt, patience: 110, n: npc });
  },
  ghost(b) {
    const T = Jobs.ff.ticketsOf(b);
    if (T.length >= 3) return;
    const items = []; if (chance(0.8)) items.push('burger'); if (chance(0.55)) items.push('fries'); if (chance(0.8) || !items.length) items.push('soda');
    const fake = { id: -G.uid, name: pick(FIRST_M.concat(FIRST_F)) + ' (de passage)', col: pick(NPC_COLORS), skin: pick(SKIN), hair: pick(HAIR), g: 0, money: 100, bank: 0, ghost: true, rel: 0, emoji: '🧑', age: 30 };
    const t = { id: G.uid++, npc: -1, name: fake.name, items, state: 'new', born: _rt, patience: 100, n: fake };
    T.push(t);
    const S = Interior.S; const q = S.extra.queue[(T.length - 1) % 3];
    Interior.list.push({ n: fake, x: (S.door.x + 0.5) * TS, y: (S.door.y - 0.5) * TS, tx: (q.x + 0.5) * TS, ty: (q.y + 0.5) * TS, role: 'queue', wait: 99, a: -Math.PI / 2, ghost: true, ticket: t });
  },
  update(dt) {
    if (!(P.onDuty && P.job === 'fastfood' && G.scene === P.empBid)) return;
    const b = W.buildings[P.empBid];
    const T = Jobs.ff.ticketsOf(b);
    Jobs.ff.gt = (Jobs.ff.gt || 0) - dt;
    if (Jobs.ff.gt <= 0) { Jobs.ff.gt = rand(22, 45); Jobs.ff.ghost(b); }
    for (const t of T) {
      t.patience -= dt;
      const e = Interior.list.find((q) => q.n === t.n);
      if (e) { const k = T.indexOf(t); const q = Interior.S.extra.queue[k % 3]; e.tx = (q.x + 0.5) * TS; e.ty = (q.y + 0.5) * TS; e.role = 'queue'; e.ticket = t; }
    }
    for (const t of T.slice()) if (t.patience <= 0) {
      T.splice(T.indexOf(t), 1);
      if (P.ticket === t) { P.ticket = null; P.carry = []; }
      toast(`${t.name} est parti(e) sans commander !`, 'bad'); Jobs.xp(-3);
      const e = Interior.list.find((q) => q.n === t.n);
      if (e) { if (t.n.ghost) Interior.list.splice(Interior.list.indexOf(e), 1); else { e.role = 'cust'; e.wait = 0; } }
    }
  },
  counter(b) {
    if (!(P.onDuty && P.job === 'fastfood' && P.empBid === b.id)) {
      Shop.open(b, ['burger', 'fries', 'soda', 'water'], '🍔 Fast Fast Food — Commande', { eat: true });
      return;
    }
    const T = Jobs.ff.ticketsOf(b);
    if (P.ticket && !T.includes(P.ticket)) P.ticket = null;
    if (!P.ticket) {
      const t = T.find((x) => x.state === 'new');
      if (!t) { toast('Aucun client en attente pour le moment.'); return; }
      t.state = 'cook'; P.ticket = t; P.carry = [];
      toast(`🧾 Commande de ${t.name} : ${t.items.map((k) => ITEMS[k].e).join(' ')}`, 'good');
      return;
    }
    const t = P.ticket; const missing = t.items.filter((k) => !P.carry.includes(k));
    if (missing.length) { toast(`Il manque : ${missing.map((k) => ITEMS[k].e + ' ' + ITEMS[k].n).join(', ')}`, 'warn'); return; }
    // livraison
    let total = 0;
    for (const k of t.items) { const price = Eco.price(k); if (t.n.ghost) { Eco.income(b.id, price); total += price; G.eco.sold[k] = (G.eco.sold[k] || 0) + 1; } else total += Eco.sale(b.id, k, 1, t.n); }
    const wait = _rt - t.born; const tipRate = wait < 45 ? 0.25 : wait < 80 ? 0.1 : 0;
    const tip = Math.round(total * tipRate * 100) / 100; P.cash += tip;
    const bonus = Math.round(2 + P.jobRank * 1.5); P.bank += Eco.pay('biz', b.id, bonus);
    Jobs.ff.ticketsOf(b).splice(Jobs.ff.ticketsOf(b).indexOf(t), 1);
    P.ticket = null; P.carry = []; P.stats.orders++;
    Jobs.xp(wait < 45 ? 12 : 8);
    toast(`✅ Commande servie (${money(total)}) · pourboire ${money(tip)} · +${wait < 45 ? 12 : 8} XP`, 'good'); Snd.good();
    const e = Interior.list.find((q) => q.n === t.n);
    if (e) { if (t.n.ghost) { e.role = 'cust'; e.leaving = true; e.tx = (Interior.S.door.x + 0.5) * TS; e.ty = (Interior.S.door.y + 0.2) * TS; setTimeout(() => { Interior.list = Interior.list.filter((q) => q !== e); }, 2500); } else { e.role = 'cust'; e.wait = 1; } }
    if (!t.n.ghost) t.n.hunger = 0;
  },
  station(item, secs) {
    if (!(P.onDuty && P.job === 'fastfood')) { toast('Cuisine réservée au personnel.', 'warn'); return; }
    if (!P.ticket) { toast('Prenez d\'abord une commande au comptoir.', 'warn'); return; }
    if (!P.ticket.items.includes(item)) { toast('Ce n\'est pas dans la commande.', 'warn'); return; }
    if (P.carry.includes(item)) { toast('Déjà préparé.'); return; }
    UI.progress(item === 'burger' ? 'Cuisson du burger…' : item === 'fries' ? 'Friture…' : 'Remplissage…', Math.max(1.2, secs - P.jobRank * 0.25), () => { P.carry.push(item); toast(`${ITEMS[item].e} ${ITEMS[item].n} prêt`, 'good'); Snd.click(); });
  },
};

// ================= Banque =================
Jobs.bank = {
  reqs(b) { b.requests = b.requests || []; return b.requests; },
  addRequest(npc, b) {
    const R = Jobs.bank.reqs(b); if (R.length >= 4) return;
    const r = Eco.loanRequest(npc);
    const type = chance(0.55) ? 'loan' : chance(0.5) ? 'deposit' : 'withdraw';
    R.push({ id: G.uid++, type, name: npc.name, npc: npc.id, inc: r.inc, debt: r.debt, amt: type === 'loan' ? r.amt : randi(2, 20) * 50, score: r.score, risky: r.risky, born: _rt });
  },
  update(dt) {
    if (!(P.onDuty && P.job === 'banker' && G.scene === P.empBid)) return;
    const b = W.buildings[P.empBid]; const R = Jobs.bank.reqs(b);
    Jobs.bank.gt = (Jobs.bank.gt || 0) - dt;
    if (Jobs.bank.gt <= 0 && R.length < 3) {
      Jobs.bank.gt = rand(25, 50);
      const name = pick(FIRST_M.concat(FIRST_F)) + ' ' + pick(LAST);
      const inc = randi(45, 260) * 8 / 8 * 1; const amt = Math.round(inc * randi(15, 70) / 100) * 100;
      const debt = chance(0.4) ? randi(1, 8) * 300 : 0;
      const score = clamp(0.45 + inc / 700 - debt / (inc * 30 + 1) + rand(-0.2, 0.2), 0, 1);
      R.push({ id: G.uid++, type: chance(0.65) ? 'loan' : 'deposit', name, npc: -1, inc, debt, amt, score, risky: score < 0.42, born: _rt });
      const S = Interior.S; const spot = S.cust[R.length % S.cust.length];
      const fake = { id: -G.uid, name, col: pick(NPC_COLORS), skin: pick(SKIN), hair: pick(HAIR), g: 0, ghost: true, emoji: '🧑' };
      Interior.list.push({ n: fake, x: (S.door.x + 0.5) * TS, y: (S.door.y - 0.5) * TS, tx: (spot.x + 0.5) * TS, ty: (spot.y + 0.5) * TS, role: 'cust', wait: 40, a: 0, ghost: true, req: R[R.length - 1] });
      toast('🏦 Un client attend au bureau.');
    }
  },
  desk(b) {
    if (!(P.onDuty && P.job === 'banker' && P.empBid === b.id)) {
      toast('Ce bureau est réservé aux conseillers en service.', 'warn'); return;
    }
    const R = Jobs.bank.reqs(b);
    if (!R.length) { toast('Aucun client pour le moment.'); return; }
    const r = R[0];
    const noisy = Math.round(clamp(r.score * 100 + (r.npc >= 0 ? (r.id % 11) - 5 : (r.id % 21) - 10), 3, 98));
    const done = (ok) => {
      R.shift();
      const e = Interior.list.find((q) => q.req === r); if (e) { e.role = 'cust'; e.leaving = true; e.tx = (Interior.S.door.x + 0.5) * TS; e.ty = (Interior.S.door.y + 0.2) * TS; e.hold = false; setTimeout(() => { Interior.list = Interior.list.filter((q) => q !== e); }, 3500); }
    };
    if (r.type === 'loan') {
      UI.menu(`Demande de prêt — ${esc(r.name)}`, `Montant : <b>${money(r.amt)}</b><br>Revenus estimés : ${money(r.inc)}/jour · Dettes existantes : ${money(r.debt)}<br>Score de solvabilité : <b>${noisy}/100</b> <span class="dim">(estimation)</span>`, [
        { label: '✅ Accorder le prêt', sub: `Commission 2 % (${money(r.amt * 0.02)})`, fn: () => {
          const biz = G.biz[b.id];
          if (biz.cash < r.amt) { toast('La banque n\'a pas assez de liquidités !', 'bad'); return; }
          biz.cash -= r.amt;
          if (r.npc >= 0) { G.npcs[r.npc].bank += r.amt; G.loans.push({ npc: r.npc, amt: r.amt, rate: 0.12, due: dayN() + randi(4, 9), risky: r.risky, bid: b.id, byPlayer: true, done: false }); }
          else G.loans.push({ npc: -1, amt: r.amt, rate: 0.12, due: dayN() + randi(4, 9), risky: r.risky, bid: b.id, byPlayer: true, done: false });
          const com = Math.round(r.amt * 0.02); P.bank += com; Jobs.xp(14); P.stats.loans++;
          toast(`Prêt accordé. Commission : ${money(com)}. Résultat connu à l'échéance.`, 'good'); done(true);
        } },
        { label: '❌ Refuser', fn: () => { if (r.risky) { Jobs.xp(10); P.bank += 25; toast('Bon réflexe : dossier risqué refusé. +25 € de prime, +10 XP', 'good'); } else { Jobs.xp(2); toast('Client mécontent, mais la banque reste prudente.'); } done(false); } },
        { label: '⏳ Plus tard', fn: () => { R.push(R.shift()); } },
      ], { noCancel: true });
    } else {
      UI.menu(`${r.type === 'deposit' ? 'Dépôt' : 'Retrait'} — ${esc(r.name)}`, `Opération de ${money(r.amt)}`, [
        { label: 'Traiter l\'opération', sub: '+8 € · +4 XP', fn: () => { P.bank += 8; Jobs.xp(4); const biz = G.biz[b.id]; if (r.type === 'deposit') biz.cash += r.amt * 0.2; toast('Opération traitée. +8 €', 'good'); done(true); } },
      ], { noCancel: true });
    }
  },
};

// ================= Hôpital / Pénitencier : actes =================
Acts.hospital_desk = (f, b) => {
  const items = [];
  const need = Math.ceil(100 - P.hp);
  items.push({ label: '🩺 Se faire soigner', sub: P.hp >= 99 ? 'Vous êtes en pleine forme' : 'Soins complets', right: money(need * 2), disabled: P.hp >= 99, fn: () => { if (Eco.charge(P, need * 2)) { Eco.income(b.id, need * 2); P.hp = 100; toast('Vous êtes soigné(e) !', 'good'); } else toast('Fonds insuffisants.', 'bad'); } });
  if (P.escort && P.escort.some((n) => n.escortType === 'patient')) items.unshift({ label: '🛏️ Déposer le patient', fn: () => {
    const n = P.escort.find((q) => q.escortType === 'patient'); Escort.remove(n);
    n.hospital = true; n.loc = 'hospital'; n.hospUntil = G.t + 120; n.state = 'idle'; n.busy = false; n.rel += 20;
    for (const i of G.incidents) if (i.type === 'medical' && i.npc === n.id) i.done = true;
    const pay = 260 + P.jobRank * 40; P.bank += Eco.pay('state', null, pay); P.stats.rescues++; Jobs.xp(70); toast(`🚑 Patient admis. +${money(pay)}`, 'good');
  } });
  UI.menu('🏥 Accueil des urgences', 'Hôpital central', items);
};
Acts.hospital_bed = () => {
  UI.confirm('Lit d\'hôpital', 'Se reposer ici restaure santé et énergie (80 €).', 'Se reposer', 'Non', () => {
    if (!Eco.charge(P, 80)) { toast('Fonds insuffisants.', 'bad'); return; } G.eco.treasury += 40; P.hp = 100; Sleep.start('hôpital', 6);
  });
};
Acts.locker = (f, b) => {
  const J = P.job !== 'none' ? JOBS[P.job] : null;
  if (!J || P.empBid !== b.id) { toast('Ce casier n\'est pas le vôtre.', 'warn'); return; }
  const items = [];
  items.push(P.onDuty ? { label: '🔴 Terminer le service', fn: () => Jobs.duty(false) } : { label: '🟢 Prendre son service', sub: `${J.name} — ${Jobs.rankName()} · ${money(Jobs.wage())}/h`, fn: () => Jobs.duty(true) });
  items.push({ label: '📊 Mon grade', sub: `XP ${P.jobXp}${P.jobRank < J.ranks.length - 1 ? ' / ' + RANK_XP[P.jobRank + 1] : ' (max)'}`, disabled: true });
  UI.menu('🗄️ Casier', J.name, items);
};
Acts.garage = (f, b) => {
  const J = P.job !== 'none' ? JOBS[P.job] : null;
  if (!J || !P.onDuty || P.empBid !== b.id) { toast('Garage réservé au personnel en service.', 'warn'); return; }
  const type = { police: 'police', fire: 'fire', ems: 'ambu' }[P.job];
  if (!type) { toast('Aucun véhicule de service pour ce métier.'); return; }
  const old = P.svcV ? Veh.byId(P.svcV) : null; if (old) Veh.remove(old);
  const fp = frontPx(b); const pos = Veh.nearestFree(fp.x + (b.face === 'N' ? 20 : -20), fp.y + (b.face === 'N' ? -50 : 50), 20);
  const v = Veh.create(type, pos.x, pos.y, b.face === 'N' ? -Math.PI / 2 : Math.PI / 2, { owner: 'job', col: type === 'police' ? '#f8fafc' : type === 'fire' ? '#dc2626' : '#f8fafc', forJob: P.job, locked: false });
  P.svcV = v.id; toast(`${VEH[type].emoji} Votre véhicule de service vous attend dehors.`, 'good');
};
Acts.armory = () => { if (P.job === 'police' && P.onDuty) { P.ammo = Math.max(P.ammo, 24); Inv.add('pistol'); toast('🔫 Arme de service et munitions fournies.', 'good'); } else toast('Armurerie réservée aux policiers en service.', 'warn'); };
Acts.booking = (f, b) => {
  const suspects = (P.escort || []).filter((n) => n.escortType === 'suspect');
  if (!(P.job === 'police' && P.onDuty)) { toast('Réservé aux agents en service.', 'warn'); return; }
  if (!suspects.length) { toast('Aucun suspect à enregistrer.'); return; }
  const n = suspects[0]; const mins = n.suspectReason === 'braquage' ? 180 : 60;
  UI.menu(`Enregistrer ${esc(n.name)}`, `Motif : ${esc(n.suspectReason || 'trouble')} — peine : ${Jail.fmt(mins)}`, [{ label: '📋 Écrouer à la prison', fn: () => {
    Police.imprison(n, mins); const pay = 140 + P.jobRank * 22; P.bank += Eco.pay('state', null, pay); P.stats.arrests++; Jobs.xp(55);
    toast(`Suspect écroué. +${money(pay)} · +55 XP`, 'good'); Snd.good();
  } }]);
};
Acts.police_desk = (f, b) => {
  const items = [];
  const wanted = G.npcs.filter((n) => n.crimFlag);
  items.push({ label: '🔎 Avis de recherche', sub: wanted.length ? wanted.map((n) => n.name).join(', ') : 'Aucun suspect en fuite', disabled: true });
  if (P.job === 'police') items.push({ label: '📊 Rapport de service', sub: `${P.stats.arrests} arrestations · ${P.stats.earned.toFixed(0)} € gagnés`, disabled: true });
  items.push({ label: '💶 Payer une amende', sub: 'Aucune amende à payer', disabled: true });
  UI.menu('🚓 Accueil du commissariat', 'Hôtel de police', items);
};
Acts.cell = () => toast('Cellule de garde à vue.');

// ----- Prison : actes -----
Acts.cellbed = (f, b) => {
  if (P.jail) {
    if (P.jail && f.n !== P.cell) { toast('Ce n\'est pas votre cellule.', 'warn'); return; }
    UI.confirm('Dormir en cellule', `Dormir pour faire passer le temps accélère l'horloge. Reste à purger : ${Jail.fmt(P.jail.until - G.t)}.`, 'Dormir', 'Non', () => { Sleep.start('cellule', 8, true); });
  } else if (P.job === 'guard' && P.onDuty) {
    UI.confirm('Fouille de cellule', 'Fouiller cette cellule ?', 'Fouiller', 'Non', () => UI.progress('Fouille…', 3, () => { if (chance(0.4)) { const pay = 60; P.bank += Eco.pay('state', null, pay); Jobs.xp(18); toast(`Contrebande trouvée ! +${money(pay)}`, 'good'); } else toast('Rien à signaler.'); }));
  }
};
Acts.prison_eat = () => {
  if (!P.jail) { toast('Réservé aux détenus.'); return; }
  if (G.t - (P.lastTray || -999) < 180) { toast('Vous avez déjà mangé récemment.'); return; }
  P.lastTray = G.t; P.hun = clamp(P.hun + 55, 0, 100); P.thi = clamp(P.thi + 30, 0, 100); toast('🍲 Un repas de prison… peu appétissant mais nourrissant.');
};
Acts.gym = () => {
  UI.progress('Séance de musculation…', 5, () => { P.skills.str = Math.min(10, P.skills.str + 0.25); P.ene = Math.max(0, P.ene - 6); P.fun = clamp(P.fun + 6, 0, 100); P.hun = Math.max(0, P.hun - 4); toast('💪 Force +0.25', 'good'); });
};
Acts.basket = () => { UI.progress('Match de basket…', 4, () => { P.fun = clamp(P.fun + 12, 0, 100); P.ene = Math.max(0, P.ene - 4); toast('🏀 Ça fait du bien !'); }); };
Acts.prison_work = () => {
  if (!P.jail) { toast('Réservé aux détenus.'); return; }
  UI.progress('Travail à l\'atelier…', 6, () => {
    const cut = 10; P.jail.until -= cut; P.jail.work++; P.cash += 6; P.ene = Math.max(0, P.ene - 3); G.eco.treasury -= 6;
    toast(`🧰 Journée de travail : peine réduite de ${cut} min (+6 €). Reste : ${Jail.fmt(Math.max(0, P.jail.until - G.t))}`, 'good');
  });
};
Acts.prison_phone = () => {
  if (!P.jail) return;
  UI.menu('☎️ Téléphone de la prison', `Reste à purger : ${Jail.fmt(Math.max(0, P.jail.until - G.t))}`, [
    { label: '⚖️ Appeler un avocat', sub: 'Réduit la peine de 25 % (une fois)', right: money(600), disabled: P.jail.lawyer, fn: () => { if (!Eco.charge(P, 600)) { toast('Fonds insuffisants.', 'bad'); return; } P.jail.lawyer = true; const rest = P.jail.until - G.t; P.jail.until -= rest * 0.25; toast('L\'avocat obtient une réduction de peine !', 'good'); } },
    { label: '💸 Payer la caution', sub: 'Sortir immédiatement', right: money(Jail.bail()), fn: () => { const c = Jail.bail(); if (!Eco.charge(P, c)) { toast('Fonds insuffisants pour la caution.', 'bad'); return; } G.eco.treasury += c; Jail.release(false); } },
  ]);
};
Acts.prison_dealer = () => {
  if (!P.jail) { toast('Il vous ignore.'); return; }
  UI.menu('🕶️ Détenu louche', '« Psst… j\'ai ce qu\'il te faut. »', [
    { label: '🗝️ Outil artisanal (crochet)', sub: 'Nécessaire pour s\'évader', right: money(250), fn: () => { if (Eco.charge(P, 250)) { Inv.add('lockpick'); toast('Il vous glisse un outil sous la table.', 'good'); } else toast('Fonds insuffisants.', 'bad'); } },
    { label: '🚬 Protection (anti-bagarre)', sub: 'Vous évite des ennuis', right: money(100), fn: () => { if (Eco.charge(P, 100)) { P.jail.protected = true; toast('Vous voilà sous protection.', 'good'); } } },
  ]);
};
Acts.escape = () => {
  if (!P.jail) return;
  if (!P.inv.lockpick) { toast('Il vous faut un outil pour creuser (voir le détenu louche).', 'warn'); return; }
  UI.progress('Creusage discret…', 8, () => {
    P.jail.dug++;
    if (chance(0.22)) { toast('🚨 Un gardien vous a vu ! +60 min de peine.', 'bad'); P.jail.until += 60; P.jail.dug = 0; return; }
    if (P.jail.dug >= 3) { Jail.release(true); Wanted.crime(0, 'évasion', false); P.heat = 4; } else toast(`Le mur cède peu à peu (${P.jail.dug}/3)…`);
  });
};
Acts.prison_desk = (f, b) => { if (P.job === 'guard') toast('Registre de la prison : ' + (G.prisoners ? G.prisoners.length : 0) + ' détenus.'); else toast('Accueil de la prison.'); };
Acts.checkpoint = (f) => {
  if (!(P.job === 'guard' && P.onDuty)) { toast('Point de ronde.'); return; }
  const pt = Prison.patrol;
  if (f.n !== pt.next) { toast(`Ordre de ronde : point ${'ABCD'[pt.next]} d'abord.`, 'warn'); return; }
  pt.next = (pt.next + 1) % 4; toast(`✔️ Point ${'ABCD'[f.n]} validé`, 'good');
  if (pt.next === 0) { const pay = 70 + P.jobRank * 10; P.bank += Eco.pay('state', null, pay); Jobs.xp(30); toast(`Ronde terminée ! +${money(pay)}`, 'good'); }
};
// Interaction : séparer une bagarre de détenus (gardien)
Interact.hooks.push((c) => {
  if (G.scene === 'out' || !Prison.hasFight) return;
  const f = Prison.hasFight; const d = Math.hypot(f.a.x - P.x, f.a.y - P.y);
  if (d < 60) c.push({ d, label: '✋ Séparer les détenus', run: () => UI.progress('Intervention…', 2.5, () => { Prison.endFight(); const pay = 90 + P.jobRank * 15; P.bank += Eco.pay('state', null, pay); Jobs.xp(35); toast(`Bagarre maîtrisée. +${money(pay)}`, 'good'); }) });
});
Acts.manager = (f, b) => {
  if (!(P.job === 'fastfood' && P.empBid === b.id && P.jobRank >= 3)) { toast('Bureau du gérant : accès réservé aux managers.', 'warn'); return; }
  const biz = G.biz[b.id];
  UI.menu('🗂️ Bureau du gérant', `Caisse : ${money(biz.cash)} · CA d'hier : ${money(biz.revY)} · Équipe : ${Jobs.team().length}`, [
    { label: '💰 Prime de caisse (5 %)', sub: 'Prélever une prime sur la caisse', right: money(biz.cash * 0.05), fn: () => { const p = Math.round(biz.cash * 0.05); biz.cash -= p; P.bank += p; toast(`Prime : +${money(p)}`, 'good'); } },
    { label: '📈 Augmenter les salaires (+10 %)', sub: 'Motivation et coût accrus', fn: () => { biz.wageMult = Math.min(1.5, biz.wageMult + 0.1); toast('Salaires revalorisés.', 'good'); } },
    { label: '📉 Baisser les salaires (-10 %)', fn: () => { biz.wageMult = Math.max(0.6, biz.wageMult - 0.1); toast('Salaires réduits.', 'warn'); } },
  ]);
};
