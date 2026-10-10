'use strict';
// ===== Gangs, grades, recrutement, missions criminelles =====
const Gangs = {
  G(gid) { return G.gangs[gid || P.gang]; },
  def(gid) { return GANGS[gid || P.gang]; },
  members(gid) { return G.gangs[gid].members.map((i) => G.npcs[i]).filter((n) => n && n.state !== 'dead'); },
  rankName(gid, r) { const d = GANGS[gid]; return d.ranks[Math.min(r, d.ranks.length - 1)]; },
  myRankName() { return Gangs.rankName(P.gang, P.gangRank); },
  join(gid) {
    if (P.gang) return 'Vous appartenez déjà à un gang.';
    if (P.job === 'police' || P.job === 'guard') return 'Vous êtes dans les forces de l\'ordre !';
    P.gang = gid; P.gangRank = 0; P.respect = 0;
    const g = Gangs.def(gid);
    Msg.push(Gangs.members(gid).find((n) => n.gr === 4)?.name || g.name, `Bienvenue chez ${g.name}, ${P.name}. Montre-nous ce que tu vaux. Passe à la table de réunion pour les missions.`, { col: g.col });
    return null;
  },
  leave() {
    const g = Gangs.def(); P.respect = 0; P.gang = null; P.gangRank = 0; P.mission = null;
    toast(`Vous avez quitté ${g.name}. Ils ne vous oublieront pas…`, 'warn');
  },
  addRespect(n) {
    if (!P.gang) return;
    P.respect = Math.max(0, P.respect + n);
    const d = Gangs.def(); let r = 0;
    for (let i = 0; i < 4; i++) if (P.respect >= d.resp[i]) r = i;
    if (P.gangRank < 4) {
      if (r > P.gangRank) { P.gangRank = r; toast(`🔱 Promotion dans le gang : <b>${Gangs.myRankName()}</b> !`, 'good'); Snd.good(); }
      else if (r < P.gangRank) { P.gangRank = r; toast('Vous avez été rétrogradé : ' + Gangs.myRankName(), 'bad'); }
    }
    G.gangs[P.gang].respect += n * 0.5;
  },
  // paiement d'une récompense depuis la caisse du gang
  payout(amt, share) {
    const g = Gangs.G(); const full = amt;
    const mine = Math.round(full * (share == null ? 0.5 + P.gangRank * 0.08 : share));
    const gangPart = full - mine;
    if (g.treasury >= mine) { g.treasury -= mine; P.cash += mine; } else { P.cash += g.treasury; g.treasury = 0; }
    g.treasury += gangPart * 0; // la part du gang reste dans la caisse
    return mine;
  },
  recruitChance(n) { return clamp(0.2 + n.crim * 0.5 + n.rel / 200 + P.respect / 5000, 0.05, 0.95); },
  recruit(n) {
    if (P.gangRank < 2) return 'Grade insuffisant (Caporegime / Sergent d\'armes / Lieutenant minimum).';
    if (n.gang) return `${n.name} appartient déjà à un gang.`;
    if (n.job === 'police' || n.job === 'guard') return 'On ne recrute pas dans les forces de l\'ordre !';
    if (chance(Gangs.recruitChance(n))) {
      n.gang = P.gang; n.gr = 0; Gangs.G().members.push(n.id); n.rel += 10;
      if (n.job !== 'none') n.partTime = true;
      return null;
    }
    n.rel -= 8; return `${n.name} décline l\'offre.`;
  },
  fire(n) {
    if (n.gang !== P.gang) return 'Pas membre.';
    if (n.gr >= P.gangRank) return 'Vous ne pouvez pas renvoyer un supérieur ou un égal.';
    const g = Gangs.G(); g.members = g.members.filter((i) => i !== n.id);
    n.gang = null; n.gr = 0; n.rel -= 40; n.grudge = true; n.partTime = false;
    return null;
  },
  promote(n) {
    if (n.gang !== P.gang) return 'Pas membre.';
    if (P.gangRank < 3) return 'Réservé aux grades 4+ (Sous-chef, Parrain…).';
    if (n.gr >= P.gangRank - 1 && !(P.gangRank === 4 && n.gr < 3)) return 'Ne peut pas dépasser votre grade.';
    if (n.gr >= 3) return 'Grade maximum accessible.';
    n.gr++; n.rel += 15; return null;
  },
  demote(n) {
    if (n.gang !== P.gang) return 'Pas membre.';
    if (P.gangRank < 3) return 'Réservé aux grades 4+.';
    if (n.gr >= P.gangRank) return 'Impossible.';
    if (n.gr <= 0) return 'Déjà au plus bas.';
    n.gr--; n.rel -= 15; return null;
  },
  challenge() {
    const g = Gangs.G(), d = Gangs.def();
    const boss = G.npcs[g.boss];
    if (P.gangRank !== 3 || P.respect < d.resp[4]) return `Il faut être ${d.ranks[3]} avec ${d.resp[4]} de respect.`;
    const mem = Gangs.members(P.gang);
    const loyal = mem.reduce((s, n) => s + n.rel, 0) / Math.max(1, mem.length);
    const p = clamp(0.3 + loyal / 250 + P.skills.str / 30 + (P.weapon === 'pistol' ? 0.12 : 0) + (P.respect - d.resp[4]) / 8000, 0.1, 0.9);
    if (chance(p)) {
      if (boss) { boss.gr = 3; boss.rel -= 30; }
      g.boss = null; P.gangRank = 4; g.members.forEach((i) => { const n = G.npcs[i]; if (n && n.gr === 3 && n !== boss) n.gr = 2; });
      toast(`👑 Vous êtes le nouveau chef de ${d.name} !`, 'good'); Snd.good(); Eco.addNews(`Coup de force chez ${d.name} : un nouveau chef prend le pouvoir.`);
      return null;
    }
    P.hp = Math.max(10, P.hp - 45); P.respect = Math.round(P.respect * 0.6); P.gangRank = 2;
    return 'Le coup d\'État a échoué ! Vous êtes rétrogradé et blessé.';
  },
  daily() {
    for (const gid in G.gangs) {
      const g = G.gangs[gid], d = GANGS[gid];
      const mem = Gangs.members(gid);
      // racket quotidien : prélève dans 2 commerces
      const targets = Object.keys(G.biz).filter((id) => ['bar', 'restaurant', 'store', 'gas', 'fastfood', 'club'].includes(W.buildings[id].kind));
      for (let i = 0; i < 2; i++) {
        const id = pick(targets); const biz = G.biz[id]; const take = Math.min(Math.max(0, biz.cash) * 0.04, 350);
        biz.cash -= take; g.treasury += take * (mem.length >= 5 ? 1 : 0.6);
      }
      g.treasury += mem.length * 12;
      g.respect += mem.length * 0.5;
      // membres frappés par la loi (simulation)
      if (chance(0.15) && mem.length > 3) { const n = pick(mem.filter((m) => m.gr < 3 && m.loc !== 'prison')); if (n) { Police.imprison(n, randi(60, 240)); } }
      // salaires pour le joueur
      if (P.gang === gid && P.gangRank >= 2) {
        const part = Math.min(g.treasury * 0.03 * (P.gangRank / 3), 700); if (part > 5) { g.treasury -= part; P.bank += part; toast(`${d.emoji} Part de la caisse : +${money(part)}`, 'good'); }
      }
      // renforts : un nouveau membre rejoint de temps en temps
      if (mem.length < 8 && chance(0.25)) { const c = G.npcs.filter((n) => !n.gang && n.crim > 0.45 && !['police', 'guard'].includes(n.job) && n.state !== 'dead'); if (c.length) { const n = pick(c); n.gang = gid; n.gr = 0; g.members.push(n.id); } }
      // rejets : un chef mort est remplacé
      if (g.boss != null && (!G.npcs[g.boss] || G.npcs[g.boss].state === 'dead') ) { const best = mem.sort((a, b) => b.gr - a.gr)[0]; if (best) { best.gr = 4; g.boss = best.id; } }
    }
    // rival hostile : demande d'aide aux joueurs membres
    if (P.gang && !P.jail && !P.mission && chance(0.45)) {
      const g = Gangs.def();
      Msg.push(Gangs.members(P.gang).find((n) => n.gr >= 3)?.name || g.name, `Les rivaux rôdent près de notre QG ! On a besoin de toi pour défendre le territoire.`, { col: g.col, actions: [{ label: '⚔️ J\'arrive', key: 'turf_hq' }] });
    }
    // anciens membres vengeurs
    for (const n of G.npcs) if (n.grudge && n.state !== 'dead' && chance(0.04)) { n.grudge = false; Msg.push('Numéro inconnu', `${n.name} : « Tu vas le regretter, ${P.name}… »`); }
    // renaissance des disparus
    for (const n of G.npcs) if (n.state === 'dead' && G.t - n.deadAt > 2 * 1440) NPC.respawn(n);
  },
};
NPC.respawn = function (n) {
  const g = n.g; const f = g ? pick(FIRST_F) : pick(FIRST_M), l = pick(LAST);
  n.first = f; n.last = l; n.name = f + ' ' + l; n.state = 'idle'; n.busy = false; n.hp = 100; n.loc = n.home; n.job = 'none'; n.jr = 0; n.sjob = null; n.work = null; n.gang = null; n.gr = 0; n.known = false; n.rel = 0; n.matched = false; n.partner = false; n.planDay = -1; n.money = 100; n.bank = 300; n.crimFlag = false;
};

