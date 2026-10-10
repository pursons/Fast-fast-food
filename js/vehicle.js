'use strict';
// ===== Véhicules : physique, circulation PNJ, carburant, dégâts =====
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S W N
const carCost = (t) => (t === T.ROAD ? 1 : t === T.SIDE ? 2.2 : t === T.GRASS ? 3.5 : 0);
const Veh = {
  create(type, x, y, a, o) {
    const T0 = VEH[type];
    const v = Object.assign({ id: G.uid++, type, x, y, a: a || 0, v: 0, col: pick(CAR_COLORS), fuel: T0.fuel, hp: 100, owner: 'npc', driver: null, locked: false, siren: false, plate: Veh.plate(), thr: 0, str: 0, brake: 0, stolen: false }, o || {});
    G.vehicles.push(v); return v;
  },
  plate() { return String.fromCharCode(65 + randi(0, 25)) + String.fromCharCode(65 + randi(0, 25)) + '-' + randi(100, 999) + '-' + String.fromCharCode(65 + randi(0, 25)) + String.fromCharCode(65 + randi(0, 25)); },
  byId(id) { return G.vehicles.find((v) => v.id === id); },
  remove(v) { const i = G.vehicles.indexOf(v); if (i >= 0) G.vehicles.splice(i, 1); },
  // coins de la boîte pour tests de collision
  hit(v, x, y, a) {
    const T0 = VEH[v.type], c = Math.cos(a), s = Math.sin(a), hw = T0.w / 2 - 2, hh = T0.h / 2 - 1;
    const pts = [[hw, hh], [hw, -hh], [-hw, hh], [-hw, -hh], [hw, 0], [-hw, 0]];
    for (const [px, py] of pts) { if (blockedOut(x + px * c - py * s, y + px * s + py * c, 1)) return true; }
    return false;
  },
  radius(v) { return VEH[v.type].h * 0.62; },
  // simulation d'un véhicule (contrôles dans v.thr, v.str, v.brake)
  step(v, dt) {
    const T0 = VEH[v.type];
    const dead = v.hp <= 0 || v.fuel <= 0;
    let thr = dead ? 0 : v.thr;
    if (v.drunkSteer) thr *= 0.9;
    const maxv = T0.max * (v.hp < 35 ? 0.7 : 1) * (v.boost || 1);
    if (thr > 0 && v.v < maxv) v.v += T0.acc * thr * dt * (v.v < 0 ? 2.5 : 1);
    else if (thr < 0) v.v += (v.v > 20 ? T0.acc * 2.2 : T0.acc * 0.6) * thr * dt;
    if (thr === 0) v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), 90 * dt);
    if (v.brake) v.v -= Math.sign(v.v) * Math.min(Math.abs(v.v), 420 * dt);
    v.v = clamp(v.v, -T0.max * 0.35, maxv * 1.05);
    const steer = v.str * T0.steer * clamp(Math.abs(v.v) / 110, 0, 1) * (v.v >= 0 ? 1 : -1) * (v.brake && Math.abs(v.v) > 100 ? 1.35 : 1);
    v.a += steer * dt;
    const nx = v.x + Math.cos(v.a) * v.v * dt, ny = v.y + Math.sin(v.a) * v.v * dt;
    if (!Veh.hit(v, nx, ny, v.a)) { v.x = nx; v.y = ny; }
    else if (!Veh.hit(v, nx, v.y, v.a)) { v.x = nx; v.v *= 0.9; }
    else if (!Veh.hit(v, v.x, ny, v.a)) { v.y = ny; v.v *= 0.9; }
    else { if (Math.abs(v.v) > 60) { v.hp -= Math.abs(v.v) / 14; v.crash = 0.25; if (v.driver === 'player') Snd.crash(); } v.v *= -0.3; }
    v.fuel = Math.max(0, v.fuel - Math.abs(v.v) * dt / 5000 * (T0.moto ? 0.5 : 1));
    if (v.crash) v.crash -= dt;
  },
  // collisions véhicule/véhicule (cercles)
  collide(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), r = Veh.radius(a) + Veh.radius(b) + 8;
    if (d < r && d > 0.01) {
      const push = (r - d) / 2, ux = dx / d, uy = dy / d;
      if (!Veh.hit(a, a.x - ux * push, a.y - uy * push, a.a)) { a.x -= ux * push; a.y -= uy * push; }
      if (!Veh.hit(b, b.x + ux * push, b.y + uy * push, b.a)) { b.x += ux * push; b.y += uy * push; }
      const rel = Math.abs(a.v - b.v);
      if (rel > 70) { a.hp -= rel / 18; b.hp -= rel / 18; if (a.driver === 'player' || b.driver === 'player') { Snd.crash(); Wanted.crime(rel > 140 ? 1 : 0.5, 'accident', true); } }
      a.v *= 0.6; b.v *= 0.6;
    }
  },
  // conduite autonome vers un point (poursuite, trajets)
  driveToward(v, tx, ty, speedF) {
    const T0 = VEH[v.type];
    const want = Math.atan2(ty - v.y, tx - v.x), diff = angDiff(v.a, want);
    v.str = clamp(diff * 2.4, -1, 1);
    const d = Math.hypot(tx - v.x, ty - v.y);
    const turn = Math.abs(diff);
    const target = T0.max * (speedF || 0.8) * (turn > 1 ? 0.35 : 1);
    v.thr = v.v < target ? 1 : (v.v > target + 30 ? -0.6 : 0);
    if (Math.abs(diff) > 1.8 && d < 120) { v.thr = -1; v.str = diff > 0 ? -1 : 1; }
    return d;
  },
  // suit un champ de distance (poursuite par les routes)
  follow(v, f, tx, ty, speedF) {
    const cur = f[tIdx(clamp(Math.floor(v.x / TS), 0, MAPW - 1), clamp(Math.floor(v.y / TS), 0, MAPH - 1))];
    if (cur < 3.5 || cur > 1e8) return Veh.driveToward(v, tx, ty, speedF);
    // lookahead de 2 tuiles
    let px = v.x, py = v.y;
    for (let k = 0; k < 2; k++) { const nx = NPC.bestStep(f, px, py); if (!nx) break; px = (nx[0] + 0.5) * TS; py = (nx[1] + 0.5) * TS; }
    return Veh.driveToward(v, px, py, speedF) + cur * 0;
  },
  nearestFree(x, y, r) { // position libre proche (sol marchable)
    for (let rr = 0; rr < 120; rr += 12) for (let a = 0; a < 6.28; a += 0.7) {
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (!blockedOut(px, py, r || 8)) return { x: px, y: py };
    }
    return { x, y };
  },
};

