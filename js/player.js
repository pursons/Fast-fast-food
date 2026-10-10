'use strict';
// ===== Joueur : état, déplacement, interactions, besoins, recherche, prison =====
let P = null;
const Acts = {}; // gestionnaires d'actions des meubles (remplis dans plusieurs fichiers)
const Msg = {
  push(from, text, opts) {
    const th = (G.msgs[from] = G.msgs[from] || { name: from, msgs: [], unread: 0, npc: opts && opts.npc != null ? opts.npc : null, col: (opts && opts.col) || '#4f8cff' });
    th.msgs.push({ me: false, text, t: G.t, ...(opts && opts.actions ? { actions: opts.actions } : {}) });
    th.unread++; th.last = G.t;
    toast(`📩 <b>${esc(from)}</b> : ${esc(text.slice(0, 70))}`, '');
    Snd.notif();
    Phone.refreshBadge && Phone.refreshBadge();
  },
};

const Player = {
  create(name, col, gender) {
    const hb = W.buildings[W.playerHome];
    P = {
      name, col, g: gender || 0, x: 0, y: 0, a: Math.PI / 2, step: 0, cash: 900, bank: 3200, hp: 100, hun: 80, thi: 80, ene: 90, alc: 0, fun: 50, sta: 100,
      job: 'none', jobRank: 0, jobXp: 0, empBid: null, onDuty: false, dutyAcc: 0, heat: 0, wanted: 0, cool: 0, crimes: 0, jail: null,
      inv: { burger: 1, water: 1 }, veh: null, homeBid: hb.id, homeRent: 45, rentLate: 0, gang: null, gangRank: 0, respect: 0, charm: 35, followers: 120, weapon: 'fists', ammo: 0,
      skills: { str: 1, shoot: 1, drive: 1 }, outfit: 0, mission: null, loan: null, partner: null, dates: [], uniform: false, carry: [], stats: { earned: 0, arrests: 0, fires: 0, rescues: 0, orders: 0, loans: 0 }, appliedAt: null, lastPostT: 0,
    };
    G.scene = 'out';
    const f = frontPx(hb); P.x = f.x; P.y = f.y;
    // scooter de départ
    const v = Veh.create('scooter', f.x + 40, f.y, 0, { owner: 'player', col: '#38bdf8', locked: false });
    const free = Veh.nearestFree(f.x + 44, f.y, 14); v.x = free.x; v.y = free.y; P.ownV = [v.id];
    return P;
  },
  inVeh() { return P.veh ? Veh.byId(P.veh) : null; },
  scene() { return G.scene === 'out' ? null : Interior.S; },
  cur() { return G.scene === 'out' ? null : W.buildings[G.scene]; },
  blocked(x, y, r) { return G.scene === 'out' ? blockedOut(x, y, r) : blockedIn(Interior.S, x, y, r); },
  update(dt) {
    if (P.sleeping) { Sleep.update(dt); return; }
    if (UI.modalOpen && !UI.liveModal) return;
    const veh = Player.inVeh();
    const iv = Input.vec();
    if (veh) {
      veh.driver = 'player';
      let thr = -iv.y, str = iv.x;
      if (P.alc > 40) str += Math.sin(G.t * 3) * (P.alc - 40) / 100;
      veh.thr = thr; veh.str = clamp(str, -1, 1); veh.brake = Input.held.run;
      Veh.step(veh, dt);
      P.x = veh.x; P.y = veh.y; P.a = veh.a;
      return;
    }
    // à pied
    let { x, y, m } = iv;
    if (P.alc > 35 && m > 0) { x += Math.sin(G.t * 5) * (P.alc - 35) / 120; y += Math.cos(G.t * 4) * (P.alc - 35) / 120; }
    let speed = 92;
    const run = Input.running() && P.sta > 5 && m > 0.2;
    if (run) { speed = 150; P.sta = Math.max(0, P.sta - 22 * dt); } else P.sta = Math.min(100, P.sta + 14 * dt);
    if (P.hun < 8 || P.ene < 8) speed *= 0.7;
    if (P.cuffed) speed *= 0.6;
    if (m > 0.05) {
      const nx = P.x + x * speed * dt, ny = P.y + y * speed * dt;
      if (!Player.blocked(nx, P.y, 8)) P.x = nx;
      if (!Player.blocked(P.x, ny, 8)) P.y = ny;
      P.a = Math.atan2(y, x); P.step += dt * (run ? 14 : 9);
    }
    // collision douce avec PNJ
    if (G.scene === 'out') for (const n of G.npcs) if (n.loc === 'out' && !n.busy) { const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy); if (d < 12 && d > 0.1) { P.x += dx / d * 20 * dt; P.y += dy / d * 20 * dt; } }
  },
  enter(b) {
    if (P.veh) return;
    G.scene = b.id; Interior.load(b);
    const S = Interior.S; P.x = (S.door.x + 0.5) * TS; P.y = (S.door.y - 0.4) * TS; P.a = -Math.PI / 2;
    UI.fade('', 500);
    Jobs.onEnter && Jobs.onEnter(b);
    Missions.onEnter && Missions.onEnter(b);
  },
  leave() {
    const b = Player.cur(); if (!b) return;
    if (P.jail) { toast('Vous êtes enfermé. Les portes sont verrouillées.', 'bad'); return; }
    Jobs.onLeave && Jobs.onLeave(b);
    G.scene = 'out'; Interior.unload();
    const f = frontPx(b); P.x = f.x; P.y = f.y + (b.face === 'N' ? -4 : 4); P.a = b.face === 'N' ? -Math.PI / 2 : Math.PI / 2;
    UI.fade('', 400);
    Missions.onLeave && Missions.onLeave(b);
  },
  toggleVeh() {
    const cur = Player.inVeh();
    if (cur) {
      if (Math.abs(cur.v) > 90) { toast('Arrêtez-vous avant de descendre.', 'warn'); return; }
      const side = cur.a + Math.PI / 2;
      let spot = null;
      for (const s of [1, -1]) for (const dd of [30, 40]) { const px = cur.x + Math.cos(side) * dd * s, py = cur.y + Math.sin(side) * dd * s; if (!blockedOut(px, py, 8)) { spot = { x: px, y: py }; break; } }
      if (!spot) spot = Veh.nearestFree(cur.x, cur.y, 8);
      P.x = spot.x; P.y = spot.y; cur.driver = null; cur.thr = 0; cur.str = 0; cur.brake = 1; P.veh = null; cur.siren = false;
      if (P.escort && P.escort.length) { /* les suspects suivent à pied */ }
      return;
    }
    if (G.scene !== 'out') { toast('Sortez du bâtiment d\'abord.', 'warn'); return; }
    let best = null, bd = 56;
    for (const v of G.vehicles) { const d = Math.hypot(v.x - P.x, v.y - P.y); if (d < bd && !v.driver || d < bd && v.driver === 'ai') { bd = d; best = v; } }
    if (!best) { toast('Aucun véhicule à proximité.', 'warn'); return; }
    Player.useVeh(best);
  },
  useVeh(v) {
    const mine = P.ownV && P.ownV.includes(v.id);
    const jobOk = (v.forJob && P.job === v.forJob && P.onDuty) || (v.loan && P.gang === 'bikers');
    if (v.driver === 'ai') {
      UI.confirm('Car-jacking', `Sortir le conducteur de force et voler cette ${VEH[v.type].n} ? C'est un crime.`, 'Voler la voiture', 'Annuler', () => {
        Wanted.crime(1.5, 'car-jacking', true); v.driver = null; v.owner = 'stolen'; v.stolen = true; v.v = 0;
        const dn = Traffic.driverPed(v); NPC.say(dn, 'Au voleur !', 3);
        P.veh = v.id; v.driver = 'player'; P.stats.jacks = (P.stats.jacks || 0) + 1; Missions.onStolen && Missions.onStolen(v);
      });
      return;
    }
    if (!mine && !jobOk) {
      if (v.locked || v.owner === 'player') { toast('Ce véhicule est verrouillé.', 'warn'); return; }
      if (v.forJob) { UI.confirm('Véhicule de service', 'Ce véhicule est réservé aux agents en service. Le voler ?', 'Voler', 'Non', () => { Wanted.crime(2, 'vol de véhicule de service', true); P.veh = v.id; v.driver = 'player'; v.stolen = true; }); return; }
      if (v.owner === 'stolen' || v.stolen) { /* déjà volé */ } else if (!P.inv.lockpick) { toast('Verrouillé. Il vous faudrait un crochet.', 'warn'); return; }
      else { P.inv.lockpick--; if (!P.inv.lockpick) delete P.inv.lockpick; Wanted.crime(1, 'vol de véhicule', true); v.stolen = true; }
    }
    P.veh = v.id; v.driver = 'player'; v.brake = 0;
    if (jobOk && v.forJob === 'police') v.siren = false;
    Missions.onStolen && Missions.onStolen(v);
  },
  die(cause) {
    if (P.dead) return; P.dead = true;
    UI.fade('Vous avez perdu connaissance…', 3200, () => {
      const veh = Player.inVeh(); if (veh) { veh.driver = null; veh.brake = 1; P.veh = null; }
      const hosp = W.byKind.hospital[0];
      if (G.scene !== 'out') { Interior.unload(); }
      P.dead = false; P.hp = 45; P.hun = Math.max(P.hun, 40); P.thi = Math.max(P.thi, 40); P.alc = 0; P.onDuty = false; P.cuffed = false; P.uniform = false;
      const bill = Math.min(400, Math.round(P.cash * 0.2 + 150)); Eco.charge(P, bill); G.eco.treasury += bill * 0.4; G.biz[W.byKind.bank[0].id].cash += 0;
      P.weapon = 'fists'; delete P.inv.pistol; P.ammo = 0;
      G.t += 180;
      if (P.heat >= 1 && chance(0.6)) { Jail.send(Math.round(P.heat * 40 + 30), 'arrestation à l\'hôpital'); return; }
      P.heat = 0; P.wanted = 0;
      G.scene = hosp.id; Interior.load(hosp); const S = Interior.S; P.x = (S.door.x + 0.5) * TS; P.y = (S.door.y - 1.5) * TS;
      toast(`Vous vous réveillez à l'hôpital. Facture : ${money(bill)}.`, 'warn');
    });
  },
  // besoins (dm = minutes de jeu écoulées)
  needs(dm) {
    const k = P.sleeping ? 0.25 : 1;
    P.hun = clamp(P.hun - 0.17 * dm * k, 0, 100); P.thi = clamp(P.thi - 0.24 * dm * k, 0, 100); if (!P.sleeping) P.ene = clamp(P.ene - 0.065 * dm, 0, 100);
    P.alc = Math.max(0, P.alc - 0.3 * dm); P.fun = clamp(P.fun - 0.04 * dm, 0, 100);
    if (P.hun <= 0 || P.thi <= 0) P.hp = Math.max(8, P.hp - 0.4 * dm); else if (P.ene <= 0) P.hp = Math.max(8, P.hp - 0.15 * dm);
    else if (P.hp < 100 && P.hun > 30 && P.thi > 30) P.hp = Math.min(100, P.hp + 0.1 * dm);
    if (P.hp <= 0) Player.die('besoins');
  },
  hurt(d, src) {
    if (P.god) return;
    P.hp -= d; if (src === 'gun') Snd.crash();
    if (P.hp <= 0) Player.die(src);
  },
};