// =============== Missions criminelles ===============
const Missions = {
  defs: {
    deal: { name: 'Livrer des colis', rank: 0, desc: 'Vendre 3 colis à des clients discrets en ville.', reward: 520, resp: 40 },
    steal_car: { name: 'Voler un véhicule ciblé', rank: 0, desc: 'Repérez et volez le véhicule demandé, puis ramenez-le au QG.', reward: 850, resp: 55 },
    collect: { name: 'Collecter le « loyer »', rank: 1, desc: 'Racketter 3 commerces et rapporter l\'argent au coffre.', reward: 700, resp: 60 },
    rob_store: { name: 'Braquer une supérette', rank: 1, desc: 'Braquez un commerce, puis semez la police.', reward: 800, resp: 75 },
    turf: { name: 'Défendre le territoire', rank: 1, desc: 'Écartez les rivaux qui rôdent près du QG.', reward: 600, resp: 70 },
    heist: { name: 'Casse de la banque', rank: 2, desc: 'Forcez le coffre-fort de la banque et fuyez avec le magot.', reward: 4500, resp: 220 },
    run: { name: 'Run de moto avec le club', rank: 0, desc: 'Suivez le convoi des Iron Wolves sur 4 étapes à travers la ville.', reward: 650, resp: 50, only: 'bikers' },
  },
  start(type, opts) {
    if (!P.gang) return;
    const d = Missions.defs[type];
    const m = { type, stage: 0, t: 0, data: {}, title: d.name };
    const hq = W.buildings[Gangs.G().hq];
    switch (type) {
      case 'deal': { m.data.sold = 0; m.data.spots = Missions.pickSpots(3); m.stage = 0; break; }
      case 'steal_car': {
        const t = P.gang === 'bikers' ? 'chopper' : pick(['sport', 'car']);
        const col = pick(['#f97316', '#22c55e', '#a855f7', '#06b6d4', '#e11d48']);
        m.data.vtype = t; m.data.col = col;
        const v = Traffic.spawn(P) || Traffic.spawn(P);
        if (!v) { toast('Aucune cible disponible pour l\'instant, réessayez.', 'warn'); return; }
        v.type = t; v.col = col; v.target = true; v.keep = true; m.data.vid = v.id;
        break;
      }
      case 'collect': {
        const biz = W.buildings.filter((b) => ['bar', 'restaurant', 'store', 'fastfood', 'gas'].includes(b.kind));
        biz.sort(() => Math.random() - 0.5); m.data.targets = biz.slice(0, 3).map((b) => b.id); m.data.done = []; m.data.cash = 0; break;
      }
      case 'rob_store': { const s = W.buildings.filter((b) => ['store', 'gas'].includes(b.kind)); m.data.bid = pick(s).id; break; }
      case 'turf': { m.data.rivals = []; m.data.spawned = false; m.data.at = opts && opts.at || { x: (hq.front.x + 0.5) * TS, y: (hq.front.y + 4.5) * TS }; break; }
      case 'heist': { m.data.bid = W.byKind.bank[0].id; break; }
      case 'run': {
        const pts = []; const used = [];
        while (pts.length < 4) { const cx = pick(W.vx), cy = pick(W.hy); const k = cx + ',' + cy; if (used.includes(k)) continue; used.push(k); pts.push({ x: (cx + 0.5) * TS, y: (cy + 0.5) * TS }); }
        pts.push({ x: (hq.front.x + 0.5) * TS, y: (hq.front.y + 2.5) * TS });
        m.data.cps = pts; m.data.i = 0; m.data.fields = {}; m.data.convoy = [];
        const fp = frontPx(hq);
        for (let k = 0; k < 3; k++) { const pos = Veh.nearestFree(fp.x + 36 * k - 36, fp.y + 40, 10); const v = Veh.create(k === 0 ? 'chopper' : 'moto', pos.x, pos.y, -Math.PI / 2, { owner: 'convoy', col: '#f97316', driver: 'ai', keep: true }); m.data.convoy.push(v); }
        const pos = Veh.nearestFree(fp.x + 60, fp.y + 50, 12); const loan = Veh.create('chopper', pos.x, pos.y, 0, { owner: 'loan', col: '#7c2d12', loan: true, keep: true }); m.data.loan = loan.id;
        break;
      }
    }
    P.mission = m; Missions.setWp();
    toast(`🎯 Mission : <b>${d.name}</b>`, 'good'); Snd.notif();
  },
  pickSpots(n) {
    const spots = W.pois.filter((p) => p.kind === 'walk' || p.kind === 'park').sort(() => Math.random() - 0.5).slice(0, n);
    return spots.map((p) => ({ x: (p.front.x + 0.5) * TS, y: (p.front.y + 0.5) * TS, done: false }));
  },
  cleanup(m) { if (!m) return; if (m.data.vid) { const v = Veh.byId(m.data.vid); if (v) v.keep = false; } if (m.type === 'run') { for (const v of m.data.convoy || []) { v.owner = 'traffic'; v.keep = false; v.driver = 'ai'; v.dir = ((Math.round(v.a / (Math.PI / 2)) % 4) + 4) % 4; v.cruise = 0.5; } const l = Veh.byId(m.data.loan); if (l && P.veh !== l.id) Veh.remove(l); } },
  cancel() { Missions.cleanup(P.mission); P.mission = null; P.wp = null; },
  complete(extra) {
    const m = P.mission, d = Missions.defs[m.type];
    const pay = Gangs.payout(d.reward + (extra || 0), null);
    Gangs.addRespect(d.resp); Gangs.G().treasury += d.reward * 0.2; P.stats.missions = (P.stats.missions || 0) + 1;
    toast(`✅ Mission accomplie : +${money(pay)} · +${d.resp} respect`, 'good'); Snd.good();
    Missions.cleanup(m);
    P.mission = null; P.wp = null;
  },
  setWp() {
    const m = P.mission; if (!m) return;
    const hq = W.buildings[Gangs.G().hq]; const hqp = frontPx(hq);
    let t = null;
    switch (m.type) {
      case 'deal': t = m.stage === 0 ? hqp : m.data.spots.find((s) => !s.done); break;
      case 'steal_car': { const v = Veh.byId(m.data.vid); t = m.stage === 0 ? (v ? { x: v.x, y: v.y } : null) : hqp; break; }
      case 'collect': t = m.stage < 3 ? frontPx(W.buildings[m.data.targets.find((i) => !m.data.done.includes(i))]) : hqp; break;
      case 'rob_store': t = m.stage === 0 ? frontPx(W.buildings[m.data.bid]) : m.stage === 1 ? null : hqp; break;
      case 'turf': t = m.data.at; break;
      case 'heist': t = m.stage === 0 ? frontPx(W.buildings[m.data.bid]) : m.stage === 1 ? null : hqp; break;
      case 'run': t = m.data.cps[Math.min(m.data.i, m.data.cps.length - 1)]; break;
    }
    P.wp = t ? { x: t.x, y: t.y, label: m.title } : null;
  },
  text() {
    const m = P.mission; if (!m) return '';
    const hq = Gangs.G() ? W.buildings[Gangs.G().hq].name : 'QG';
    switch (m.type) {
      case 'deal': return m.stage === 0 ? `Prendre les colis au ${hq} (stock)` : `Vendre les colis (${m.data.sold}/3)`;
      case 'steal_car': return m.stage === 0 ? `Voler la ${VEH[m.data.vtype].n} ${m.data.vtype === 'chopper' ? 'orange/…' : ''} (point sur la carte)` : 'Ramener le véhicule au QG';
      case 'collect': return m.stage < 3 ? `Racketter les commerces (${m.data.done.length}/3)` : `Déposer ${money(m.data.cash)} au coffre du QG`;
      case 'rob_store': return m.stage === 0 ? 'Braquer la supérette (caisse)' : m.stage === 1 ? 'Semer la police !' : 'Retourner au QG';
      case 'run': return m.data.i < 4 ? `Suivez le convoi à moto (étape ${m.data.i + 1}/4)` : 'Retournez au QG avec le convoi';
      case 'turf': return `Éliminer les rivaux (${m.data.rivals.filter((n) => n.state !== 'down' && n.state !== 'dead').length} restants)`;
      case 'heist': return m.stage === 0 ? 'Entrer dans la banque et forcer le coffre' : m.stage === 1 ? 'Fuyez avec le butin !' : 'Rejoindre le QG';
    }
    return '';
  },
  update(dt) {
    const m = P.mission; if (!m) return;
    if (!P.gang) { P.mission = null; return; }
    m.t += dt;
    const hq = W.buildings[Gangs.G().hq]; const hqp = frontPx(hq);
    switch (m.type) {
      case 'run': {
        const cp = m.data.cps[m.data.i]; const pv = Player.inVeh();
        for (const v of m.data.convoy) {
          if (!m.data.fields[m.data.i]) m.data.fields[m.data.i] = NPC.buildField(clamp(Math.floor(cp.x / TS), 0, MAPW - 1), clamp(Math.floor(cp.y / TS), 0, MAPH - 1), carCost);
          const near = Math.hypot(v.x - P.x, v.y - P.y) < 380;
          if (near) { Veh.follow(v, m.data.fields[m.data.i], cp.x, cp.y, 0.6); v.brake = 0; } else { v.thr = 0; v.brake = 1; }
          Veh.step(v, dt);
        }
        if (m.data.i < 4) { if (pv && VEH[pv.type].moto && Math.hypot(P.x - cp.x, P.y - cp.y) < 110) { m.data.i++; Missions.setWp(); toast(`✔️ Étape ${m.data.i}/4`, 'good'); } }
        else if (Math.hypot(P.x - cp.x, P.y - cp.y) < 130) Missions.complete();
        if (m.t > 4 && !pv && m.stage === 0) { if (Math.floor(m.t) % 15 === 0 && Math.floor(m.t * 10) % 10 === 0) toast('Montez sur une moto (celle du club est devant le QG) !', 'warn'); }
        break;
      }
      case 'steal_car': {
        const v = Veh.byId(m.data.vid);
        if (m.stage === 0) { if (!v) { toast('La cible a disparu…', 'bad'); P.mission = null; return; } if (Math.floor(m.t * 2) % 4 === 0) P.wp = { x: v.x, y: v.y, label: 'Cible' }; }
        else if (v && Math.hypot(v.x - hqp.x, v.y - hqp.y) < 130 && P.veh === v.id) { Missions.complete(v.type === 'chopper' ? 300 : 0); }
        break;
      }
      case 'rob_store': case 'heist': if (m.stage === 1 && P.heat <= 0 && G.scene === 'out') { m.stage = 2; Missions.setWp(); toast('Vous avez semé la police. Rentrez au QG.', 'good'); } else if (m.stage === 2 && G.scene === hq.id) Missions.complete(m.data.loot || 0); break;
      case 'turf': {
        if (!m.data.spawned && Math.hypot(P.x - m.data.at.x, P.y - m.data.at.y) < 280 && G.scene === 'out') {
          m.data.spawned = true; const rg = Object.keys(GANGS).filter((g) => g !== P.gang);
          const rivals = [];
          for (let i = 0; i < 3; i++) {
            const pool = Gangs.members(pick(rg)).filter((n) => n.loc !== 'prison'); const n = pool.length ? pick(pool) : G.npcs[randi(0, G.npcs.length - 1)];
            if (!n || n.state === 'dead' || rivals.includes(n)) continue;
            n.loc = 'out'; n.x = m.data.at.x + rand(-80, 80); n.y = m.data.at.y + rand(-50, 50); n.state = 'walk'; n.busy = true; n.fighting = 9999; n.hp = 60; n.tile = null; rivals.push(n);
          }
          m.data.rivals = rivals; toast('⚔️ Les rivaux arrivent !', 'bad');
        }
        if (m.data.spawned && m.data.rivals.length && m.data.rivals.every((n) => n.state === 'down' || n.state === 'dead' || n.hp <= 0)) { m.data.rivals.forEach((n) => { n.fighting = 0; n.busy = n.state === 'down'; }); Missions.complete(); }
        break;
      }
    }
  },
  onStolen(v) {
    const m = P.mission; if (m && m.type === 'steal_car' && m.stage === 0 && v.id === m.data.vid) { m.stage = 1; v.target = false; Missions.setWp(); toast('Véhicule volé ! Ramenez-le au QG avant que la police ne vous trouve.', 'good'); }
  },
  scan(c) {
    const m = P.mission;
    if (G.scene === 'out' && m) {
      if (m.type === 'deal' && m.stage === 1) {
        for (const s of m.data.spots) if (!s.done) { const d = Math.hypot(s.x - P.x, s.y - P.y); if (d < 50) c.push({ d, label: '📦 Vendre un colis', run: () => { s.done = true; m.data.sold++; const n = G.npcs[randi(0, G.npcs.length - 1)]; const take = Math.min(150, n.bank); n.bank -= take; P.cash += Math.round(take * 0.3); if (!P.inv.colis) { } P.inv.colis = Math.max(0, (P.inv.colis || 0) - 1); if (!P.inv.colis) delete P.inv.colis; Wanted.crime(0.6, 'trafic de stupéfiants', true); toast('📦 Vendu !', 'good'); if (m.data.sold >= 3) Missions.complete(); else Missions.setWp(); } }); }
      }
      if (m.type === 'collect' && m.stage < 3) {
        for (const id of m.data.targets) if (!m.data.done.includes(id)) {
          const b = W.buildings[id]; const f = frontPx(b); const d = Math.hypot(f.x - P.x, f.y - P.y);
          if (d < 46) c.push({ d: d - 4, label: `💰 Racketter : ${b.name}`, run: () => UI.progress('Intimidation…', 3, () => {
            const biz = G.biz[b.id]; const take = Math.round(Math.min(Math.max(0, biz.cash) * 0.1, 450)); biz.cash -= take; m.data.cash += take; m.data.done.push(id);
            Wanted.crime(0.7, 'racket', true); toast(`+${money(take)} récupérés`, 'good'); if (m.data.done.length >= 3) m.stage = 3; Missions.setWp();
          }) });
        }
      }
    }
  },
  onEnter(b) {
    const m = P.mission; if (!m) return;
    if (m.type === 'deal' && m.stage === 0 && b.id === Gangs.G().hq) toast('Prenez les colis au stock (marchandise).');
  },
  onLeave(b) {},
  onBreakIn() {},
};
Interact.hooks.push(Missions.scan);

