'use strict';
// ===== PNJ : habitants avec routines, pathfinding par champs de distance =====
class MinHeap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() {
    const k = this.k, v = this.v; const rv = v[0]; const lk = k.pop(), lv = v.pop(); const n = k.length;
    if (n > 0) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; } k[i] = lk; v[i] = lv; }
    return rv;
  }
  get size() { return this.k.length; }
}
const walkCost = (t) => (t === T.ROAD ? 3 : t === T.SIDE ? 1 : t === T.GRASS ? 1.5 : 0);
const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

const NPC = {
  fields: {},
  field(key, fx, fy) {
    let f = NPC.fields[key];
    if (f) return f;
    f = NPC.buildField(fx, fy, walkCost); NPC.fields[key] = f; return f;
  },
  buildField(fx, fy, costFn) {
    const d = new Float32Array(MAPW * MAPH).fill(1e9);
    const h = new MinHeap();
    d[tIdx(fx, fy)] = 0; h.push(0, tIdx(fx, fy));
    while (h.size) {
      const i = h.pop(); const x = i % MAPW, y = (i / MAPW) | 0; const dc = d[i];
      for (let n = 0; n < 8; n++) {
        const nx = x + NB[n][0], ny = y + NB[n][1];
        if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
        const c = costFn(W.t[tIdx(nx, ny)]); if (!c) continue;
        if (n >= 4 && (!costFn(W.t[tIdx(x + NB[n][0], y)]) || !costFn(W.t[tIdx(x, y + NB[n][1])]))) continue;
        const nd = dc + c * (n >= 4 ? 1.41 : 1); const ni = tIdx(nx, ny);
        if (nd < d[ni]) { d[ni] = nd; h.push(nd, ni); }
      }
    }
    return d;
  },
  // meilleur voisin d'un champ de distance
  bestStep(f, px, py) {
    const cx = Math.floor(px / TS), cy = Math.floor(py / TS);
    let best = null, bd = f[tIdx(clamp(cx, 0, MAPW - 1), clamp(cy, 0, MAPH - 1))];
    for (let i = 0; i < 8; i++) {
      const nx = cx + NB[i][0], ny = cy + NB[i][1];
      if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
      const dd = f[tIdx(nx, ny)]; if (dd < bd) { bd = dd; best = [nx, ny]; }
    }
    return best;
  },
  destObj(key) { // 'b12' ou 'p3'
    if (key[0] === 'b') { const b = W.buildings[+key.slice(1)]; return { key, bid: b.id, fx: b.front.x, fy: b.front.y }; }
    const p = W.pois.find((q) => q.id === key); return { key, bid: null, fx: p.front.x, fy: p.front.y };
  },
  // pas suivant vers la destination (renvoie tuile cible ou null si arrivé)
  stepTo(n, dest) {
    const f = NPC.field(dest.key, dest.fx, dest.fy);
    const cx = Math.floor(n.x / TS), cy = Math.floor(n.y / TS);
    const cur = f[tIdx(cx, cy)];
    if (cur === 0) return null;
    let best = null, bd = cur;
    for (let i = 0; i < 8; i++) {
      const nx = cx + NB[i][0], ny = cy + NB[i][1];
      if (nx < 0 || ny < 0 || nx >= MAPW || ny >= MAPH) continue;
      const dd = f[tIdx(nx, ny)];
      if (dd < bd) { bd = dd; best = [nx, ny]; }
    }
    return best;
  },

  // ---------- génération ----------
  generate() {
    const rnd = mulberry(777);
    const R = (a, b) => a + rnd() * (b - a), Ri = (a, b) => Math.floor(R(a, b + 1)), Pk = (arr) => arr[Math.floor(rnd() * arr.length)];
    G.npcs = [];
    const homes = W.buildings.filter((b) => b.kind === 'house' || b.kind === 'apt');
    // maison du joueur : maison la plus proche du premier fast food
    const ff = W.byKind.fastfood[0];
    let ph = null, pd = 1e9;
    for (const b of W.byKind.house) { const d = Math.hypot(b.x - ff.x, b.y - ff.y); if (d < pd) { pd = d; ph = b; } }
    W.playerHome = ph.id;
    const used = new Set();
    const mkName = (g) => { for (let i = 0; i < 50; i++) { const f = Pk(g ? FIRST_F : FIRST_M), l = Pk(LAST); if (!used.has(f + l)) { used.add(f + l); return [f, l]; } } return [Pk(FIRST_M), Pk(LAST)]; };
    const target = 92;
    const cap = (b) => (b.kind === 'apt' ? Ri(3, 5) : Ri(1, 3));
    let pool = homes.filter((b) => b.id !== ph.id);
    const slots = [];
    pool.forEach((b) => { const c = cap(b); for (let i = 0; i < c; i++) slots.push(b.id); });
    while (slots.length > target) slots.splice(Math.floor(rnd() * slots.length), 1);
    slots.forEach((hid, i) => {
      const g = rnd() < 0.5 ? 1 : 0; const [f, l] = mkName(g);
      const n = {
        id: i, name: f + ' ' + l, first: f, last: l, g, age: Ri(18, 66), col: Pk(NPC_COLORS), skin: Pk(SKIN), hair: Pk(HAIR), home: hid, work: null, job: 'none', jr: 0, sjob: null,
        gang: null, gr: 0, loc: hid, x: 0, y: 0, a: 0, state: 'idle', hp: 100, money: Ri(30, 300), bank: Ri(200, 6000), crim: Math.pow(rnd(), 2) * 0.9, soc: rnd(),
        rel: 0, known: false, phone: '06 ' + Ri(10, 99) + ' ' + Ri(10, 99) + ' ' + Ri(10, 99) + ' ' + Ri(10, 99), looks: Ri(30, 95), bio: '', dest: null, destKey: null, planDay: -1, plan: null,
        shift: Ri(0, 2), offMin: Ri(0, 50), off: [Ri(0, 6), Ri(0, 6)], speed: R(38, 54), think: rnd() * 2, fav: {}, followers: Ri(40, 4000), emoji: g ? Pk(['👩', '👩‍🦰', '👱‍♀️', '👩‍🦱', '👩🏽']) : Pk(['👨', '🧔', '👱', '👨‍🦱', '👨🏽']),
        hunger: 0, drunk: false, say: null, wait: 0, lastWork: 0,
      };
      n.interests = [];
      const ints = ['la moto', 'la cuisine', 'le sport', 'la musique', 'les voyages', 'les séries', 'les jeux vidéo', 'la mode', 'les chiens', 'la fête', 'la lecture', 'les voitures'];
      while (n.interests.length < 3) { const x = Pk(ints); if (!n.interests.includes(x)) n.interests.push(x); }
      n.bio = Pk(['Pas de prise de tête.', 'Ici pour de vrais rencards.', 'Cherche quelqu\'un de fiable.', 'Amateur de bons plans et de bonne bouffe.', 'Vie de nuit, mais romantique.', 'Je bosse dur, je kiffe fort.']);
      G.npcs.push(n);
    });
    // emplois
    const free = G.npcs.slice().sort(() => rnd() - 0.5);
    const pickEmp = () => free.pop();
    const rankSets = { police: [4, 3, 2, 1, 1, 0, 0], fire: [3, 2, 1, 1, 0], ems: [3, 2, 2, 1, 0, 0], guard: [4, 3, 2, 1, 1, 0, 0], fastfood: [3, 2, 1, 0], banker: [3, 1, 0] };
    for (const b of W.buildings) {
      const need = STAFF[b.kind]; if (!need) continue;
      const jobOf = { police: 'police', fire: 'fire', hospital: 'ems', prison: 'guard', fastfood: 'fastfood', bank: 'banker' }[b.kind];
      const sjobOf = { restaurant: 'waiter', bar: 'waiter', club: 'clubstaff', store: 'clerk', gas: 'clerk', dealer: 'clerk', office: 'clerk' }[b.kind];
      for (let i = 0; i < need; i++) {
        const n = pickEmp(); if (!n) break;
        n.work = b.id;
        if (jobOf) { n.job = jobOf; n.jr = (rankSets[jobOf] || [0])[i % (rankSets[jobOf] || [0]).length]; } else n.sjob = sjobOf;
        if (b.kind === 'fastfood') n.shift = i % 2;
        n.fav.shiftOff = Ri(0, 6);
      }
    }
    // gangs
    G.gangs = {};
    const taken = new Set(G.npcs.filter((n) => n.job === 'police' || n.job === 'guard' || n.job === 'fire' || n.job === 'ems').map((n) => n.id));
    for (const gid of Object.keys(GANGS)) {
      const hq = W.byKind[GANGS[gid].hq][0];
      const cands = G.npcs.filter((n) => !taken.has(n.id) && !n.gang && n.age < 60).sort((a, b) => b.crim - a.crim);
      const ranks = [4, 3, 2, 2, 1, 1, 0, 0, 0];
      const members = [];
      ranks.forEach((r, i) => { const n = cands[i + (gid === 'bikers' ? 3 : gid === 'street' ? 6 : 0)] || cands[i]; if (!n || n.gang) return; n.gang = gid; n.gr = r; n.crim = Math.max(n.crim, 0.5); if (r >= 2) { n.job = 'none'; n.jr = 0; n.sjob = null; n.work = null; } members.push(n.id); });
      G.gangs[gid] = { id: gid, treasury: 4000 + Ri(0, 3000), respect: 800, members, boss: members[0], hq: hq.id, wars: {}, tribute: 0.15, raided: 0 };
    }
    // lieux favoris
    const pickNear = (kind, n) => { const list = W.byKind[kind] || []; const h = W.buildings[n.home]; list.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)); return list[Math.min(list.length - 1, Math.floor(rnd() * rnd() * list.length))].id; };
    for (const n of G.npcs) {
      for (const k of ['fastfood', 'restaurant', 'bar', 'club', 'store', 'gas', 'bank']) n.fav[k] = pickNear(k, n);
      const parks = W.pois.filter((p) => p.kind === 'park'); n.fav.park = parks[Math.floor(rnd() * parks.length)].id;
      const walks = W.pois.filter((p) => p.kind === 'walk'); n.fav.walk = walks.length ? walks[Math.floor(rnd() * walks.length)].id : n.fav.park;
      const hb = W.buildings[n.home]; n.x = (hb.front.x + 0.5) * TS; n.y = (hb.front.y + 0.5) * TS;
      n.loc = n.home;
    }
  },

  // ---------- planning de la journée ----------
  keyDest(n, key) {
    switch (key) {
      case 'home': return 'b' + n.home;
      case 'work': return n.work != null ? 'b' + n.work : 'b' + n.home;
      case 'fast': return 'b' + n.fav.fastfood; case 'resto': return 'b' + n.fav.restaurant; case 'bar': return 'b' + n.fav.bar;
      case 'club': return 'b' + W.byKind.club[0].id; case 'store': return 'b' + n.fav.store; case 'gas': return 'b' + n.fav.gas;
      case 'park': return n.fav.park; case 'walk': return n.fav.walk; case 'bank': return 'b' + n.fav.bank;
      case 'hq': return n.gang ? 'b' + G.gangs[n.gang].hq : 'b' + n.home;
    }
    return 'b' + n.home;
  },
  makePlan(n) {
    const rnd = mulberry(hashStr(n.id + ':' + dayN()) ^ 0x9e3779b9);
    const plan = new Array(48).fill('home');
    const paint = (s, e, key) => { for (let m = Math.floor(s / 30); m < Math.ceil(e / 30); m++) if (m >= 0 && m < 48) plan[m] = key; };
    const dow = dowOf();
    const wd = dow >= 1 && dow <= 5;
    const R = (a, b) => a + rnd() * (b - a);
    paint(0, 6 * 60 + n.offMin, 'home');
    // loisirs (peints en premier, le travail les écrase)
    const eveningChoices = n.gang && rnd() < 0.55 ? ['hq'] : (dow === 5 || dow === 6) ? ['club', 'club', 'bar', 'resto', 'home', 'park'] : ['home', 'home', 'bar', 'resto', 'fast', 'park', 'store', 'club'];
    const ev = eveningChoices[Math.floor(rnd() * eveningChoices.length)];
    const evS = 18 * 60 + Math.floor(R(0, 150)), evE = evS + Math.floor(R(90, 240));
    if (ev !== 'home') paint(evS, evE, ev);
    if (n.gang && rnd() < 0.5) paint(14 * 60, 17 * 60, 'hq');
    if (n.work && wd && rnd() < 0.4) paint(17 * 60 + 30, 18 * 60 + 30, 'walk');
    if (!n.work || !wd || rnd() < 0.2) { // journée libre
      const m = ['park', 'walk', 'fast', 'walk', 'walk', 'store'][Math.floor(rnd() * 6)];
      if (rnd() < 0.7) paint(10 * 60 + Math.floor(R(0, 120)), 12 * 60 + Math.floor(R(30, 150)), m);
      if (rnd() < 0.7) paint(15 * 60, 17 * 60, ['park', 'walk', 'walk'][Math.floor(rnd() * 3)]);
    }
    if (rnd() < 0.55) { const s = 12 * 60 + 10 + Math.floor(R(0, 40)); paint(s, s + 50, rnd() < 0.5 ? 'fast' : 'resto'); }
    paint(23 * 60 + 30, 24 * 60, 'home');
    // travail
    const working = n.work != null && !(n.fav.shiftOff === dow) && !(n.off[0] === dow && n.sjob);
    if (working) {
      const k = W.buildings[n.work].kind;
      let spans = [];
      if (['police', 'fire', 'hospital', 'prison'].includes(k)) spans = [[[6, 14], [14, 22], [22, 30]][n.shift % 3]];
      else if (k === 'fastfood') spans = n.shift % 2 === 0 ? [[10, 18]] : [[16, 23.5]];
      else if (k === 'restaurant') spans = [[11, 15], [18, 23]];
      else if (k === 'bar') spans = [[17, 26]];
      else if (k === 'club') spans = [[21, 29.5]];
      else if (k === 'bank' || k === 'office') spans = wd ? [[8.5, 17]] : [];
      else if (k === 'store') spans = [[9, 19]];
      else spans = [[8, 18]];
      for (const [s, e] of spans) { paint(s * 60 - 30, e * 60, 'work'); if (e > 24) paint(0, (e - 24) * 60, 'work'); }
      // service de nuit débordant de la veille
      if (['police', 'fire', 'hospital', 'prison'].includes(k) && n.shift % 3 === 2) paint(0, 6 * 60, 'work');
      if (k === 'bar') paint(0, 2 * 60, 'work');
      if (k === 'club') paint(0, 5.5 * 60, 'work');
    }
    n.plan = plan; n.planDay = dayN();
  },
  destKeyAt(n) {
    if (n.override && G.t < n.override.until && G.t >= (n.override.from || 0)) return n.override.key;
    if (n.planDay !== dayN()) NPC.makePlan(n);
    const idx = Math.min(47, Math.floor(minOfDay() / 30));
    let k = n.plan[idx];
    // petit décalage individuel : départ retardé de offMin
    return NPC.keyDest(n, k);
  },
  // ---------- cycle de vie ----------
  enter(n, b) {
    n.loc = b.id; n.state = 'idle';
    n.visitedAt = G.t;
    if (b.id !== n.home || chance(0.1)) Eco.onVisit(n, b);
    if (G.scene === b.id) Interior.add(n);
  },
  exit(n) {
    const b = W.buildings[n.loc];
    if (G.scene === b.id) Interior.remove(n);
    n.loc = 'out'; n.x = (b.front.x + 0.5) * TS + rand(-6, 6); n.y = (b.front.y + 0.5) * TS + rand(-6, 6); n.state = 'walk'; n.tile = null;
    if (n.work !== b.id && n.sjob == null) n.drunk = false;
  },
  update(dt) {
    const fast = G.ff > 0;
    for (const n of G.npcs) {
      if (n.loc === 'prison' || n.state === 'dead' || n.hospital) continue;
      if (n.busy) continue; // piloté par un autre système (police, incident…)
      if (n.state === 'flee') { n.fleeT = (n.fleeT || 0) - dt; if (n.fleeT <= 0) n.state = 'walk'; }
      n.think -= dt;
      if (n.think <= 0) {
        n.think = 1 + Math.random();
        const key = NPC.destKeyAt(n);
        if (key !== n.destKey) { n.destKey = key; n.dest = NPC.destObj(key); n.roam = key[0] === 'p'; n.roamWait = rand(4, 20); }
      }
      const d = n.dest; if (!d) continue;
      if (n.roam && n.loc === 'out' && n.state === 'idle') {
        n.roamWait -= dt;
        if (n.roamWait <= 0) {
          const near = W.pois.filter((p) => Math.hypot((p.x + 0.5) * TS - n.x, (p.y + 0.5) * TS - n.y) < 1100);
          if (near.length) { n.dest = NPC.destObj(pick(near).id); n.tile = null; n.state = 'walk'; n.roamWait = rand(8, 28); }
        }
        continue;
      }
      if (typeof n.loc === 'number' && d.bid === n.loc) continue; // déjà à destination
      if (typeof n.loc === 'number') {
        // à l'intérieur : quitter (petit délai individuel)
        if (G.t - (n.visitedAt || 0) < 8 + n.offMin * 0.2 && !fast) continue;
        NPC.exit(n);
      }
      if (n.loc !== 'out') continue;
      if (fast) { // saut dans le temps : téléportation
        if (d.bid != null) { n.x = (d.fx + 0.5) * TS; n.y = (d.fy + 0.5) * TS; NPC.enter(n, W.buildings[d.bid]); } else { n.x = (d.fx + 0.5) * TS; n.y = (d.fy + 0.5) * TS; }
        continue;
      }
      NPC.walk(n, dt);
    }
  },
  walk(n, dt) {
    const d = n.dest;
    if (!n.tile) {
      const nx = NPC.stepTo(n, d);
      if (!nx) { // arrivé
        if (d.bid != null) NPC.enter(n, W.buildings[d.bid]); else { n.state = 'idle'; }
        return;
      }
      n.tile = nx;
    }
    const tx = (n.tile[0] + 0.5) * TS, ty = (n.tile[1] + 0.5) * TS;
    const dx = tx - n.x, dy = ty - n.y, dd = Math.hypot(dx, dy);
    const sp = (n.state === 'flee' ? n.speed * 2.2 : n.speed) * dt;
    n.state = n.state === 'flee' ? 'flee' : 'walk';
    if (dd <= sp) { n.x = tx; n.y = ty; n.tile = null; } else { n.x += (dx / dd) * sp; n.y += (dy / dd) * sp; n.a = Math.atan2(dy, dx); }
    n.step = (n.step || 0) + dt * 8;
  },
  placeRandom(n, minD, maxD) {
    for (let k = 0; k < 300; k++) {
      const x = randi(2, MAPW - 3), y = randi(2, MAPH - 3);
      if (W.t[tIdx(x, y)] !== T.SIDE) continue;
      const px = (x + 0.5) * TS, py = (y + 0.5) * TS; const d = Math.hypot(px - P.x, py - P.y);
      if (d < minD || d > maxD) continue;
      if (typeof n.loc === 'number') Interior.remove(n);
      n.loc = 'out'; n.x = px; n.y = py; n.tile = null; return true;
    }
    return false;
  },
  free() { return G.npcs.filter((n) => !n.busy && n.state !== 'dead' && !n.hospital && n.loc !== 'prison' && n.loc !== 'esc' && n.job !== 'police' && n.loc !== 'none'); },
  // fonction utilitaire : NPC proches en extérieur
  nearby(x, y, r) { const out = []; for (const n of G.npcs) if (n.loc === 'out' && Math.hypot(n.x - x, n.y - y) < r) out.push(n); return out; },
  say(n, text, secs) { n.say = { text, t: secs || 3 }; },
  hire(n, job, bid, rank) { n.job = job; n.work = bid; n.jr = rank || 0; n.sjob = null; n.planDay = -1; },
  fire(n) { n.job = 'none'; n.jr = 0; n.work = null; n.sjob = null; n.planDay = -1; },
  // sauvegarde compacte
  saveAll() { return G.npcs.map((n) => [n.money, n.bank, n.job, n.jr, n.work, n.sjob, n.gang, n.gr, n.rel, n.known ? 1 : 0, n.state === 'dead' ? 1 : 0, Math.round(n.crim * 100) / 100, n.matched ? 1 : 0, n.aff || 0, n.followed ? 1 : 0, n.partner ? 1 : 0]); },
  loadAll(arr) { arr.forEach((a, i) => { const n = G.npcs[i]; if (!n) return; [n.money, n.bank, n.job, n.jr, n.work, n.sjob, n.gang, n.gr, n.rel] = a; n.known = !!a[9]; if (a[10]) n.state = 'dead'; n.crim = a[11]; n.matched = !!a[12]; n.aff = a[13]; n.followed = !!a[14]; n.partner = !!a[15]; n.planDay = -1; }); },
};