// ---------- sommeil / avance rapide ----------
const Sleep = {
  start(bedLabel, hours, untilMorning) {
    if (G.scene === 'out') return;
    let until = G.t + (hours || 8) * 60;
    if (untilMorning) { const m = Math.floor(G.t / 1440) * 1440 + 7 * 60; until = Math.max(G.t + 180, m > G.t ? m : m + 1440); }
    P.sleeping = { until, bed: bedLabel };
    G.ff = 12;
    const f = $('fade'); f.textContent = 'Zzz… (touchez l\'écran pour vous réveiller)'; f.style.opacity = 0.85; f.style.pointerEvents = 'auto';
    f.onclick = () => Sleep.stop();
  },
  update(dt) {
    const dm = dt * 12;
    P.ene = clamp(P.ene + 0.22 * dm, 0, 100);
    P.hp = Math.min(100, P.hp + 0.08 * dm);
    if (G.t >= P.sleeping.until || (P.jail && G.t >= P.jail.until)) Sleep.stop();
  },
  stop() {
    if (!P.sleeping) return;
    P.sleeping = null; G.ff = 0; const f = $('fade'); f.style.opacity = 0; f.style.pointerEvents = 'none'; f.textContent = ''; f.onclick = null;
    toast(`Réveil — il est ${timeStr()}.`);
  },
};