// ----- NPC agressifs (rivaux, victimes qui ripostent) -----
NPC.fightUpdate = function (dt) {
  if (G.scene !== 'out') return;
  for (const n of G.npcs) {
    if (!(n.fighting > 0) || n.loc !== 'out' || n.state === 'down' || n.state === 'dead' || n.cuffed) continue;
    if (n.fighting < 9000) n.fighting -= dt;
    n.busy = true;
    const dx = P.x - n.x, dy = P.y - n.y, d = Math.hypot(dx, dy);
    if (d > 300 && n.fighting < 9000) { n.fighting = 0; n.busy = false; n.planDay = -1; n.tile = null; continue; }
    if (d > 20) { const sp = 78 * dt; const nx = n.x + dx / d * sp, ny = n.y + dy / d * sp; if (!blockedOut(nx, n.y, 6)) n.x = nx; if (!blockedOut(n.x, ny, 6)) n.y = ny; n.a = Math.atan2(dy, dx); n.step = (n.step || 0) + dt * 9; }
    else { n.hitCd = (n.hitCd || 0) - dt; if (n.hitCd <= 0) { n.hitCd = 0.9; Player.hurt(randi(4, 8)); n.punch = 0.2; } }
    if (n.fighting <= 0) { n.busy = false; n.planDay = -1; n.tile = null; }
  }
};

