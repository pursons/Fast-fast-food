'use strict';
// ===== Rendu 2D =====
const R = { cv: null, ctx: null, w: 0, h: 0, dpr: 1, Z: 1.1, cam: { x: 0, y: 0 }, ground: null, mini: null, shake: 0, t: 0 };

function resize() {
  const cv = R.cv; R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.w = window.innerWidth; R.h = window.innerHeight;
  cv.width = Math.floor(R.w * R.dpr); cv.height = Math.floor(R.h * R.dpr);
  R.Z = clamp(Math.min(R.w, R.h) / 400, 0.9, 2.2);
}
function buildGround() {
  const cv = document.createElement('canvas'); cv.width = MAPW * TS; cv.height = MAPH * TS; const c = cv.getContext('2d');
  const rnd = mulberry(99);
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = W.t[tIdx(x, y)];
    let col;
    if (t === T.ROAD) col = '#3a3e49'; else if (t === T.SIDE) col = '#b8b5ac'; else if (t === T.WATER) col = '#3b82c4'; else col = ['#5a9a4c', '#5d9e4f', '#589648', '#609f52'][Math.floor(rnd() * 4)];
    if (t === T.BLD) col = '#5a9a4c';
    c.fillStyle = col; c.fillRect(x * TS, y * TS, TS, TS);
    if (t === T.SIDE) { c.strokeStyle = '#a5a299'; c.lineWidth = 1; c.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1); }
    if (t === T.GRASS && rnd() < 0.06) { c.fillStyle = '#6fb15f'; c.fillRect(x * TS + rnd() * 24, y * TS + rnd() * 24, 3, 3); }
  }
  // marquages routiers
  c.fillStyle = '#e9c545';
  for (const cx of W.vx) for (let y = 0; y < MAPH; y++) { const hh = W.rd[tIdx(cx, y)] & 2; if (hh) continue; if (y % 2 === 0) c.fillRect(cx * TS + TS / 2 - 1.5, y * TS + 4, 3, TS - 8); }
  for (const cy of W.hy) for (let x = 0; x < MAPW; x++) { const vv = W.rd[tIdx(x, cy)] & 1; if (vv) continue; if (x % 2 === 0) c.fillRect(x * TS + 4, cy * TS + TS / 2 - 1.5, TS - 8, 3); }
  c.fillStyle = '#d6d6d6';
  for (const cx of W.vx) for (let y = 0; y < MAPH; y++) { if (W.rd[tIdx(cx, y)] & 2) continue; c.fillRect((cx - 1) * TS + 1, y * TS, 2, TS); c.fillRect((cx + 2) * TS - 3, y * TS, 2, TS); }
  for (const cy of W.hy) for (let x = 0; x < MAPW; x++) { if (W.rd[tIdx(x, cy)] & 1) continue; c.fillRect(x * TS, (cy - 1) * TS + 1, TS, 2); c.fillRect(x * TS, (cy + 2) * TS - 3, TS, 2); }
  // passages piétons
  c.fillStyle = '#e8e8e8';
  for (const cx of W.vx) for (const cy of W.hy) {
    for (let k = -1; k <= 1; k++) {
      for (let s = 0; s < 4; s++) {
        c.fillRect((cx + k) * TS + 4 + s * 7, (cy - 2) * TS + 4, 4, TS - 8); c.fillRect((cx + k) * TS + 4 + s * 7, (cy + 2) * TS + 4, 4, TS - 8);
        c.fillRect((cx - 2) * TS + 4, (cy + k) * TS + 4 + s * 7, TS - 8, 4); c.fillRect((cx + 2) * TS + 4, (cy + k) * TS + 4 + s * 7, TS - 8, 4);
      }
    }
  }
  // arbres, eau, clôtures
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = W.t[tIdx(x, y)]; const px = x * TS, py = y * TS;
    if (t === T.TREE) {
      c.fillStyle = '#0003'; c.beginPath(); c.ellipse(px + 18, py + 24, 12, 6, 0, 0, 6.3); c.fill();
      c.fillStyle = '#6b4423'; c.fillRect(px + 14, py + 14, 4, 10);
      for (const [dx, dy, r, col] of [[16, 11, 11, '#2f7d32'], [10, 14, 7, '#3a8f3d'], [22, 14, 7, '#2a7330'], [16, 8, 7, '#43a047']]) { c.fillStyle = col; c.beginPath(); c.arc(px + dx, py + dy, r, 0, 6.3); c.fill(); }
    } else if (t === T.WATER) {
      c.fillStyle = (x + y) % 2 ? '#4290d0' : '#3b82c4'; c.fillRect(px, py, TS, TS);
      c.strokeStyle = '#ffffff44'; c.beginPath(); c.moveTo(px + 6, py + 10); c.quadraticCurveTo(px + 12, py + 6, px + 18, py + 10); c.stroke();
    } else if (t === T.FENCE) {
      c.fillStyle = '#6b7280'; c.fillRect(px, py + 14, TS, 3); for (let i = 0; i < 4; i++) c.fillRect(px + 3 + i * 8, py + 6, 2, 20);
    }
  }
  // bancs (POI)
  for (const p of W.pois) { c.fillStyle = '#7c4a21'; c.fillRect(p.x * TS + 4, p.y * TS + 12, 24, 7); c.fillStyle = '#a16207'; c.fillRect(p.x * TS + 4, p.y * TS + 9, 24, 3); }
  // bâtiments
  for (const b of W.buildings) drawBuildingRoof(c, b);
  R.ground = cv;
  // minicarte statique
  const m = document.createElement('canvas'); m.width = MAPW * 3; m.height = MAPH * 3; const mc = m.getContext('2d');
  for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
    const t = W.t[tIdx(x, y)]; mc.fillStyle = t === T.ROAD ? '#6b7280' : t === T.SIDE ? '#9ca3af' : t === T.WATER ? '#3b82c4' : t === T.TREE ? '#2f7d32' : t === T.BLD ? '#c9ccd4' : '#4f8a45';
    mc.fillRect(x * 3, y * 3, 3, 3);
  }
  for (const b of W.buildings) { mc.fillStyle = { house: '#a16d52', apt: '#9aa0ad', police: '#3b82f6', fire: '#ef4444', hospital: '#fff', prison: '#475569', bank: '#a3a3a3', fastfood: '#f43f5e', club: '#a855f7', biker: '#f97316', mafia: '#7c3aed', street: '#dc2626' }[b.kind] || '#d1d5db'; mc.fillRect(b.x * 3, b.y * 3, b.w * 3, b.h * 3); }
  R.mini = m;
}
function drawBuildingRoof(c, b) {
  const x = b.x * TS, y = b.y * TS, w = b.w * TS, h = b.h * TS;
  c.fillStyle = '#0004'; c.fillRect(x + 4, y + 6, w, h);
  c.fillStyle = b.col; c.fillRect(x, y, w, h);
  c.fillStyle = shade(b.col, 18); c.fillRect(x + 3, y + 3, w - 6, h * 0.45);
  c.fillStyle = shade(b.col, -22); c.fillRect(x + 3, y + h * 0.5, w - 6, h * 0.5 - 3);
  c.strokeStyle = shade(b.col, -50); c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  const k = b.kind;
  if (k === 'house') {
    c.strokeStyle = shade(b.col, -35); c.beginPath(); c.moveTo(x + 4, y + h / 2); c.lineTo(x + w - 4, y + h / 2); c.stroke();
    c.fillStyle = shade(b.col, -45); c.fillRect(x + w - 16, y + 6, 8, 12);
  } else if (k === 'apt' || k === 'office' || k === 'bank') {
    c.fillStyle = shade(b.col, -30); for (let i = 0; i < 3; i++) c.fillRect(x + 10 + i * 24, y + 10, 14, 10);
    c.fillStyle = shade(b.col, 30); c.fillRect(x + 10, y + h - 24, 16, 12);
  } else if (k === 'fastfood') {
    c.fillStyle = '#fbbf24'; for (let i = 0; i < w / 16; i++) { c.fillRect(x + i * 16, y + h - 14, 8, 8); }
  } else if (k === 'hospital') {
    c.fillStyle = '#ef4444'; c.fillRect(x + w / 2 - 6, y + 14, 12, 36); c.fillRect(x + w / 2 - 18, y + 26, 36, 12);
  } else if (k === 'prison') {
    c.fillStyle = '#3f3f46'; for (const [cx, cy] of [[0, 0], [w - 22, 0], [0, h - 22], [w - 22, h - 22]]) c.fillRect(x + cx, y + cy, 22, 22);
    c.strokeStyle = '#71717a'; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(x + 30 + i * 44, y + 8); c.lineTo(x + 30 + i * 44, y + h - 8); c.stroke(); }
  } else if (k === 'club') {
    const cols = ['#ec4899', '#22d3ee', '#a855f7']; for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; c.fillRect(x + 8, y + 8 + i * 8, w - 16, 3); }
  } else if (k === 'police') {
    c.fillStyle = '#93c5fd'; c.fillRect(x + w / 2 - 14, y + 12, 28, 6); c.fillStyle = '#fff'; c.fillRect(x + w / 2 - 14, y + 20, 28, 3);
  } else if (k === 'fire') {
    c.fillStyle = '#fef08a'; c.fillRect(x + 8, y + h / 2 - 3, w - 16, 6);
  } else if (k === 'gas') {
    c.fillStyle = '#facc15'; c.fillRect(x, y + h, w, 14); c.fillStyle = '#374151'; c.fillRect(x + 10, y + h + 2, 6, 10); c.fillRect(x + w - 16, y + h + 2, 6, 10);
  }
  // emoji + nom
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = '22px sans-serif'; if (k !== 'house') c.fillText(b.e, x + w / 2, y + h * 0.4);
  if (k !== 'house' && k !== 'apt') { c.font = 'bold 10px system-ui, sans-serif'; c.fillStyle = '#fff'; c.strokeStyle = '#0008'; c.lineWidth = 3; c.strokeText(b.name, x + w / 2, y + h * 0.7); c.fillText(b.name, x + w / 2, y + h * 0.7); }
  // porte + auvent
  const dx = b.door.x * TS, dy = b.door.y * TS;
  c.fillStyle = '#4b2e16'; c.fillRect(dx + 6, dy + (b.face === 'N' ? 0 : 6), 20, 26);
  c.fillStyle = '#fbbf24'; c.fillRect(dx + 21, dy + 14, 3, 3);
  c.fillStyle = '#0006'; c.fillRect(dx + 2, b.face === 'N' ? dy - 4 : dy + 28, 28, 4);
}