// ---------- recherche / crimes ----------
const Wanted = {
  witnesses() {
    let n = 0;
    if (G.scene === 'out') { for (const q of G.npcs) if (q.loc === 'out' && !q.busy && q.state !== 'down' && Math.hypot(q.x - P.x, q.y - P.y) < 230) n += (q.job === 'police' ? 3 : 1); }
    else for (const e of Interior.list) if (!e.n.busy && Math.hypot(e.x - P.x, e.y - P.y) < 340) n += e.n.job === 'police' ? 3 : 1;
    return n;
  },
  crime(level, type, needWitness) {
    if (P.job === 'police' && P.onDuty && type !== 'accident') level *= 0.5;
    const w = Wanted.witnesses();
    if (needWitness && !w) return false;
    if (P.inv.mask && P.masked) level *= 0.5;
    P.heat = Math.min(5, P.heat + level); P.crimes++; P.cool = 0;
    P.lastCrime = type;
    toast(`🚨 Crime repéré : <b>${esc(type)}</b>`, 'bad');
    if (G.scene === 'out') Police.alert(P.x, P.y);
    return true;
  },
  update(dt) {
    const stars = Math.ceil(P.heat - 0.001);
    P.wanted = Math.max(0, stars);
    if (P.heat <= 0) { P.heat = 0; return; }
    const seen = Police.copNear(P, 480);
    if (seen) P.cool = 0; else P.cool += dt;
    if (P.cool > 8) P.heat = Math.max(0, P.heat - dt * (G.scene === 'out' ? 0.035 : 0.09));
  },
};