// ----- Talk hooks pour gang -----
Talk.hooks.push((n, items, entry) => {
  const b = Player.cur();
  if (!P.gang && n.gang && b && b.kind === GANGS[n.gang].hq && n.gr >= 2) {
    items.unshift({ label: `${GANGS[n.gang].emoji} Rejoindre ${GANGS[n.gang].name}`, sub: 'Entretien avec ' + n.name, fn: () => Gangs.joinFlow(n.gang) });
  }
  if (P.gang && n.gang === P.gang) items.unshift({ label: `🔱 ${Gangs.rankName(n.gang, n.gr)}`, sub: `Loyauté : ${Math.round(n.rel)}`, disabled: true });
  if (P.gang && P.gangRank >= 2 && !n.gang && !['police', 'guard'].includes(n.job)) items.push({ label: '🤝 Recruter dans le gang', sub: `Chance de succès ≈ ${Math.round(Gangs.recruitChance(n) * 100)} %`, fn: () => { const r = Gangs.recruit(n); if (r) toast(r, 'warn'); else toast(`${n.name} rejoint ${Gangs.def().name} !`, 'good'); } });
  if (P.gang && P.gangRank >= 1 && n.gang && n.gang !== P.gang && !P.jail) items.push({ label: '😠 Provoquer (rival)', sub: 'Déclencher une bagarre', fn: () => { n.rel -= 30; n.fighting = 20; n.busy = true; Wanted.crime(0.3, 'rixe', true); } });
  if (P.inv.colis && n.crim > 0.25) items.push({ label: '📦 Vendre un colis', sub: `Prix : ${money(Math.round(100 + n.crim * 60))}`, fn: () => { if (n.bank + n.money < 100) { toast('Il/elle n\'a pas assez d\'argent.', 'warn'); return; } const pr = Math.round(100 + n.crim * 60); Eco.charge(n, Math.min(pr, n.bank + n.money)); P.cash += pr; P.inv.colis--; if (!P.inv.colis) delete P.inv.colis; Wanted.crime(0.7, 'trafic de stupéfiants', true); toast('Vendu ! ' + money(pr), 'good'); n.crim = Math.min(1, n.crim + 0.03); if (P.gang) Gangs.addRespect(6); } });
  if (P.gang && n.known && n.gang !== P.gang && G.t - (n.extortT || -9999) > 1440 && n.money + n.bank > 150) items.push({ label: '💰 Racketter', sub: 'Menacer pour de l\'argent', fn: () => { const t = Math.round(Math.min(n.money + n.bank, 160)); Eco.charge(n, t); P.cash += t; n.extortT = G.t; n.rel -= 40; Wanted.crime(1, 'extorsion', true); Gangs.addRespect(8); toast(`Extorsion : +${money(t)}`, 'good'); } });
});
Gangs.joinFlow = function (gid) {
  const g = GANGS[gid];
  UI.menu(`${g.emoji} ${g.name}`, `${g.blurb}<br>Pour entrer dans la famille, prouvez votre loyauté.`, [
    { label: '💶 Payer un droit d\'entrée', right: money(1000), sub: 'Entrée directe dans le gang', fn: () => { if (!Eco.charge(P, 1000)) { toast('Pas assez d\'argent.', 'bad'); return; } G.gangs[gid].treasury += 1000; const e = Gangs.join(gid); if (e) toast(e, 'warn'); else toast(`Vous êtes désormais ${Gangs.myRankName()} chez ${g.name} !`, 'good'); } },
    { label: '🔪 Faire une épreuve', sub: 'Livrer des colis pour prouver votre valeur', fn: () => { const e = Gangs.join(gid); if (e) { toast(e, 'warn'); return; } Missions.start('deal'); } },
  ]);
};