// ---------- circulation ----------
const Traffic = {
  laneInfo(tx, ty) { // renvoie directions possibles à la tuile, etc.
    return { h: !!(W.rd[tIdx(tx, ty)] & 2), v: !!(W.rd[tIdx(tx, ty)] & 1) };
  },
  laneCoord(dir, tx, ty) {
    // coordonnées de la voie pour une direction donnée, à la route la plus proche
    if (dir === 0 || dir === 2) { const cy = W.hy.reduce((b, c) => (Math.abs(c - ty) < Math.abs(b - ty) ? c : b)); return (cy + (dir === 0 ? 1 : -1) + 0.5) * TS; }
    const cx = W.vx.reduce((b, c) => (Math.abs(c - tx) < Math.abs(b - tx) ? c : b)); return (cx + (dir === 1 ? -1 : 1) + 0.5) * TS;
  },
  spawn(near) {
    // choisit un point de route aléatoire loin du joueur mais proche
    for (let k = 0; k < 14; k++) {
      let x, y, dir;
      if (chance(0.5)) { const cy = pick(W.hy); dir = chance(0.5) ? 0 : 2; y = (cy + (dir === 0 ? 1 : -1) + 0.5) * TS; x = near.x + rand(-1200, 1200); }
      else { const cx = pick(W.vx); dir = chance(0.5) ? 1 : 3; x = (cx + (dir === 1 ? -1 : 1) + 0.5) * TS; y = near.y + rand(-1000, 1000); }
      x = clamp(x, 40, MAPW * TS - 40); y = clamp(y, 40, MAPH * TS - 40);
      const d = Math.hypot(x - near.x, y - near.y); if (d < 520 || d > 1300) continue;
      if (G.vehicles.some((o) => Math.hypot(o.x - x, o.y - y) < 70)) continue;
      const type = pick(['car', 'car', 'compact', 'compact', 'van', 'sport', 'taxi', 'police']);
      const v = Veh.create(type, x, y, dir * Math.PI / 2, { owner: 'traffic', col: type === 'taxi' ? '#facc15' : type === 'police' ? '#f8fafc' : pick(CAR_COLORS), driver: 'ai' });
      v.dir = dir; v.cruise = rand(0.45, 0.65); return v;
    }
    return null;
  },
  update(dt) {
    const pv = P.veh ? Veh.byId(P.veh) : null;
    const center = pv || P;
    if (G.scene === 'out') {
      const cars = G.vehicles.filter((v) => v.owner === 'traffic');
      if (cars.length < 16 && chance(dt * 2)) Traffic.spawn(center);
      for (const v of cars) if (Math.hypot(v.x - center.x, v.y - center.y) > 1700 && !v.keep) Veh.remove(v);
    }
    for (const v of G.vehicles) {
      if (v.owner === 'traffic' && v.driver === 'ai') Traffic.ai(v, dt);
    }
  },
  ai(v, dt) {
    const T0 = VEH[v.type];
    if (v.dir == null) { v.dir = ((Math.round(v.a / (Math.PI / 2)) % 4) + 4) % 4; v.cruise = v.cruise || 0.5; }
    const tx = Math.floor(v.x / TS), ty = Math.floor(v.y / TS);
    // décision à l'intersection
    const info = Traffic.laneInfo(tx, ty);
    const inter = info.h && info.v;
    const cx = W.vx.reduce((b, c) => (Math.abs(c - tx) < Math.abs(b - tx) ? c : b)), cy = W.hy.reduce((b, c) => (Math.abs(c - ty) < Math.abs(b - ty) ? c : b));
    const key = cx + ',' + cy;
    if (inter && v.lastInter !== key) {
      // on décide au premier carreau de l'intersection (le centre-carré est le (cx,cy))
      const opts = [];
      for (let d = 0; d < 4; d++) {
        if (d === (v.dir + 2) % 4) continue;
        const nx = cx + DIRS[d][0] * 3, ny = cy + DIRS[d][1] * 3;
        if (nx < 1 || ny < 1 || nx >= MAPW - 1 || ny >= MAPH - 1) continue;
        if (!(W.rd[tIdx(nx, ny)])) continue;
        opts.push(d, d === v.dir ? d : -1);
      }
      const choices = opts.filter((o) => o >= 0);
      if (choices.length) v.dir = choices[Math.floor(Math.random() * choices.length)];
      v.lastInter = key;
    }
    if (!inter && v.lastInter) v.lastInter = null;
    const [dx, dy] = DIRS[v.dir];
    // maintien de voie
    const lane = Traffic.laneCoord(v.dir, tx, ty);
    let target = T0.max * v.cruise;
    // obstacles devant
    const ahead = 54 + v.v * 0.25;
    const fx = v.x + dx * ahead, fy = v.y + dy * ahead;
    for (const o of G.vehicles) {
      if (o === v) continue;
      if (Math.abs(o.x - fx) < 26 && Math.abs(o.y - fy) < 26 || Math.hypot(o.x - (v.x + dx * 30), o.y - (v.y + dy * 30)) < 30) { target = 0; break; }
    }
    const pl = P.veh ? null : P;
    if (pl && G.scene === 'out' && Math.abs(pl.x - fx) < 24 && Math.abs(pl.y - fy) < 24) target = 0;
    for (const n of G.npcs) if (n.loc === 'out' && Math.abs(n.x - fx) < 20 && Math.abs(n.y - fy) < 20) { target = 0; break; }
    if (v.stuck > 4) { target = T0.max * 0.3; }
    // vitesse sur l'axe
    const desired = target;
    if (v.v < desired) v.v = Math.min(desired, v.v + T0.acc * dt); else v.v = Math.max(desired, v.v - 380 * dt);
    if (v.v < 5 && target === 0) v.stuck = (v.stuck || 0) + dt; else v.stuck = 0;
    // ajuste cap et lane
    const targetA = Math.atan2(dy, dx);
    v.a += angDiff(v.a, targetA) * Math.min(1, dt * 6);
    let nx = v.x + Math.cos(v.a) * v.v * dt, ny = v.y + Math.sin(v.a) * v.v * dt;
    if (dx !== 0) ny += (lane - ny) * Math.min(1, dt * 4); else nx += (lane - nx) * Math.min(1, dt * 4);
    if (!Veh.hit(v, nx, ny, v.a)) { v.x = nx; v.y = ny; } else { v.stuck = (v.stuck || 0) + dt * 2; }
    if (v.x < 8 || v.y < 8 || v.x > MAPW * TS - 8 || v.y > MAPH * TS - 8) Veh.remove(v);
    v.thr = 0;
  },
};

Traffic.driverPed = () => ({ name: 'Conducteur' });
// ---------- sons très simples ----------
const Snd = {
  ctx: null,
  init() { try { Snd.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { Snd.ctx = null; } },
  beep(f, d, type, vol) {
    if (!Snd.ctx || G.settings.vol <= 0) return;
    try {
      if (Snd.ctx.state === 'suspended') Snd.ctx.resume();
      const o = Snd.ctx.createOscillator(), g = Snd.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = f; g.gain.value = (vol || 0.08) * G.settings.vol;
      o.connect(g); g.connect(Snd.ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, Snd.ctx.currentTime + d); o.stop(Snd.ctx.currentTime + d);
    } catch (e) { /* ignore */ }
  },
  click() { Snd.beep(660, 0.06, 'triangle'); },
  good() { Snd.beep(880, 0.12, 'sine'); setTimeout(() => Snd.beep(1175, 0.14, 'sine'), 90); },
  bad() { Snd.beep(180, 0.25, 'sawtooth', 0.06); },
  crash() { Snd.beep(90, 0.2, 'square', 0.07); },
  notif() { Snd.beep(1040, 0.08, 'sine', 0.06); setTimeout(() => Snd.beep(1320, 0.08, 'sine', 0.06), 80); },
};