// ---------- prison : détention du joueur ----------
const Jail = {
  send(mins, reason) {
    const pb = W.byKind.prison[0];
    const veh = Player.inVeh(); if (veh) { veh.driver = null; P.veh = null; }
    P.jail = { until: G.t + mins, total: mins, reason, work: 0, dug: 0, bribed: false, moving: true };
    P.heat = 0; P.wanted = 0;
    UI.fade('Arrêté ! Transfert à la prison…', 2600, () => {
      if (!P.jail) return;
      P.jail.moving = false;
      P.onDuty = false; P.uniform = false; P.cuffed = false; P.heat = 0; P.wanted = 0; P.mission = null; P.carry = [];
      for (const k of ['colis', 'pistol', 'ammo', 'lockpick', 'mask']) delete P.inv[k];
      P.weapon = 'fists'; P.ammo = 0;
      const fine = Math.round(Math.min(P.cash, 150 + mins * 2)); P.cash -= fine; G.eco.treasury += fine;
      if (G.scene !== 'out') Interior.unload();
      G.scene = pb.id; Interior.load(pb);
      const S = Interior.S; const cell = S.extra.cells[P.cell = randi(0, 7)];
      P.x = cell.x * TS; P.y = cell.y * TS;
      Phone.close();
      toast(`🔒 Condamné à <b>${Jail.fmt(mins)}</b> — motif : ${esc(reason)}. Amende : ${money(fine)}`, 'bad');
      Msg.push('Greffe', `Vous purgez ${Jail.fmt(mins)} pour « ${reason} ». Travaillez à l'atelier pour réduire votre peine ou dormez pour accélérer le temps.`);
    });
  },
  fmt(m) { const h = Math.floor(m / 60), mm = Math.round(m % 60); return h ? `${h} h ${mm} min` : `${mm} min`; },
  release(escaped) {
    const pb = W.byKind.prison[0]; if (!P.jail) return;
    if (P.sleeping) Sleep.stop();
    P.jail = null;
    UI.fade(escaped ? 'Évasion réussie !' : 'Libéré !', 1800, () => {
      if (G.scene !== 'out') Interior.unload();
      G.scene = 'out';
      const f = frontPx(pb); P.x = f.x; P.y = f.y + 6;
      if (escaped) { P.heat = 4; Police.alert(P.x, P.y); }
      else toast('Vous êtes libre. Tâchez de rester dans le droit chemin…', 'good');
    });
  },
  update() {
    if (P.jail && G.t >= P.jail.until) Jail.release(false);
  },
  bail() { return Math.max(0, Math.round((P.jail.until - G.t) * 4)); },
};

// ---------- interactions ----------
const Interact = {
  hooks: [], cur: null,
  rectDist(f, x, y) { const l = f.x * TS, t = f.y * TS, r = l + f.w * TS, b = t + f.h * TS; const dx = Math.max(l - x, 0, x - r), dy = Math.max(t - y, 0, y - b); return Math.hypot(dx, dy); },
  scan() {
    const c = []; const veh = Player.inVeh();
    if (UI.modalOpen || P.sleeping) return null;
    if (G.scene === 'out') {
      if (!veh) {
        for (const b of W.buildings) {
          const f = frontPx(b); const d = Math.hypot(f.x - P.x, f.y - P.y);
          if (d < 42) c.push({ d: d - 6, label: `${b.e} Entrer : ${b.name}`, run: () => Doors.tryEnter(b) });
        }
        for (const n of G.npcs) {
          if (n.loc !== 'out' || n.state === 'dead') continue;
          const d = Math.hypot(n.x - P.x, n.y - P.y);
          if (d < 46) c.push({ d, label: `💬 ${n.name}${n.state === 'down' ? ' (au sol)' : ''}`, run: () => Talk.open(n) });
        }
        for (const v of G.vehicles) { if (v.driver && v.driver !== 'ai') continue; const d = Math.hypot(v.x - P.x, v.y - P.y); if (d < 46) c.push({ d: d + 8, label: `${VEH[v.type].emoji} ${v.driver === 'ai' ? 'Voler' : 'Monter'} : ${VEH[v.type].n}`, run: () => Player.toggleVeh() }); }
      } else {
        for (const b of W.byKind.gas) { const f = frontPx(b); const d = Math.hypot(f.x - P.x, f.y - P.y); if (d < 150 && Math.abs(veh.v) < 40) c.push({ d, label: `⛽ Faire le plein (${Eco.fuelPrice().toFixed(2)} €/L)`, run: () => Shop.refuel(veh, b) }); }
      }
    } else {
      const S = Interior.S, b = Interior.b;
      const dd = Math.hypot((S.door.x + 0.5) * TS - P.x, (S.door.y + 0.5) * TS - P.y);
      if (dd < 40) c.push({ d: dd - 10, label: '🚪 Sortir', run: () => Player.leave() });
      for (const f of S.furn) {
        if (!f.act) continue;
        const d = Interact.rectDist(f, P.x, P.y);
        if (d < 24) c.push({ d: d + 2, label: f.label || f.act, run: () => (Acts[f.act] ? Acts[f.act](f, b, S) : toast('Rien à faire ici.')), hold: f.hold });
      }
      for (const e of Interior.list) { const d = Math.hypot(e.x - P.x, e.y - P.y); if (d < 40) c.push({ d: d - 2, label: `💬 ${e.n.name}`, run: () => Talk.open(e.n, e) }); }
    }
    for (const h of Interact.hooks) h(c);
    c.sort((a, b) => a.d - b.d);
    return c[0] || null;
  },
};