// ----- actes dans les QG -----
Acts.gang_meeting = (f, b) => {
  const gid = Object.keys(GANGS).find((k) => GANGS[k].hq === b.kind);
  const g = GANGS[gid];
  if (P.gang !== gid) {
    if (!P.gang) { Gangs.joinFlow(gid); return; }
    toast('Vous n\'avez rien à faire ici…', 'warn'); return;
  }
  const items = [];
  if (P.mission) items.push({ label: `🎯 En cours : ${P.mission.title}`, sub: Missions.text(), disabled: true }, { label: '🚫 Abandonner la mission', fn: () => { Missions.cancel(); toast('Mission abandonnée.', 'warn'); Gangs.addRespect(-10); } });
  else for (const k in Missions.defs) {
    if (Missions.defs[k].only && Missions.defs[k].only !== gid) continue;
    const d = Missions.defs[k]; const locked = P.gangRank < d.rank;
    items.push({ label: d.name, sub: d.desc + (locked ? ` (grade ${GANGS[gid].ranks[d.rank]} requis)` : ''), right: locked ? '🔒' : money(d.reward), disabled: locked, fn: () => Missions.start(k) });
  }
  if (P.gangRank === 3) items.push({ label: '👑 Défier le chef', sub: `Respect requis : ${g.resp[4]}`, fn: () => { UI.confirm('Coup d\'État', 'Si vous échouez, vous serez rétrogradé et blessé.', 'Oui, je me lance', 'Non', () => { const r = Gangs.challenge(); if (r) toast(r, 'bad'); }); } });
  items.push({ label: '🚪 Quitter le gang', fn: () => UI.confirm('Quitter ?', 'Vous perdrez tout votre grade et vos anciens frères pourraient mal le prendre.', 'Quitter', 'Rester', () => Gangs.leave()) });
  UI.menu(`${g.emoji} ${g.name}`, `Grade : <b>${Gangs.myRankName()}</b> · Respect ${Math.round(P.respect)} · Caisse ${money(Gangs.G().treasury)}`, items);
};
Acts.gang_safe = (f, b) => {
  const gid = Object.keys(GANGS).find((k) => GANGS[k].hq === b.kind);
  const g = G.gangs[gid];
  const m = P.mission;
  if (P.gang !== gid) {
    UI.confirm('Coffre', 'Tenter de forcer le coffre ? (très risqué)', 'Forcer', 'Non', () => UI.progress('Crochetage du coffre…', 8, () => {
      if (chance(0.25)) { const t = Math.min(g.treasury * 0.2, 1500); g.treasury -= t; P.cash += t; toast(`Vous avez volé ${money(t)} !`, 'good'); } else { toast('Alarme ! Les membres arrivent !', 'bad'); }
      for (const n of Gangs.members(gid)) { n.fighting = 40; }
    }));
    return;
  }
  const items = [];
  if (m && m.type === 'collect' && m.stage === 3) items.push({ label: `💰 Déposer le butin du racket`, right: money(m.data.cash), fn: () => { g.treasury += m.data.cash; Missions.complete(Math.round(m.data.cash * 0.15)); } });
  items.push({ label: '📥 Déposer de l\'argent', sub: 'Contribuer à la caisse (+respect)', fn: () => { const amt = Math.min(P.cash, 500); if (amt < 50) { toast('Vous n\'avez pas assez d\'espèces.', 'warn'); return; } P.cash -= amt; g.treasury += amt; Gangs.addRespect(Math.round(amt / 25)); toast(`${money(amt)} déposés. +${Math.round(amt / 25)} respect`, 'good'); } });
  if (P.gangRank >= 3) {
    const maxw = Math.floor(g.treasury * 0.1);
    items.push({ label: '📤 Retirer des fonds', sub: 'Max 10 % de la caisse', right: money(maxw), disabled: maxw < 50 || (P.lastWithdraw && G.t - P.lastWithdraw < 1440), fn: () => { g.treasury -= maxw; P.cash += maxw; P.lastWithdraw = G.t; toast(`+${money(maxw)}`, 'good'); } });
  }
  UI.menu('🔐 Coffre', `Caisse du gang : <b>${money(g.treasury)}</b>`, items);
};
Acts.gang_stash = (f, b) => {
  if (P.gang !== 'street') { toast('Marchandise des Diablos. Ne touchez pas.', 'warn'); return; }
  const m = P.mission;
  if (m && m.type === 'deal' && m.stage === 0) { P.inv.colis = (P.inv.colis || 0) + 3; m.stage = 1; Missions.setWp(); toast('📦 3 colis récupérés. Vendez-les dans les spots marqués.', 'good'); return; }
  UI.menu('📦 Stock', 'Marchandises du gang', [{ label: 'Prendre 1 colis à vendre', right: money(60), fn: () => { if (Eco.charge(P, 60)) { Inv.add('colis'); } else toast('Fonds insuffisants.', 'bad'); } }]);
};
// pour mafia/bikers, le colis se récupère à la table de réunion si mission deal
const _gm = Acts.gang_meeting;
Acts.gang_meeting = (f, b) => {
  const m = P.mission;
  if (m && m.type === 'deal' && m.stage === 0 && P.gang && GANGS[P.gang].hq === b.kind) { P.inv.colis = (P.inv.colis || 0) + 3; m.stage = 1; Missions.setWp(); toast('📦 3 colis récupérés. Vendez-les dans les spots marqués.', 'good'); return; }
  _gm(f, b);
};
Acts.casino = (f, b) => {
  const g = G.gangs.mafia;
  const mk = (bet) => ({ label: `Miser ${money(bet)}`, sub: 'Rouge/noir : 48,6 % de gagner', fn: () => {
    if (!Eco.charge(P, bet)) { toast('Pas assez d\'argent.', 'bad'); return; }
    if (Math.random() < 0.486) { const win = bet * 2; if (g.treasury >= bet) { g.treasury -= bet; P.cash += win; toast(`🎰 Gagné ! +${money(bet)}`, 'good'); Snd.good(); } else { P.cash += bet; toast('La banque est à sec : remboursé.', 'warn'); } }
    else { g.treasury += bet; toast(`🎰 Perdu. -${money(bet)}`, 'bad'); }
    P.fun = clamp(P.fun + 4, 0, 100); Acts.casino(f, b);
  } });
  UI.menu('🎰 Casino clandestin', `Espèces : ${money(P.cash)} · Banque : ${money(P.bank)}`, [mk(50), mk(250), mk(1000), mk(5000)]);
};
Acts.vault = (f, b) => {
  const m = P.mission;
  if (m && m.type === 'heist' && m.stage === 0 && G.scene === m.data.bid) {
    UI.confirm('Coffre-fort', 'Forcer le coffre ? L\'alarme se déclenchera immédiatement.', 'Forcer', 'Non', () => {
      Wanted.crime(3, 'braquage de banque', false);
      UI.progress('Perçage du coffre…', 20, () => {
        const biz = G.biz[b.id]; const loot = Math.round(Math.min(biz.cash * 0.04, 9000) + 1500);
        biz.cash -= loot; m.data.loot = Math.round(loot * 0.25); P.cash += Math.round(loot * 0.35); Gangs.G().treasury += loot * 0.4;
        m.stage = 1; Missions.setWp(); Wanted.crime(1, 'braquage de banque', false);
        toast(`💰 Butin : ${money(loot)} ! Fuyez !`, 'good');
      }, { onCancel: () => toast('Alarme en cours — fuyez !', 'bad') });
    });
  } else toast('Le coffre-fort est blindé. Il vous faudrait un plan (mission de gang).', 'warn');
};