// ---------- PNJ à l'intérieur d'un bâtiment (visibles seulement si le joueur y est) ----------
const Interior = {
  list: [], S: null, b: null,
  load(b) {
    Interior.b = b; Interior.S = sceneOf(b); Interior.list = [];
    for (const n of G.npcs) if (n.loc === b.id && n.state !== 'dead') Interior.add(n);
    if (b.kind === 'prison') Interior.populatePrison();
  },
  unload() { Interior.list = []; Interior.S = null; Interior.b = null; },
  freeSpot(S, kind) {
    const arr = kind === 'staff' ? S.staff : S.cust;
    const tries = arr.slice().sort(() => Math.random() - 0.5);
    for (const s of tries) {
      if (!Interior.list.some((e) => Math.hypot(e.tx - (s.x + 0.5) * TS, e.ty - (s.y + 0.5) * TS) < 14)) return s;
    }
    return arr[Math.floor(Math.random() * arr.length)] || { x: S.w / 2, y: S.h / 2 };
  },
  add(n) {
    const S = Interior.S, b = Interior.b; if (!S || Interior.list.some((e) => e.n === n)) return;
    const working = n.work === b.id && NPC.destKeyAt(n) === 'b' + b.id && (n.job !== 'none' || n.sjob);
    let role = working ? 'staff' : 'cust';
    if (n.gang && b.kind === GANGS[n.gang].hq) role = n.gr >= 2 ? 'staff' : 'cust';
    const spot = Interior.freeSpot(S, role);
    const e = { n, x: (S.door.x + 0.5) * TS, y: (S.door.y - 0.5) * TS, tx: (spot.x + 0.5) * TS, ty: (spot.y + 0.5) * TS, role, wait: rand(3, 12), a: -Math.PI / 2 };
    if (b.id === n.home && minOfDay() > 23 * 60 + n.offMin || b.id === n.home && minOfDay() < 6 * 60) { // dort
      const bed = S.furn.find((f) => f.t === 'bed'); if (bed) { e.x = e.tx = (bed.x + 1) * TS; e.ty = e.y = (bed.y + 1.5) * TS; e.sleep = true; }
    }
    if (b.tickets) { const k = b.tickets.findIndex((t) => t.npc === n.id); if (k >= 0 && S.extra.queue) { const q = S.extra.queue[k % S.extra.queue.length]; e.tx = (q.x + 0.5) * TS; e.ty = (q.y + 0.5) * TS; e.role = 'queue'; e.ticket = b.tickets[k]; } }
    Interior.list.push(e);
  },
  remove(n) { Interior.list = Interior.list.filter((e) => e.n !== n); },
  populatePrison() {
    const S = Interior.S;
    // détenus (PNJ emprisonnés)
    (G.prisoners || []).forEach((pr, i) => {
      const n = G.npcs[pr.npc]; if (!n) return;
      if (Interior.list.some((e) => e.n === n)) return;
      const cell = S.extra.cells[i % S.extra.cells.length];
      const spot = Interior.freeSpot(S, 'cust');
      const cx = (G.t % 1440) < 7 * 60 || (G.t % 1440) > 21 * 60 ? cell : spot;
      Interior.list.push({ n, x: (cx.x + 0.5) * TS, y: (cx.y + 0.5) * TS, tx: (spot.x + 0.5) * TS, ty: (spot.y + 0.5) * TS, role: 'cust', wait: rand(3, 10), a: 0, prisoner: true });
    });
  },
  update(dt) {
    const S = Interior.S; if (!S) return;
    for (const e of Interior.list) {
      e.wait -= dt;
      const n = e.n;
      if (e.sleep) continue;
      if (n.say) { n.say.t -= dt; if (n.say.t <= 0) n.say = null; }
      if (e.hold) continue;
      if (e.role === 'cust' && e.wait <= 0) {
        const s = Interior.freeSpot(S, 'cust'); e.tx = (s.x + 0.5) * TS; e.ty = (s.y + 0.5) * TS; e.wait = rand(5, 16);
      }
      if (e.role === 'staff' && e.patrol) { /* géré ailleurs */ }
      const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
      if (d > 3) {
        const sp = 42 * dt; const nx = e.x + (dx / d) * sp, ny = e.y + (dy / d) * sp;
        if (!blockedIn(S, nx, e.y, 6)) e.x = nx; else e.wait = Math.min(e.wait, 0.5);
        if (!blockedIn(S, e.x, ny, 6)) e.y = ny; else e.wait = Math.min(e.wait, 0.5);
        e.a = Math.atan2(dy, dx); e.moving = true; e.step = (e.step || 0) + dt * 8;
      } else e.moving = false;
    }
  },
  // entrées proches du joueur
  near(x, y, r) { return Interior.list.filter((e) => Math.hypot(e.x - x, e.y - y) < r); },
};