// ---------- portes ----------
const Doors = {
  hours(b) { // [ouvert, fermé] ou null (24h)
    const k = b.kind;
    return { club: [21, 5], bar: [11, 2], fastfood: [6, 24], restaurant: [11.5, 23], bank: [8.5, 17], store: [7, 22.5], dealer: [9, 19], office: [8, 18.5] }[k] || null;
  },
  isOpen(b) {
    const h = Doors.hours(b); if (!h) return true;
    const t = minOfDay() / 60, wk = dowOf();
    if ((b.kind === 'bank' || b.kind === 'office') && (wk === 0 || wk === 6)) return b.kind === 'bank' && wk === 6 && t >= 9 && t < 12;
    if (h[1] < h[0]) return t >= h[0] || t < h[1];
    return t >= h[0] && t < h[1];
  },
  tryEnter(b) {
    const k = b.kind;
    if (P.heat >= 2 && ['police'].includes(k)) { toast('Vous ne pouvez pas entrer au commissariat comme ça…', 'warn'); return; }
    const mine = P.empBid === b.id;
    if (k === 'house' || k === 'apt') {
      if (b.id === P.homeBid) return Player.enter(b);
      Doors.houseDoor(b); return;
    }
    if (k === 'prison') {
      if (P.job === 'guard' && P.empBid === b.id) return Player.enter(b);
      if (P.gang && P.respect > 1500) { toast('Un gardien corrompu vous laisse passer…', 'warn'); return Player.enter(b); }
      toast('🔒 Prison : accès réservé au personnel. Les visites sont fermées.', 'warn'); return;
    }
    if (!Doors.isOpen(b) && !mine) {
      const h = Doors.hours(b);
      const msg = `Fermé. Horaires : ${Math.floor(h[0])}h${h[0] % 1 ? '30' : ''} – ${Math.floor(h[1] % 24)}h${h[1] % 1 ? '30' : ''}`;
      if (['bank', 'store', 'dealer', 'office', 'restaurant', 'fastfood'].includes(k) && P.inv.lockpick) {
        UI.confirm('Fermé', msg + '. Crocheter la porte ?', 'Crocheter', 'Non', () => { P.inv.lockpick--; if (!P.inv.lockpick) delete P.inv.lockpick; Wanted.crime(1.2, 'effraction', false); Player.enter(b); Missions.onBreakIn && Missions.onBreakIn(b); });
      } else toast('🔒 ' + msg, 'warn');
      return;
    }
    if (k === 'mafia' && P.gang !== 'mafia') {
      if (P.respect > 200 || P.cash < 200) { toast('Le videur vous dévisage… « Ce n\'est pas pour toi. »', 'warn'); return; }
      UI.confirm('Le Corvino', 'Le videur demande 200 € pour « un verre avec le patron ».', 'Payer 200 €', 'Non', () => { if (Eco.charge(P, 200)) Player.enter(b); });
      return;
    }
    if (k === 'biker' && P.gang && P.gang !== 'bikers') { toast('Les Iron Wolves vous regardent de travers… vous êtes en territoire ennemi !', 'bad'); }
    if (k === 'street' && P.gang && P.gang !== 'street') { toast('Les Diablos ne vous aiment pas.', 'bad'); }
    Player.enter(b);
  },
  houseDoor(b) {
    const residents = G.npcs.filter((n) => n.home === b.id);
    const inside = residents.filter((n) => n.loc === b.id);
    const items = [];
    items.push({ label: '🔔 Sonner', sub: inside.length ? inside.length + ' personne(s) semblent être là' : 'Personne ne répond ?', fn: () => {
      if (!inside.length) { toast('Personne ne répond.', 'warn'); return; }
      const n = inside[0];
      if (n.rel >= 25 || n.partner) { toast(`${n.name} vous invite à entrer.`, 'good'); Player.enter(b); }
      else { toast(`${n.name} : « Je ne vous connais pas. »`, 'warn'); }
    } });
    items.push({ label: '🗝️ Crocheter la serrure', sub: P.inv.lockpick ? 'Cambriolage — risqué !' : 'Il vous faut un crochet', disabled: !P.inv.lockpick, fn: () => {
      P.inv.lockpick--; if (!P.inv.lockpick) delete P.inv.lockpick;
      UI.progress('Crochetage…', 4, () => {
        P.burglary = b.id; Wanted.crime(inside.length ? 2 : 0.8, 'cambriolage', !inside.length);
        if (inside.length && chance(0.8)) { toast('Quelqu\'un est à l\'intérieur et crie !', 'bad'); Wanted.crime(1, 'intrusion', false); }
        Player.enter(b);
      });
    } });
    UI.menu(`🏠 Maison de ${residents.length ? residents[0].last : 'inconnus'}`, 'Propriété privée', items);
  },
};