// ---------- personnages ----------
function pedLook(n) {
  const L = { skin: n.skin || '#e0ac82', hair: n.hair || '#222', shirt: n.col || '#888', pants: '#2b3445', hat: null };
  if (n.job && n.job !== 'none' && n.uniform !== false) {
    const J = JOBS[n.job];
    if (n.job === 'police') { L.shirt = '#1e3a8a'; L.pants = '#111827'; L.hat = '#0f172a'; }
    else if (n.job === 'fire') { L.shirt = '#b91c1c'; L.pants = '#1f2937'; L.hat = '#facc15'; }
    else if (n.job === 'ems') { L.shirt = '#10b981'; L.pants = '#064e3b'; }
    else if (n.job === 'guard') { L.shirt = '#334155'; L.pants = '#111827'; L.hat = '#1e293b'; }
    else if (n.job === 'fastfood') { L.shirt = '#dc2626'; L.hat = '#facc15'; }
    else if (n.job === 'banker') { L.shirt = '#cbd5e1'; L.pants = '#1e293b'; }
  }
  if (n.prisoner) { L.shirt = '#f97316'; L.pants = '#f97316'; }
  if (n.gang) { L.hat = null; L.bandana = GANGS[n.gang].col; }
  return L;
}
function drawPed(c, x, y, a, L, o) {
  o = o || {};
  c.save(); c.translate(x, y); c.scale(1.25, 1.25);
  c.fillStyle = '#0003'; c.beginPath(); c.ellipse(0, 4, 8, 5, 0, 0, 6.3); c.fill();
  if (o.lying) {
    c.rotate(0.3); c.fillStyle = L.shirt; c.fillRect(-9, -4, 14, 8); c.fillStyle = L.pants; c.fillRect(5, -3, 8, 6); c.fillStyle = L.skin; c.beginPath(); c.arc(-12, 0, 5, 0, 6.3); c.fill(); c.fillStyle = L.hair; c.beginPath(); c.arc(-13, 0, 4.5, 1.6, 4.7); c.fill();
    c.restore(); return;
  }
  c.rotate(a);
  const sw = o.moving ? Math.sin(o.step || 0) * 4 : 0;
  c.fillStyle = L.pants; c.fillRect(-3 + sw * 0.5, -5, 6, 4); c.fillRect(-3 - sw * 0.5, 1, 6, 4);
  c.fillStyle = L.shirt; c.beginPath(); c.ellipse(0, 0, 5.5, 8, 0, 0, 6.3); c.fill();
  c.fillStyle = L.skin;
  if (o.punch) { c.beginPath(); c.arc(11, 3, 3.5, 0, 6.3); c.fill(); c.beginPath(); c.arc(4, -6, 3, 0, 6.3); c.fill(); }
  else { c.beginPath(); c.arc(2 + sw * 0.4, -8, 2.8, 0, 6.3); c.fill(); c.beginPath(); c.arc(2 - sw * 0.4, 8, 2.8, 0, 6.3); c.fill(); }
  if (o.gun) { c.fillStyle = '#111827'; c.fillRect(6, 1, 9, 3); }
  c.fillStyle = L.skin; c.beginPath(); c.arc(1, 0, 5.6, 0, 6.3); c.fill();
  c.fillStyle = L.hair; c.beginPath(); c.arc(0, 0, 5.8, 1.1, 5.2); c.fill();
  if (L.hat) { c.fillStyle = L.hat; c.beginPath(); c.arc(0, 0, 6, 0, 6.3); c.fill(); c.fillRect(4, -4, 5, 8); }
  if (L.bandana) { c.fillStyle = L.bandana; c.fillRect(-1, -6, 3, 12); }
  if (o.cuffed) { c.fillStyle = '#9ca3af'; c.fillRect(-7, -3, 3, 6); }
  c.restore();
}
function drawVeh(c, v) {
  const T0 = VEH[v.type];
  c.save(); c.translate(v.x, v.y); c.rotate(v.a);
  const w = T0.w, h = T0.h;
  c.fillStyle = '#0004'; c.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  if (T0.moto) {
    c.fillStyle = '#111'; c.fillRect(-w / 2, -2, w, 4);
    c.fillStyle = v.col; c.fillRect(-w / 4, -4, w / 2, 8); c.fillStyle = '#e5e7eb'; c.fillRect(w / 2 - 5, -5, 3, 10);
    if (v.driver) { c.fillStyle = '#374151'; c.beginPath(); c.arc(-1, 0, 5, 0, 6.3); c.fill(); c.fillStyle = '#f1c9a5'; c.beginPath(); c.arc(1, 0, 3, 0, 6.3); c.fill(); }
    c.restore(); return;
  }
  const body = v.hp < 30 ? shade(v.col, -50) : v.col;
  c.fillStyle = body; c.beginPath(); c.roundRect(-w / 2, -h / 2, w, h, 5); c.fill();
  c.fillStyle = '#0002'; c.fillRect(-w / 2, -h / 2, w, 2); c.fillRect(-w / 2, h / 2 - 2, w, 2);
  c.fillStyle = '#9fd3f5'; c.fillRect(w * 0.12, -h / 2 + 3, w * 0.2, h - 6); c.fillRect(-w * 0.38, -h / 2 + 3, w * 0.14, h - 6);
  c.fillStyle = shade(body, 25); c.fillRect(-w * 0.2, -h / 2 + 3, w * 0.3, h - 6);
  c.fillStyle = '#fef3c7'; c.fillRect(w / 2 - 3, -h / 2 + 2, 3, 4); c.fillRect(w / 2 - 3, h / 2 - 6, 3, 4);
  c.fillStyle = (v.brake || v.thr < 0) ? '#ff2a2a' : '#7f1d1d'; c.fillRect(-w / 2, -h / 2 + 2, 2, 4); c.fillRect(-w / 2, h / 2 - 6, 2, 4);
  if (v.type === 'police' || v.type === 'taxi') { c.fillStyle = v.type === 'police' ? '#1e3a8a' : '#111'; if (v.type === 'police') { c.fillRect(-w * 0.1, -h / 2, w * 0.2, h); } else { c.fillStyle = '#111827'; c.fillRect(-4, -4, 8, 8); } }
  if (v.type === 'fire') { c.fillStyle = '#f8fafc'; c.fillRect(-w * 0.4, -2, w * 0.7, 4); c.fillStyle = '#facc15'; c.fillRect(-w / 2 + 2, -h / 2 + 1, w - 4, 2); }
  if (v.type === 'ambu') { c.fillStyle = '#ef4444'; c.fillRect(-4, -2, 8, 4); c.fillRect(-2, -4, 4, 8); }
  if (v.siren) {
    const ph = Math.floor(R.t * 8) % 2;
    c.fillStyle = ph ? '#ef4444' : '#3b82f6'; c.fillRect(-3, -h / 2 + 2, 6, 5); c.fillStyle = ph ? '#3b82f6' : '#ef4444'; c.fillRect(-3, h / 2 - 7, 6, 5);
    c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(0, 0, 2, 0, 0, 55); g.addColorStop(0, ph ? 'rgba(255,40,40,.45)' : 'rgba(60,100,255,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 55, 0, 6.3); c.fill(); c.globalCompositeOperation = 'source-over';
  }
  if (v.hp < 35) { c.fillStyle = '#4b5563aa'; c.beginPath(); c.arc(w / 4, 0, 6 + Math.random() * 3, 0, 6.3); c.fill(); }
  if (v.target) { c.strokeStyle = '#fde047'; c.lineWidth = 2; c.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
  c.restore();
}
function bubble(c, x, y, text) {
  c.font = '11px system-ui, sans-serif'; const w = Math.min(190, c.measureText(text).width + 12);
  c.fillStyle = '#fffffff0'; c.beginPath(); c.roundRect(x - w / 2, y - 30, w, 20, 8); c.fill();
  c.fillStyle = '#111'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text.length > 34 ? text.slice(0, 33) + '…' : text, x, y - 20);
}
function drawMarker(c, x, y, emoji, col, t) {
  c.save(); c.translate(x, y - 38 + Math.sin(t * 4) * 3);
  c.fillStyle = col || '#facc15'; c.beginPath(); c.moveTo(0, 14); c.lineTo(-8, 2); c.lineTo(8, 2); c.closePath(); c.fill();
  c.beginPath(); c.arc(0, -4, 11, 0, 6.3); c.fillStyle = '#000b'; c.fill(); c.lineWidth = 2; c.strokeStyle = col || '#facc15'; c.stroke();
  c.font = '13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.fillText(emoji, 0, -4);
  c.restore();
}

// ---------- scène ----------
function render() {
  const c = R.ctx, Z = R.Z * R.dpr; R.t += 1 / 60;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#0b0f1a'; c.fillRect(0, 0, R.cv.width, R.cv.height);
  if (!P || !G.started) return;
  const out = G.scene === 'out';
  const vv = Player.inVeh();
  R.vz = (R.vz || 0) + ((vv ? Math.min(0.22, Math.abs(vv.v) / 1700) : 0) - (R.vz || 0)) * 0.05;
  const zoom = Z * (out ? 1 - R.vz : 1.0);
  const vw = R.cv.width / zoom, vh = R.cv.height / zoom;
  const veh = Player.inVeh();
  let tx = P.x, ty = P.y;
  if (veh) { tx += Math.cos(veh.a) * veh.v * 0.18; ty += Math.sin(veh.a) * veh.v * 0.18; }
  if (!out) { const S = Interior.S; const ww = S.w * TS, hh = S.h * TS; if (vw >= ww) tx = ww / 2; else tx = clamp(tx, vw / 2, ww - vw / 2); if (vh >= hh) ty = hh / 2; else ty = clamp(ty, vh / 2, hh - vh / 2); }
  else { tx = clamp(tx, vw / 2, MAPW * TS - vw / 2); ty = clamp(ty, vh / 2, MAPH * TS - vh / 2); }
  R.cam.x += (tx - R.cam.x) * 0.2; R.cam.y += (ty - R.cam.y) * 0.2;
  if (Math.abs(R.cam.x - tx) > 400 || Math.abs(R.cam.y - ty) > 400) { R.cam.x = tx; R.cam.y = ty; }
  const camx = R.cam.x - vw / 2, camy = R.cam.y - vh / 2;
  let sx = 0, sy = 0; if (veh && veh.crash > 0) { sx = rand(-4, 4); sy = rand(-4, 4); }
  c.setTransform(zoom, 0, 0, zoom, (-camx + sx) * zoom, (-camy + sy) * zoom);
  R.view = { x0: camx, y0: camy, x1: camx + vw, y1: camy + vh };
  if (out) renderOutdoor(c); else renderIndoor(c);
  // flash d'alcool
  if (P.alc > 45) { c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(120,60,200,${Math.min(0.25, (P.alc - 45) / 250)})`; c.fillRect(0, 0, R.cv.width, R.cv.height); }
  if (P.hp < 30) { c.setTransform(1, 0, 0, 1, 0, 0); const g = c.createRadialGradient(R.cv.width / 2, R.cv.height / 2, R.cv.height * 0.3, R.cv.width / 2, R.cv.height / 2, R.cv.height * 0.8); g.addColorStop(0, 'rgba(180,0,0,0)'); g.addColorStop(1, `rgba(180,0,0,${0.4 + Math.sin(R.t * 6) * 0.1})`); c.fillStyle = g; c.fillRect(0, 0, R.cv.width, R.cv.height); }
  drawMini();
}
function inView(x, y, m) { const v = R.view; return x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m; }

function renderOutdoor(c) {
  const v = R.view;
  c.drawImage(R.ground, 0, 0);
  // incendies sur les toits
  for (const inc of G.incidents) if (inc.type === 'fire' && !inc.done) {
    const b = W.buildings[inc.bid]; if (!inRect(b, v)) continue;
    for (let i = 0; i < 9; i++) {
      const fx = (b.x + 0.7 + (i * 1.37 % (b.w - 1.4))) * TS, fy = (b.y + 0.7 + (i * 2.11 % (b.h - 1.4))) * TS;
      const s = (0.6 + 0.4 * Math.sin(R.t * 9 + i * 2)) * (inc.hp / 90 + 0.4);
      const g = c.createRadialGradient(fx, fy, 1, fx, fy, 22 * s); g.addColorStop(0, 'rgba(255,240,140,.95)'); g.addColorStop(0.4, 'rgba(255,120,20,.75)'); g.addColorStop(1, 'rgba(255,40,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(fx, fy, 22 * s, 0, 6.3); c.fill();
    }
    c.font = '26px sans-serif'; c.textAlign = 'center'; c.fillText('🔥', (b.x + b.w / 2) * TS, (b.y + b.h / 2) * TS - 4 + Math.sin(R.t * 8) * 2);
  }
  // PNJ
  for (const n of G.npcs) {
    if (n.loc !== 'out' || n.state === 'dead' || !inView(n.x, n.y, 40)) continue;
    const L = pedLook(n);
    const lying = n.state === 'down';
    drawPed(c, n.x, n.y, n.a, L, { moving: n.state === 'walk' || n.state === 'flee' || n.chase, step: n.step, lying, cuffed: n.cuffed, punch: n.punch > 0 || n.state === 'fight' && Math.sin(R.t * 10) > 0.6 });
    if (n.say) { n.say.t -= 1 / 60; if (n.say.t <= 0) n.say = null; else bubble(c, n.x, n.y, n.say.text); }
    if (n.state === 'fight') { c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('💢', n.x, n.y - 14); }
    if (lying) { c.font = '13px sans-serif'; c.textAlign = 'center'; c.fillText('➕', n.x, n.y - 12 + Math.sin(R.t * 5) * 2); }
    if (n.crimFlag) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText('❗', n.x, n.y - 14); }
  }
  // véhicules
  for (const vh of G.vehicles) if (inView(vh.x, vh.y, 60)) drawVeh(c, vh);
  // joueur
  if (!P.veh) drawPed(c, P.x, P.y, P.a, playerLook(), { moving: Input.vec().m > 0.05, step: P.step, punch: P.punch > 0, gun: P.weapon === 'pistol', cuffed: P.cuffed });
  // balles
  c.fillStyle = '#fde047'; for (const b of Combat.bullets) { c.fillRect(b.x - 2, b.y - 2, 4, 4); }
  // marqueurs
  for (const inc of G.incidents) if (!inc.done && inView(inc.x, inc.y, 50)) drawMarker(c, inc.x, inc.y, { fire: '🔥', medical: '🚑', robbery: '🚨', fight: '👊' }[inc.type], '#f87171', R.t);
  if (P.mission && P.mission.type === 'deal' && P.mission.stage === 1) for (const s of P.mission.data.spots) if (!s.done) { drawMarker(c, s.x, s.y, '📦', '#a78bfa', R.t); drawPed(c, s.x + 10, s.y, 3.14, { skin: '#c68642', hair: '#111', shirt: '#334155', pants: '#111' }, {}); }
  if (P.wp && inView(P.wp.x, P.wp.y, 50)) drawMarker(c, P.wp.x, P.wp.y, '📍', '#fde047', R.t);
  // nuit
  const h = minOfDay() / 60;
  let dark = 0; if (h >= 21 || h < 5) dark = 0.55; else if (h >= 19) dark = (h - 19) / 2 * 0.55; else if (h < 7) dark = (7 - h) / 2 * 0.55;
  if (dark > 0.02) {
    c.fillStyle = `rgba(6,10,38,${dark})`; c.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    c.globalCompositeOperation = 'lighter';
    for (const b of W.buildings) {
      if (!inRect(b, v, 60)) continue;
      const col = { club: [236, 72, 153], bar: [251, 146, 60], fastfood: [250, 204, 21], restaurant: [253, 186, 116], store: [94, 234, 212], gas: [250, 204, 21], police: [96, 165, 250], mafia: [167, 139, 250], hospital: [248, 113, 113], biker: [249, 115, 22] }[b.kind];
      if (!col) continue; const f = frontPx(b);
      const g = c.createRadialGradient(f.x, f.y, 4, f.x, f.y, 90); g.addColorStop(0, `rgba(${col},${dark * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, 90, 0, 6.3); c.fill();
    }
    for (const vh of G.vehicles) if (vh.driver && inView(vh.x, vh.y, 100)) {
      const fx = vh.x + Math.cos(vh.a) * 60, fy = vh.y + Math.sin(vh.a) * 60; const g = c.createRadialGradient(fx, fy, 4, fx, fy, 70); g.addColorStop(0, `rgba(255,240,180,${dark * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(fx, fy, 70, 0, 6.3); c.fill();
    }
    // lumière autour du joueur
    const g = c.createRadialGradient(P.x, P.y, 4, P.x, P.y, 110); g.addColorStop(0, `rgba(255,235,200,${dark * 0.4})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(P.x, P.y, 110, 0, 6.3); c.fill();
    c.globalCompositeOperation = 'source-over';
  }
}
function inRect(b, v, m) { m = m || 0; return b.x * TS < v.x1 + m && (b.x + b.w) * TS > v.x0 - m && b.y * TS < v.y1 + m && (b.y + b.h) * TS > v.y0 - m; }
function playerLook() {
  const L = { skin: P.g ? '#f1c9a5' : '#e0ac82', hair: '#2b1d14', shirt: P.col, pants: '#2b3445', hat: null };
  if (P.jail) { L.shirt = '#f97316'; L.pants = '#f97316'; }
  else if (P.uniform && P.job !== 'none') { const l = pedLook({ job: P.job, col: P.col }); Object.assign(L, { shirt: l.shirt, pants: l.pants, hat: l.hat }); }
  else if (P.gang) L.bandana = GANGS[P.gang].col;
  if (P.masked) L.hat = '#111';
  return L;
}

function renderIndoor(c) {
  const S = Interior.S, b = Interior.b;
  c.fillStyle = '#111827'; c.fillRect(R.view.x0, R.view.y0, R.view.x1 - R.view.x0, R.view.y1 - R.view.y0);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const i = y * S.w + x;
    if (S.wall[i]) { c.fillStyle = '#2f3441'; c.fillRect(x * TS, y * TS, TS, TS); c.fillStyle = '#434a5a'; c.fillRect(x * TS, y * TS, TS, TS - 8); c.fillStyle = '#1f2330'; c.fillRect(x * TS, y * TS + TS - 8, TS, 8); continue; }
    c.fillStyle = FLOORCOL[S.floor[i]]; c.fillRect(x * TS, y * TS, TS, TS);
    c.strokeStyle = '#0000001a'; c.strokeRect(x * TS + 0.5, y * TS + 0.5, TS - 1, TS - 1);
  }
  // porte
  c.fillStyle = '#7c4a21'; c.fillRect(S.door.x * TS + 4, S.door.y * TS + 6, TS - 8, TS - 6); c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText('SORTIE', (S.door.x + 0.5) * TS, (S.door.y + 0.5) * TS - 6);
  // meubles
  for (const f of S.furn) {
    const x = f.x * TS, y = f.y * TS, w = f.w * TS, h = f.h * TS;
    if (f.dance) { const ph = Math.floor(R.t * 4) % 3; c.fillStyle = ['#ec489966', '#22d3ee66', '#a855f766'][ph]; c.fillRect(x, y, w, h); for (let i = 0; i < 6; i++) { c.fillStyle = ['#ec4899', '#22d3ee', '#a855f7', '#facc15'][(i + ph) % 4] + '88'; c.fillRect(x + (i * 37 % w), y + (i * 23 % h), 12, 12); } continue; }
    c.fillStyle = '#0003'; c.fillRect(x + 2, y + 3, w, h);
    if (f.t === 'cp') { c.font = '18px sans-serif'; c.fillText(f.e, x + w / 2, y + h / 2 + 4); continue; }
    c.fillStyle = f.col; if (f.r) { c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h - 4, 10); c.fill(); } else c.fillRect(x, y, w, h);
    c.fillStyle = '#ffffff22'; c.fillRect(x, y, w, 4);
    if (f.e) { c.font = Math.min(26, Math.min(w, h) * 0.8 + 6) + 'px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; const n = f.w > f.h ? Math.min(Math.floor(f.w / 1.2), 4) : 1; for (let i = 0; i < n; i++) c.fillText(f.e, x + (w / n) * (i + 0.5), y + h / 2 + 1); }
  }
  // prisonniers/autres personnes
  const arr = Interior.list.slice().sort((a, b2) => a.y - b2.y);
  for (const e of arr) {
    const L = pedLook(Object.assign({}, e.n, { prisoner: e.prisoner })); if (e.n.ghost) { L.shirt = e.n.col; L.skin = e.n.skin; L.hair = e.n.hair; }
    const staffUniform = e.role === 'staff' || e.n.job !== 'none';
    drawPed(c, e.x, e.y, e.a, L, { moving: e.moving, step: e.step, lying: e.sleep, cuffed: e.n.cuffed, punch: e.fight && Math.sin(R.t * 10) > 0.5 });
    if (e.fight) { c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText('⚔️', e.x, e.y - 14); }
    if (e.ticket) { c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#fff'; const t = e.ticket; c.fillText(t.items.map((k) => ITEMS[k].e).join(''), e.x, e.y - 14); }
    if (e.req) { c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillText(e.req.type === 'loan' ? '💶' : '🏦', e.x, e.y - 14); }
    if (e.n.say) { e.n.say.t -= 1 / 60; if (e.n.say.t <= 0) e.n.say = null; else bubble(c, e.x, e.y, e.n.say.text); }
  }
  if (!P.veh) drawPed(c, P.x, P.y, P.a, playerLook(), { moving: Input.vec().m > 0.05, step: P.step, punch: P.punch > 0, gun: P.weapon === 'pistol' });
  c.fillStyle = '#fde047'; for (const bl of Combat.bullets) c.fillRect(bl.x - 2, bl.y - 2, 4, 4);
  // ambiance
  if (b.kind === 'club') { c.fillStyle = 'rgba(20,0,40,.35)'; c.fillRect(0, 0, S.w * TS, S.h * TS); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const px = (S.w * TS) * (0.5 + 0.4 * Math.sin(R.t * 1.3 + i * 1.6)), py = (S.h * TS) * (0.5 + 0.35 * Math.cos(R.t * 1.1 + i * 2.1)); const g = c.createRadialGradient(px, py, 5, px, py, 110); const col = [[255, 40, 150], [40, 220, 255], [170, 80, 255], [250, 200, 40]][i]; g.addColorStop(0, `rgba(${col},.4)`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 110, 0, 6.3); c.fill(); } c.globalCompositeOperation = 'source-over'; }
  if (b.kind === 'bar' || b.kind === 'mafia' || b.kind === 'biker') { c.fillStyle = 'rgba(30,10,0,.22)'; c.fillRect(0, 0, S.w * TS, S.h * TS); }
  if (b.kind === 'prison' && (hourOf() >= 21 || hourOf() < 6)) { c.fillStyle = 'rgba(0,0,20,.45)'; c.fillRect(0, 0, S.w * TS, S.h * TS); }
  c.font = 'bold 13px system-ui, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff8'; c.fillText(b.e + ' ' + b.name, 8, -6 + 0);
}
function drawMini() {
  const mc = $('mini').getContext('2d'); mc.clearRect(0, 0, 150, 120);
  if (G.scene !== 'out') {
    mc.fillStyle = '#111827'; mc.fillRect(0, 0, 150, 120); const b = Interior.b; const S = Interior.S;
    const sc = Math.min(140 / S.w, 108 / S.h); const ox = (150 - S.w * sc) / 2, oy = (120 - S.h * sc) / 2;
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) { mc.fillStyle = S.wall[y * S.w + x] ? '#475569' : '#94a3b8'; mc.fillRect(ox + x * sc, oy + y * sc, sc + 0.5, sc + 0.5); }
    for (const f of S.furn) { mc.fillStyle = f.act ? '#fbbf24' : '#64748b'; mc.fillRect(ox + f.x * sc, oy + f.y * sc, f.w * sc, f.h * sc); }
    mc.fillStyle = '#fff'; mc.beginPath(); mc.arc(ox + P.x / TS * sc, oy + P.y / TS * sc, 3, 0, 6.3); mc.fill();
    return;
  }
  const px = P.x / TS, py = P.y / TS; const vw = 50, vh = 40;
  let sx = clamp(px - vw / 2, 0, MAPW - vw), sy = clamp(py - vh / 2, 0, MAPH - vh);
  mc.drawImage(R.mini, sx * 3, sy * 3, vw * 3, vh * 3, 0, 0, 150, 120);
  const mp = (x, y) => [(x / TS - sx) * 3, (y / TS - sy) * 3];
  const dot = (x, y, col, r) => { const [a, b] = mp(x, y); if (a < 0 || b < 0 || a > 150 || b > 120) return false; mc.fillStyle = col; mc.beginPath(); mc.arc(a, b, r, 0, 6.3); mc.fill(); return true; };
  for (const v of G.vehicles) if (v.owner === 'cop') dot(v.x, v.y, Math.floor(R.t * 5) % 2 ? '#ef4444' : '#3b82f6', 3);
  for (const id of P.ownV || []) { const v = Veh.byId(id); if (v && v.id !== P.veh) dot(v.x, v.y, '#38bdf8', 2); }
  for (const inc of G.incidents) if (!inc.done) dot(inc.x, inc.y, '#f87171', 3.5);
  if (P.wp) { const [a, b] = mp(P.wp.x, P.wp.y); if (!dot(P.wp.x, P.wp.y, '#fde047', 4)) { const ang = Math.atan2(P.wp.y - P.y, P.wp.x - P.x); const ex = clamp(75 + Math.cos(ang) * 70, 6, 144), ey = clamp(60 + Math.sin(ang) * 55, 6, 114); mc.save(); mc.translate(ex, ey); mc.rotate(ang); mc.fillStyle = '#fde047'; mc.beginPath(); mc.moveTo(6, 0); mc.lineTo(-5, 5); mc.lineTo(-5, -5); mc.closePath(); mc.fill(); mc.restore(); } }
  const [a, b] = mp(P.x, P.y); mc.save(); mc.translate(a, b); mc.rotate(P.a); mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(5, 0); mc.lineTo(-4, 4); mc.lineTo(-4, -4); mc.closePath(); mc.fill(); mc.restore();
}
RP.snapshot = function () {
  try {
    const o = document.createElement('canvas'); o.width = 320; o.height = 240; const c = o.getContext('2d');
    const cw = R.cv.width, ch = R.cv.height; const tw = Math.min(cw, ch * 4 / 3), th = tw * 3 / 4;
    c.drawImage(R.cv, (cw - tw) / 2, (ch - th) / 2, tw, th, 0, 0, 320, 240);
    return o.toDataURL('image/jpeg', 0.6);
  } catch (e) { return null; }
};