Msg.pushRandom = function () {
  if (P.jail) return;
  const r = Math.random();
  if (P.partner != null && r < 0.35) { const n = G.npcs[P.partner]; if (n.state !== 'dead') return Msg.push(n.name, pick(['Bonne journée mon cœur ❤️', 'Tu rentres à quelle heure ce soir ?', 'Je pense à toi 😘', 'On se fait un resto bientôt ?']), { npc: n.id }); }
  const friends = G.npcs.filter((n) => n.known && n.rel > 10 && n.state !== 'dead');
  if (friends.length && r < 0.7) { const n = pick(friends); return Msg.push(n.name, pick(['Salut ! Tu fais quoi ce soir ?', 'On se capte bientôt ?', `Tu as vu les prix ? ${Eco.price('burger') > ITEMS.burger.p ? 'Ça augmente…' : 'Ça va encore.'}`, 'Soirée au club vendredi, tu viens ?']), { npc: n.id }); }
  if (P.gang && !P.mission && r < 0.85) { const g = Gangs.def(); return Msg.push(Gangs.members(P.gang).find((n) => n.gr >= 3)?.name || g.name, 'Ça te dit de faire un petit boulot pour la famille ? Passe au QG.', { col: g.col, actions: [{ label: '📍 Aller au QG', key: 'goto' }] }); }
  if (P.job === 'none' && r < 0.9) return Msg.push('Pôle Emploi', 'Des postes sont à pourvoir : police, pompiers, ambulance, fast food, banque, prison. Postulez via l\'appli Métier.');
};