// ---------- inventaire ----------
const Inv = {
  open() {
    if (UI.modalOpen) { UI.close(); return; }
    const items = Object.keys(P.inv).filter((k) => P.inv[k] > 0).map((k) => ({
      label: `${ITEMS[k].e} ${ITEMS[k].n}`, right: '×' + P.inv[k], sub: Inv.desc(k), fn: () => Inv.use(k),
    }));
    UI.menu('🎒 Sac', `Espèces ${money(P.cash)} · Banque ${money(P.bank)}${P.weapon !== 'fists' ? ` · Arme : ${P.weapon} (${P.ammo})` : ''}`, items.length ? items : [{ label: 'Votre sac est vide.', disabled: true }]);
  },
  desc(k) { const i = ITEMS[k]; const o = []; if (i.hun) o.push(`+${i.hun} faim`); if (i.thi) o.push(`+${i.thi} soif`); if (i.alc) o.push('alcool'); if (i.heal) o.push(`+${i.heal} santé`); if (i.cat === 'crime') o.push('illégal'); return o.join(' · '); },
  add(k, n) { P.inv[k] = (P.inv[k] || 0) + (n || 1); },
  use(k) {
    const i = ITEMS[k];
    if (!P.inv[k]) return;
    if (k === 'pistol') { P.weapon = P.weapon === 'pistol' ? 'fists' : 'pistol'; toast(P.weapon === 'pistol' ? '🔫 Pistolet équipé.' : 'Pistolet rangé.'); return; }
    if (k === 'ammo') { P.ammo += 12; P.inv.ammo--; if (!P.inv.ammo) delete P.inv.ammo; toast('+12 munitions'); return; }
    if (k === 'mask') { P.masked = !P.masked; toast(P.masked ? '🎭 Cagoule enfilée (moins de témoins)' : 'Cagoule retirée.'); return; }
    if (k === 'outfit') { P.charm += i.charm; P.inv.outfit--; if (!P.inv.outfit) delete P.inv.outfit; toast('Vous êtes plus stylé ! Charme +' + i.charm, 'good'); return; }
    if (k === 'fuelcan') { const v = Player.inVeh() || G.vehicles.find((q) => Math.hypot(q.x - P.x, q.y - P.y) < 70 && P.ownV.includes(q.id)); if (!v) { toast('Placez-vous près de votre véhicule.', 'warn'); return; } v.fuel = Math.min(VEH[v.type].fuel, v.fuel + 12); P.inv.fuelcan--; if (!P.inv.fuelcan) delete P.inv.fuelcan; toast('⛽ +12 L', 'good'); return; }
    if (k === 'colis' || k === 'lockpick') { toast('Utilisable pendant les missions.'); return; }
    if (i.hun) P.hun = clamp(P.hun + i.hun, 0, 100);
    if (i.thi) P.thi = clamp(P.thi + i.thi, 0, 100);
    if (i.alc) P.alc = clamp(P.alc + i.alc, 0, 100);
    if (i.heal) P.hp = clamp(P.hp + i.heal, 0, 100);
    P.fun = clamp(P.fun + 2, 0, 100);
    P.inv[k]--; if (!P.inv[k]) delete P.inv[k];
    toast(`${i.e} ${i.n} consommé.`);
    Snd.click();
    Inv.open();
  },
};

// ---------- boutiques ----------
const Shop = {
  open(b, list, title, opts) {
    opts = opts || {};
    const items = list.map((k) => {
      const p = Eco.price(k);
      return { label: `${ITEMS[k].e} ${ITEMS[k].n}`, sub: Inv.desc(k), right: money(p), keep: true, fn: () => {
        const paid = Eco.sale(b.id, k, 1, P);
        if (!paid) { toast('Pas assez d\'argent !', 'bad'); return; }
        if (opts.eat && (ITEMS[k].cat === 'food' || ITEMS[k].cat === 'drink')) { Inv.add(k); const keep = P.inv[k]; P.inv[k] = Math.max(0, keep); Shop.consume(k); } else { Inv.add(k); toast(`${ITEMS[k].e} ${ITEMS[k].n} acheté (${money(paid)})`, 'good'); }
        Shop.open(b, list, title, opts);
      } };
    });
    UI.menu(title || b.name, `Espèces : ${money(P.cash)} · Banque : ${money(P.bank)}`, items);
  },
  consume(k) {
    const i = ITEMS[k];
    if (i.hun) P.hun = clamp(P.hun + i.hun, 0, 100); if (i.thi) P.thi = clamp(P.thi + i.thi, 0, 100); if (i.alc) P.alc = clamp(P.alc + i.alc, 0, 100);
    P.fun = clamp(P.fun + 3, 0, 100);
    P.inv[k] = (P.inv[k] || 1) - 1; if (P.inv[k] <= 0) delete P.inv[k];
    toast(`${i.e} ${i.n} — miam.`, 'good');
  },
  refuel(v, b) {
    const need = Math.ceil(VEH[v.type].fuel - v.fuel);
    if (need <= 0) { toast('Le réservoir est plein.'); return; }
    const price = Eco.fuelPrice();
    const full = need * price;
    UI.menu('⛽ Station-service', `${VEH[v.type].n} — niveau ${Math.round(v.fuel)}/${VEH[v.type].fuel} L · ${price.toFixed(2)} €/L`, [
      { label: 'Plein complet', right: money(full), fn: () => { if (Eco.charge(P, full)) { v.fuel = VEH[v.type].fuel; Eco.income(b.id, full); toast('⛽ Plein effectué.', 'good'); } else toast('Fonds insuffisants.', 'bad'); } },
      { label: '10 litres', right: money(10 * price), fn: () => { if (Eco.charge(P, 10 * price)) { v.fuel = Math.min(VEH[v.type].fuel, v.fuel + 10); Eco.income(b.id, 10 * price); toast('⛽ +10 L', 'good'); } else toast('Fonds insuffisants.', 'bad'); } },
      { label: '🔧 Réparer le véhicule', sub: `Dégâts : ${Math.round(100 - v.hp)} %`, right: money((100 - v.hp) * 3), disabled: v.hp > 98, fn: () => { const c = (100 - v.hp) * 3; if (Eco.charge(P, c)) { v.hp = 100; Eco.income(b.id, c); toast('🔧 Véhicule réparé.', 'good'); } else toast('Fonds insuffisants.', 'bad'); } },
    ]);
  },
};

// ---------- dialogues avec PNJ ----------
const TALK_LINES = ['Belle journée, non ?', 'Pas facile de joindre les deux bouts en ce moment.', 'Vous avez vu les prix ? C\'est n\'importe quoi.', 'Je bosse tard ce soir…', 'Faites attention, il y a des bandes dans le coin.', 'Le club du centre est génial le vendredi !', 'Les flics sont partout depuis hier.', 'J\'ai entendu dire que le Fast Fast Food recrute.', 'Vous cherchez quelqu\'un ?', 'Moi, c\'est la moto qui me fait vibrer.'];
const Talk = {
  open(n, entry) {
    if (n.state === 'dead') return;
    if (n.ghost) { UI.menu(`${n.emoji} ${n.name}`, 'Client de passage', [{ label: '👋 Discuter', fn: () => toast(`${n.emoji} ${n.name} : « ${pick(TALK_LINES)} »`) }]); return; }
    const items = [];
    const near = Talk.hints(n);
    const down = n.state === 'down';
    if (!down && !n.cuffed) {
      items.push({ label: '👋 Discuter', sub: 'Faire connaissance', fn: () => Talk.chat(n) });
      if (!n.known) items.push({ label: '📞 Demander son numéro', sub: n.rel >= 8 ? 'Il/elle semble ok' : 'Discutez d\'abord un peu', fn: () => {
        if (n.rel >= 8 || chance(0.15 + P.charm / 400 + n.looks / 600 * 0)) { n.known = true; toast(`📞 ${n.name} : ${n.phone}`, 'good'); Msg.push(n.name, 'Salut, c\'est bien toi ? Content d\'avoir ton numéro !', { npc: n.id }); } else { toast(`${n.name} refuse poliment.`, 'warn'); n.rel -= 2; }
      } });
      if (n.known) items.push({ label: '💌 Envoyer un message', fn: () => { Phone.open('messages'); Phone.state.thread = n.name; Phone.render(); } });
      if (n.partner || n.matched) items.push({ label: '💞 Passer du temps ensemble', sub: 'Gagner en affinité', fn: () => Dating.hangout(n) });
    }
    for (const h of Talk.hooks) h(n, items, entry);
    if (!down) {
      items.push({ label: '🎒 Voler (pickpocket)', sub: 'Risqué', fn: () => Talk.pickpocket(n) });
      items.push({ label: '👊 Agresser', sub: 'Crime', fn: () => Talk.attack(n) });
    }
    UI.menu(`${n.emoji} ${n.name}`, `${n.age} ans · ${Talk.jobStr(n)}${n.gang ? ' · ' + GANGS[n.gang].emoji + ' ' + GANGS[n.gang].name : ''}${n.known ? ' · 📱 contact' : ''}${down ? ' · <span class="bad">blessé(e)</span>' : ''}`, items);
  },
  hooks: [],
  hints() { return null; },
  jobStr(n) {
    if (n.job && n.job !== 'none') return `${JOBS[n.job].name} (${JOBS[n.job].ranks[Math.min(n.jr, JOBS[n.job].ranks.length - 1)]})`;
    if (n.sjob) return SIDE_JOBS[n.sjob].name;
    return 'Sans emploi';
  },
  chat(n) {
    if (G.t - (n.lastChat || -999) < 5) { toast(`${n.name} : « On vient de parler ! »`); return; }
    n.lastChat = G.t; n.rel = clamp(n.rel + randi(2, 5), -100, 100);
    P.fun = clamp(P.fun + 3, 0, 100);
    NPC.say(n, pick(TALK_LINES), 3.5);
    toast(`${n.emoji} ${n.name} : « ${pick(TALK_LINES)} »`);
  },
  pickpocket(n) {
    if (P.cuffed) return;
    const win = chance(0.45 + P.skills.str * 0.02 - n.soc * 0.1);
    if (win && n.money > 5) { const s = Math.round(n.money * rand(0.3, 0.9)); n.money -= s; P.cash += s; toast(`Vous avez volé ${money(s)} !`, 'good'); Wanted.crime(0.6, 'vol à la tire', true); }
    else { toast(`${n.name} vous a surpris !`, 'bad'); n.rel -= 20; NPC.say(n, 'Eh ! Au voleur !', 3); Wanted.crime(1, 'vol à la tire', false); NPC.panic(n); }
  },
  attack(n) {
    Wanted.crime(1, 'agression', true);
    Combat.hitNpc(n, 12 + P.skills.str * 2, 'fists');
  },
};

// ---------- combat ----------
const Combat = {
  bullets: [], cd: 0,
  attack() {
    if (P.cuffed || Player.inVeh() && P.weapon !== 'pistol') return;
    if (Combat.cd > 0) return; Combat.cd = P.weapon === 'pistol' ? 0.35 : 0.5;
    const ax = Math.cos(P.a), ay = Math.sin(P.a);
    if (P.weapon === 'pistol' && P.ammo > 0) {
      P.ammo--; Snd.beep(120, 0.1, 'square', 0.09);
      Combat.bullets.push({ x: P.x + ax * 12, y: P.y + ay * 12, vx: ax * 620, vy: ay * 620, life: 0.7, own: 'player' });
      Wanted.crime(P.job === 'police' && P.onDuty ? 0 : 0.8, 'coups de feu', false);
      P.skills.shoot += 0.01; return;
    } else if (P.weapon === 'pistol') toast('Plus de munitions !', 'warn');
    if (P.job === 'police' && P.onDuty && Police.taser) { Police.useTaser(); return; }
    // poing
    Snd.beep(200, 0.05, 'square', 0.05);
    P.punch = 0.2;
    const hit = Combat.target(40);
    if (hit) {
      if (hit.v) { hit.v.hp -= 4; Wanted.crime(0.4, 'vandalisme', true); return; }
      const n = hit.n; const dmg = 10 + P.skills.str * 2;
      if (!(P.job === 'police' && P.onDuty && (n.state === 'flee' || n.crim_flag))) Wanted.crime(0.7, 'agression', true);
      Combat.hitNpc(n, dmg, 'fists'); P.skills.str = Math.min(10, P.skills.str + 0.02);
    }
  },
  target(range) {
    const ax = Math.cos(P.a), ay = Math.sin(P.a);
    let best = null, bd = range;
    if (G.scene === 'out') {
      for (const n of G.npcs) { if (n.loc !== 'out' || n.state === 'dead') continue; const dx = n.x - P.x, dy = n.y - P.y, d = Math.hypot(dx, dy); if (d < bd && (dx * ax + dy * ay) / (d || 1) > 0.3) { bd = d; best = { n }; } }
      if (!best) for (const v of G.vehicles) { if (v === Player.inVeh()) continue; const d = Math.hypot(v.x - P.x, v.y - P.y); if (d < Math.min(bd, 36)) { bd = d; best = { v }; } }
    } else for (const e of Interior.list) { const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy); if (d < bd && (dx * ax + dy * ay) / (d || 1) > 0.3) { bd = d; best = { n: e.n, e }; } }
    return best;
  },
  hitNpc(n, dmg, how) {
    n.hp -= dmg; n.rel -= 15; n.hurtT = 0.3;
    const e = Interior.list.find((q) => q.n === n);
    if (n.hp <= 0) {
      if (how === 'gun' && n.hp < -15) { NPC.kill(n); Wanted.crime(3, 'meurtre', false); }
      else { NPC.knockout(n); }
    } else {
      NPC.say(n, pick(['Aïe !', 'Arrête !', 'Au secours !']), 2);
      if (n.job === 'police' || n.crim > 0.6 && chance(0.4)) NPC.fightBack(n);
      else NPC.panic(n);
    }
  },
  update(dt) {
    Combat.cd = Math.max(0, Combat.cd - dt);
    if (P.punch) P.punch = Math.max(0, P.punch - dt);
    for (const b of Combat.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (G.scene === 'out' ? blockedOut(b.x, b.y, 1) : blockedIn(Interior.S, b.x, b.y, 1)) { b.life = 0; continue; }
      if (b.own === 'player') {
        if (G.scene === 'out') {
          for (const n of G.npcs) if (n.loc === 'out' && n.state !== 'dead' && Math.hypot(n.x - b.x, n.y - b.y) < 11) { b.life = 0; Combat.hitNpc(n, 45, 'gun'); break; }
          for (const v of G.vehicles) if (Math.hypot(v.x - b.x, v.y - b.y) < 18) { b.life = 0; v.hp -= 8; }
        } else for (const e of Interior.list) if (Math.hypot(e.x - b.x, e.y - b.y) < 11) { b.life = 0; Combat.hitNpc(e.n, 45, 'gun'); break; }
      } else if (Math.hypot(P.x - b.x, P.y - b.y) < 10) { b.life = 0; Player.hurt(12, 'gun'); }
    }
    Combat.bullets = Combat.bullets.filter((b) => b.life > 0);
  },
};

// états de PNJ après agression
NPC.panic = function (n) {
  if (n.loc !== 'out') { const e = Interior.list.find((q) => q.n === n); if (e) { e.role = 'cust'; e.tx = (Interior.S.door.x + 0.5) * TS; e.ty = (Interior.S.door.y - 0.5) * TS; } return; }
  n.state = 'flee'; n.fleeT = 8;
};
NPC.fightBack = function (n) { n.state = 'idle'; n.fighting = 8; };
NPC.knockout = function (n) {
  n.hp = 5; n.state = 'down'; n.busy = true; n.downT = 120;
  if (n.loc === 'out') EMS.reportDown(n);
};
NPC.kill = function (n) {
  n.state = 'dead'; n.hp = 0; n.busy = true; n.deadAt = G.t;
  const e = Interior.list.find((q) => q.n === n); if (e) Interior.list.splice(Interior.list.indexOf(e), 1);
  if (n.loc !== 'out') n.loc = 'none';
  const g = n.gang; if (g) G.gangs[g].members = G.gangs[g].members.filter((m) => m !== n.id);
  Eco.addNews(`${n.name} a été tué(e) en ville.`);
};
