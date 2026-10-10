'use strict';
// ===== Génération de la ville + intérieurs =====
const MAPW = 88, MAPH = 70;
const T = { GRASS: 0, ROAD: 1, SIDE: 2, BLD: 3, WATER: 4, TREE: 5, FENCE: 6 };
const W = {
  w: MAPW, h: MAPH, t: new Uint8Array(MAPW * MAPH), rd: new Uint8Array(MAPW * MAPH), bi: new Int16Array(MAPW * MAPH).fill(-1),
  buildings: [], pois: [], vx: [19, 43, 67], hy: [17, 35, 53],
};
const BLOCKX = [[2, 17], [21, 41], [45, 65], [69, 85]];
const BLOCKY = [[2, 15], [19, 33], [37, 51], [55, 67]];
const LAYOUT = [
  ['prison', { top: ['house', 'house'], bot: ['house', 'gas'] }, { top: ['house', 'house'], bot: ['apt'] }, { top: ['house', 'house'], bot: ['house', 'house'] }],
  [{ top: ['police', 'house'], bot: ['fire', 'store'] }, { top: ['bank', 'restaurant'], bot: ['fastfood', 'bar'] }, { top: ['hospital', 'house'], bot: ['gas', 'dealer'] }, { top: ['apt', 'apt'], bot: ['house', 'house'] }],
  [{ top: ['club', 'bar'], bot: ['restaurant', 'fastfood'] }, { top: ['biker', 'mafia'], bot: ['office', 'store'] }, 'park', { top: ['house', 'house'], bot: ['street', 'house'] }],
  [{ top: ['house', 'house'], bot: ['store', 'house'] }, { top: ['apt', 'house'], bot: ['store', 'house'] }, { top: ['house', 'house'], bot: ['house', 'house'] }, { top: ['house', 'house'], bot: ['gas', 'house'] }],
];
const BUILD_SOLID = (t) => t === T.BLD || t === T.WATER || t === T.TREE || t === T.FENCE;
const tIdx = (x, y) => y * MAPW + x;
function tileAt(x, y) { return x < 0 || y < 0 || x >= MAPW || y >= MAPH ? T.TREE : W.t[tIdx(x, y)]; }

function generateWorld() {
  const rnd = mulberry(20240611);
  const t = W.t, rd = W.rd;
  W.buildings.length = 0; W.pois.length = 0; t.fill(T.GRASS); rd.fill(0); W.bi.fill(-1);
  for (const cx of W.vx) for (let y = 0; y < MAPH; y++) for (let x = cx - 1; x <= cx + 1; x++) { t[tIdx(x, y)] = T.ROAD; rd[tIdx(x, y)] |= 1; }
  for (const cy of W.hy) for (let x = 0; x < MAPW; x++) for (let y = cy - 1; y <= cy + 1; y++) { t[tIdx(x, y)] = T.ROAD; rd[tIdx(x, y)] |= 2; }
  BLOCKX.forEach(([x0, x1]) => BLOCKY.forEach(([y0, y1]) => {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      if (x === x0 || x === x1 || y === y0 || y === y1) t[tIdx(x, y)] = T.SIDE;
    }
  }));
  for (let x = 0; x < MAPW; x++) for (let y = 0; y < MAPH; y++) {
    if ((x < 2 || x > MAPW - 3 || y < 2 || y > MAPH - 3) && t[tIdx(x, y)] === T.GRASS) t[tIdx(x, y)] = rnd() < 0.7 ? T.TREE : T.GRASS;
  }
  const place = (kind, bx, by) => {
    const k = BKINDS[kind];
    const id = W.buildings.length;
    const b = { id, kind, name: k.n, x: bx, y: by, w: k.w, h: k.h, col: k.col, e: k.e, door: null, front: null, face: 'N' };
    for (let y = by; y < by + k.h; y++) for (let x = bx; x < bx + k.w; x++) { t[tIdx(x, y)] = T.BLD; W.bi[tIdx(x, y)] = id; }
    W.buildings.push(b);
    return b;
  };
  const packRow = (ix0, ix1, y0, y1, face, kinds) => {
    const avail = ix1 - ix0 + 1;
    const sumw = kinds.reduce((s, k) => s + BKINDS[k].w, 0);
    let gap = 1;
    if (sumw + kinds.length * 2 - 2 <= avail) gap = 2;
    const total = sumw + (kinds.length - 1) * gap;
    let x = ix0 + Math.max(0, Math.floor((avail - total) / 2));
    for (const kind of kinds) {
      const k = BKINDS[kind];
      const by = face === 'N' ? y0 : y1 - k.h + 1;
      const b = place(kind, x, by);
      b.face = face;
      b.door = { x: x + Math.floor(k.w / 2), y: face === 'N' ? by : by + k.h - 1 };
      b.front = { x: b.door.x, y: face === 'N' ? by - 1 : by + k.h };
      x += k.w + gap;
    }
  };
  BLOCKX.forEach(([x0, x1], c) => BLOCKY.forEach(([y0, y1], r) => {
    const L = LAYOUT[c][r];
    const ix0 = x0 + 1, ix1 = x1 - 1, iy0 = y0 + 1, iy1 = y1 - 1;
    if (L === 'park') {
      const cx = (ix0 + ix1) / 2, cy = (iy0 + iy1) / 2;
      for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
        const d = Math.hypot((x - cx) / 6, (y - cy) / 4);
        if (d < 1) t[tIdx(x, y)] = T.WATER;
        else if (rnd() < 0.12 && Math.hypot(x - cx, y - cy) > 8) t[tIdx(x, y)] = T.TREE;
      }
      [[ix0 + 2, iy0 + 1], [ix1 - 2, iy0 + 1], [ix0 + 2, iy1 - 1], [ix1 - 2, iy1 - 1], [Math.round(cx), iy0 + 1], [Math.round(cx), iy1 - 1]].forEach(([x, y]) => {
        if (t[tIdx(x, y)] === T.TREE) t[tIdx(x, y)] = T.GRASS;
        W.pois.push({ id: 'p' + W.pois.length, kind: 'park', name: 'Parc', front: { x, y }, x, y });
      });
      return;
    }
    if (L === 'prison') {
      const b = place('prison', ix0 + 1, iy1 - 8);
      b.face = 'S'; b.door = { x: b.x + 6, y: iy1 }; b.front = { x: b.door.x, y: iy1 + 1 };
      for (let y = iy0; y <= iy1; y++) { t[tIdx(ix0, y)] = T.FENCE; t[tIdx(ix1, y)] = T.FENCE; }
      for (let x = ix0; x <= ix1; x++) t[tIdx(x, iy0)] = T.FENCE;
      return;
    }
    packRow(ix0, ix1, iy0, iy1, 'N', L.top);
    packRow(ix0, ix1, iy0, iy1, 'S', L.bot);
    for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) {
      if (t[tIdx(x, y)] !== T.GRASS || rnd() > 0.1) continue;
      let ok = true;
      for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { const tt = tileAt(x + dx, y + dy); if (tt === T.BLD || tt === T.SIDE) { ok = false; break; } }
      if (ok) t[tIdx(x, y)] = T.TREE;
    }
  }));
  BLOCKX.forEach(([x0, x1]) => BLOCKY.forEach(([y0, y1]) => {
    for (const [x, y] of [[x0 + 3, y0], [x1 - 3, y0], [x0 + 3, y1], [x1 - 3, y1], [x0, y0 + 3], [x1, y1 - 3], [x0 + Math.floor((x1 - x0) / 2), y0], [x0 + Math.floor((x1 - x0) / 2), y1]]) {
      if (tileAt(x, y) === T.SIDE) W.pois.push({ id: 'p' + W.pois.length, kind: 'walk', name: 'Trottoir', front: { x, y }, x, y });
    }
  }));
  for (const b of W.buildings) if (b.kind === 'house' && b.id % 5 === 0) {
    const x = b.front.x + 2, y = b.front.y;
    if (tileAt(x, y) === T.SIDE) W.pois.push({ id: 'p' + W.pois.length, kind: 'walk', name: 'Trottoir', front: { x, y }, x, y });
  }
  W.byKind = {};
  for (const b of W.buildings) (W.byKind[b.kind] = W.byKind[b.kind] || []).push(b);
}
const bOf = (id) => W.buildings[id];
function nearestOfKind(kind, p) {
  let best = null, bd = 1e9;
  for (const b of W.byKind[kind] || []) { const d = Math.hypot((b.front.x + 0.5) * TS - p.x, (b.front.y + 0.5) * TS - p.y); if (d < bd) { bd = d; best = b; } }
  return best;
}
function frontPx(b) { return { x: (b.front.x + 0.5) * TS, y: (b.front.y + 0.5) * TS }; }

// ---------- Intérieurs ----------
const FLOORCOL = ['#a07850', '#cfd4dc', '#6b4a74', '#2b2d36', '#8c8f96', '#5a8f4a', '#5c4a1e', '#3a2f55'];
function newScene(w, h, floor) {
  const S = { w, h, floor: new Uint8Array(w * h).fill(floor || 0), wall: new Uint8Array(w * h), furn: [], staff: [], cust: [], door: { x: Math.floor(w / 2), y: h - 1 }, extra: {} };
  for (let x = 0; x < w; x++) { S.wall[x] = 1; S.wall[(h - 1) * w + x] = 1; }
  for (let y = 0; y < h; y++) { S.wall[y * w] = 1; S.wall[y * w + w - 1] = 1; }
  S.wall[S.door.y * w + S.door.x] = 0;
  return S;
}
function fz(S, t, x, y, w, h, e, col, o) {
  const f = Object.assign({ t, x, y, w, h, e: e || '', col: col || '#6b7280', solid: true }, o || {});
  S.furn.push(f); return f;
}
function wallRect(S, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.wall[y * S.w + x] = 1; }
function floorRect(S, x0, y0, x1, y1, f) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) S.floor[y * S.w + x] = f; }
const sp = (list, x, y) => list.push({ x, y });

const INT = {};
INT.house = () => {
  const S = newScene(12, 9, 0);
  floorRect(S, 8, 1, 10, 3, 1); floorRect(S, 9, 5, 10, 7, 1);
  fz(S, 'bed', 1, 1, 2, 3, '🛏️', '#7c3aed', { act: 'sleep', label: 'Dormir / se reposer' });
  fz(S, 'wardrobe', 4, 1, 2, 1, '👕', '#92400e', { act: 'wardrobe', label: 'Se changer' });
  fz(S, 'fridge', 8, 1, 1, 1, '🧊', '#9ca3af', { act: 'fridge', label: 'Frigo' });
  fz(S, 'stove', 9, 1, 2, 1, '🍳', '#4b5563');
  fz(S, 'table', 8, 3, 2, 2, '🍽️', '#a16207', { r: 1 });
  fz(S, 'sofa', 3, 5, 3, 1, '🛋️', '#1e40af', { act: 'sofa', label: 'Se détendre' });
  fz(S, 'tv', 3, 7, 3, 1, '📺', '#111827', { act: 'tv', label: 'Regarder la télé' });
  fz(S, 'pc', 1, 5, 1, 2, '💻', '#334155', { act: 'pc', label: 'Ordinateur' });
  fz(S, 'shower', 10, 5, 1, 2, '🚿', '#38bdf8', { act: 'shower', label: 'Prendre une douche' });
  fz(S, 'stash', 10, 7, 1, 1, '🧰', '#78350f', { act: 'stash', label: 'Coffre / cachette' });
  fz(S, 'plant', 6, 7, 1, 1, '🪴', '#15803d', { solid: false });
  for (const [x, y] of [[5, 3], [7, 6], [3, 3], [6, 5]]) sp(S.cust, x, y);
  return S;
};
INT.apt = INT.house;
INT.fastfood = () => {
  const S = newScene(16, 10, 1);
  floorRect(S, 1, 5, 14, 8, 0); floorRect(S, 1, 1, 14, 3, 1);
  fz(S, 'counter', 3, 4, 9, 1, '🧾', '#b91c1c', { act: 'ff_counter', label: 'Comptoir' });
  fz(S, 'grill', 3, 1, 2, 1, '🍔', '#4b5563', { act: 'ff_grill', label: 'Gril' });
  fz(S, 'fryer', 6, 1, 2, 1, '🍟', '#f59e0b', { act: 'ff_fryer', label: 'Friteuse' });
  fz(S, 'drinks', 9, 1, 2, 1, '🥤', '#0ea5e9', { act: 'ff_drink', label: 'Boissons' });
  fz(S, 'locker', 13, 1, 1, 2, '🗄️', '#64748b', { act: 'locker', label: 'Casier (service)' });
  fz(S, 'desk', 1, 1, 1, 2, '🗂️', '#92400e', { act: 'manager', label: 'Bureau du gérant' });
  for (const [x, y] of [[2, 6], [6, 7], [10, 7], [13, 6]]) fz(S, 'table', x, y, 2, 1, '🍽️', '#fde68a', { r: 1 });
  sp(S.staff, 4, 3); sp(S.staff, 7, 3); sp(S.staff, 10, 3); sp(S.staff, 12, 2);
  for (const [x, y] of [[6, 5], [8, 5], [7, 6], [3, 7], [7, 8], [11, 8], [14, 7]]) sp(S.cust, x, y);
  S.extra.queue = [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 6, y: 5 }];
  return S;
};
INT.restaurant = () => {
  const S = newScene(14, 10, 0);
  floorRect(S, 1, 1, 12, 2, 1);
  fz(S, 'counter', 3, 3, 7, 1, '🍷', '#7c2d12', { act: 'menu', label: 'Commander un plat' });
  fz(S, 'kitchen', 3, 1, 6, 1, '🍳', '#4b5563');
  fz(S, 'locker', 11, 1, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  const tabs = [[2, 5], [6, 5], [10, 5], [2, 8], [6, 8], [10, 8]];
  tabs.forEach(([x, y], i) => fz(S, 'table', x, y, 2, 1, '🕯️', '#fde68a', { r: 1, act: 'sit', label: 'S\'asseoir à table', n: i }));
  sp(S.staff, 4, 2); sp(S.staff, 7, 2); sp(S.staff, 6, 4);
  for (const [x, y] of tabs) { sp(S.cust, x, y - 1); sp(S.cust, x - 1, y); }
  return S;
};
INT.bar = () => {
  const S = newScene(14, 9, 3);
  fz(S, 'counter', 3, 2, 8, 1, '🍺', '#78350f', { act: 'bar_order', label: 'Commander au bar' });
  for (let x = 3; x < 11; x += 2) fz(S, 'stool', x, 3, 1, 1, '⚪', '#a16207', { solid: false });
  fz(S, 'jukebox', 12, 2, 1, 1, '🎵', '#be123c', { act: 'jukebox', label: 'Jukebox' });
  fz(S, 'darts', 1, 4, 1, 1, '🎯', '#b91c1c', { act: 'darts', label: 'Jouer aux fléchettes' });
  fz(S, 'locker', 12, 6, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  for (const [x, y] of [[3, 5], [7, 5], [4, 7], [9, 7]]) fz(S, 'table', x, y, 2, 1, '🥃', '#92400e', { r: 1, act: 'sit', label: 'S\'asseoir' });
  sp(S.staff, 5, 1); sp(S.staff, 8, 1);
  for (const [x, y] of [[4, 4], [8, 4], [3, 6], [8, 6], [5, 6], [10, 6], [6, 3], [9, 3]]) sp(S.cust, x, y);
  return S;
};
INT.club = () => {
  const S = newScene(18, 12, 7);
  fz(S, 'counter', 2, 3, 1, 6, '🍸', '#be185d', { act: 'bar_order', label: 'Bar du club' });
  fz(S, 'dj', 7, 2, 5, 1, '🎧', '#4338ca', { act: 'dj', label: 'Cabine DJ' });
  fz(S, 'dance', 6, 4, 6, 4, '', '#a855f755', { solid: false, act: 'dance', label: 'Danser', dance: true });
  fz(S, 'rope', 14, 2, 1, 5, '🪢', '#facc15', { solid: true });
  fz(S, 'vip', 15, 3, 2, 2, '🍾', '#be123c', { act: 'vip', label: 'Table VIP' });
  fz(S, 'locker', 15, 8, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  sp(S.staff, 1, 4); sp(S.staff, 1, 7); sp(S.staff, 9, 1); sp(S.staff, 8, 10);
  for (let i = 0; i < 12; i++) sp(S.cust, 6 + (i % 6), 4 + Math.floor(i / 6) * 2 + (i % 2));
  sp(S.cust, 4, 5); sp(S.cust, 4, 7); sp(S.cust, 14, 9);
  return S;
};
INT.bank = () => {
  const S = newScene(16, 10, 1);
  fz(S, 'teller', 2, 3, 6, 1, '💳', '#334155', { act: 'bank_teller', label: 'Guichet' });
  fz(S, 'bdesk', 10, 2, 3, 1, '🗂️', '#92400e', { act: 'bank_desk', label: 'Bureau du banquier' });
  fz(S, 'glass', 9, 1, 1, 3, '', '#93c5fd88', { solid: true });
  fz(S, 'vault', 13, 1, 2, 2, '🔐', '#a16207', { act: 'vault', label: 'Coffre-fort' });
  fz(S, 'atm', 1, 5, 1, 1, '🏧', '#0f766e', { act: 'atm', label: 'Distributeur' });
  fz(S, 'locker', 14, 5, 1, 2, '🗄️', '#64748b', { act: 'locker', label: 'Casier (service)' });
  for (const x of [3, 5, 7]) fz(S, 'chair', x, 6, 1, 1, '🪑', '#475569', { solid: false });
  sp(S.staff, 3, 2); sp(S.staff, 6, 2); sp(S.staff, 11, 1);
  for (const [x, y] of [[3, 5], [5, 5], [7, 5], [4, 7], [6, 7]]) sp(S.cust, x, y);
  return S;
};
INT.police = () => {
  const S = newScene(18, 11, 1);
  wallRect(S, 4, 1, 4, 3); wallRect(S, 1, 3, 3, 3);
  fz(S, 'cell', 1, 1, 3, 2, '⛓️', '#475569', { solid: false });
  fz(S, 'desk', 6, 5, 4, 1, '🗂️', '#92400e', { act: 'police_desk', label: 'Accueil (amendes / caution)' });
  fz(S, 'booking', 10, 2, 3, 1, '📋', '#1e3a8a', { act: 'booking', label: 'Enregistrer un suspect' });
  fz(S, 'locker', 15, 1, 1, 3, '🗄️', '#64748b', { act: 'locker', label: 'Casier (prise de service)' });
  fz(S, 'armory', 15, 5, 1, 2, '🔫', '#1f2937', { act: 'armory', label: 'Armurerie' });
  fz(S, 'garage', 12, 8, 3, 1, '🚓', '#1d4ed8', { act: 'garage', label: 'Garage (voiture de service)' });
  fz(S, 'bench', 2, 7, 3, 1, '🪑', '#6b7280', { solid: false });
  sp(S.staff, 7, 3); sp(S.staff, 11, 4); sp(S.staff, 8, 7); sp(S.staff, 13, 3); sp(S.staff, 12, 6);
  sp(S.cust, 3, 6); sp(S.cust, 5, 8); sp(S.cust, 9, 8);
  return S;
};
INT.fire = () => {
  const S = newScene(16, 10, 4);
  fz(S, 'truck', 2, 5, 4, 2, '🚒', '#b91c1c', { solid: true });
  fz(S, 'garage', 7, 8, 3, 1, '🚒', '#b91c1c', { act: 'garage', label: 'Garage (camion)' });
  fz(S, 'locker', 12, 1, 3, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier (prise de service)' });
  fz(S, 'bunk', 1, 1, 2, 1, '🛏️', '#6d28d9', { act: 'rest', label: 'Se reposer' });
  fz(S, 'bunk', 4, 1, 2, 1, '🛏️', '#6d28d9', { act: 'rest', label: 'Se reposer' });
  fz(S, 'table', 10, 4, 3, 2, '🍽️', '#a16207', { r: 1 });
  sp(S.staff, 8, 2); sp(S.staff, 12, 3); sp(S.staff, 9, 6); sp(S.staff, 14, 6);
  sp(S.cust, 7, 4); sp(S.cust, 12, 7);
  return S;
};
INT.hospital = () => {
  const S = newScene(18, 11, 1);
  fz(S, 'desk', 3, 7, 4, 1, '🧾', '#0f766e', { act: 'hospital_desk', label: 'Accueil / soins' });
  for (let i = 0; i < 4; i++) fz(S, 'bed', 1 + i * 3, 1, 2, 2, '🛏️', '#e5e7eb', { act: 'hospital_bed', label: 'Lit d\'hôpital', n: i });
  fz(S, 'locker', 15, 1, 1, 2, '🗄️', '#64748b', { act: 'locker', label: 'Casier (prise de service)' });
  fz(S, 'garage', 13, 7, 3, 1, '🚑', '#10b981', { act: 'garage', label: 'Garage (ambulance)' });
  for (const x of [9, 11]) fz(S, 'chair', x, 5, 1, 1, '🪑', '#475569', { solid: false });
  sp(S.staff, 5, 6); sp(S.staff, 6, 4); sp(S.staff, 12, 2); sp(S.staff, 10, 8); sp(S.staff, 14, 4);
  sp(S.cust, 9, 6); sp(S.cust, 11, 6); sp(S.cust, 4, 5);
  return S;
};
INT.prison = () => {
  const S = newScene(28, 18, 4);
  floorRect(S, 0, 0, 27, 17, 4); floorRect(S, 15, 1, 26, 10, 5); floorRect(S, 1, 9, 13, 13, 1); floorRect(S, 15, 12, 26, 13, 1);
  floorRect(S, 1, 15, 26, 16, 0);
  wallRect(S, 14, 1, 14, 4); wallRect(S, 14, 7, 14, 10);
  wallRect(S, 1, 8, 5, 8); wallRect(S, 8, 8, 13, 8);
  wallRect(S, 14, 11, 19, 11); wallRect(S, 22, 11, 26, 11);
  wallRect(S, 14, 11, 14, 13);
  wallRect(S, 0, 14, 12, 14); wallRect(S, 15, 14, 27, 14);
  S.extra.cells = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    const cx = 1 + c * 3, cy = r === 0 ? 1 : 5;
    wallRect(S, cx + 2, cy, cx + 2, cy + 2);
    fz(S, 'cellbed', cx, cy, 2, 1, '🛏️', '#9ca3af', { act: 'cellbed', label: 'Lit de cellule', n: S.extra.cells.length });
    fz(S, 'wc', cx, cy + 2, 1, 1, '🚽', '#e5e7eb', { solid: false });
    S.extra.cells.push({ x: cx + 1, y: cy + 1.5 });
  }
  fz(S, 'tray', 1, 10, 1, 3, '🍲', '#92400e', { act: 'prison_eat', label: 'Plateau-repas' });
  for (const [x, y] of [[5, 10], [9, 10], [5, 12], [9, 12]]) fz(S, 'table', x, y, 3, 1, '🍽️', '#a8a29e', { r: 1 });
  fz(S, 'weights', 17, 3, 3, 1, '🏋️', '#374151', { act: 'gym', label: 'Salle de muscu' });
  fz(S, 'hoop', 24, 2, 1, 1, '🏀', '#ea580c', { act: 'basket', label: 'Basket' });
  fz(S, 'phone', 22, 8, 1, 1, '☎️', '#334155', { act: 'prison_phone', label: 'Téléphone de la prison' });
  fz(S, 'dealer', 18, 8, 1, 1, '🕶️', '#1f2937', { act: 'prison_dealer', label: 'Parler au détenu louche' });
  fz(S, 'weak', 26, 5, 1, 2, '🧱', '#7f1d1d', { act: 'escape', label: 'Mur fragile (évasion)' });
  fz(S, 'bench', 16, 8, 2, 1, '🪑', '#6b7280', { solid: false });
  fz(S, 'bench', 20, 5, 2, 1, '🪑', '#6b7280', { solid: false });
  fz(S, 'work', 16, 12, 4, 1, '🧰', '#a16207', { act: 'prison_work', label: 'Atelier (travail)' });
  fz(S, 'laundry', 22, 12, 4, 1, '🧺', '#0ea5e9', { act: 'prison_work', label: 'Buanderie (travail)' });
  fz(S, 'locker', 2, 15, 3, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier (prise de service)' });
  fz(S, 'desk', 17, 15, 4, 1, '🗂️', '#92400e', { act: 'prison_desk', label: 'Accueil du pénitencier' });
  S.extra.cps = [{ x: 7, y: 4 }, { x: 7, y: 11 }, { x: 20, y: 5 }, { x: 20, y: 12 }];
  S.extra.cps.forEach((c, i) => fz(S, 'cp', c.x - 0.5, c.y - 0.5, 1, 1, '📍', '#fde047', { solid: false, act: 'checkpoint', label: 'Point de ronde ' + 'ABCD'[i], n: i }));
  sp(S.staff, 6, 4); sp(S.staff, 9, 15.5); sp(S.staff, 20, 7); sp(S.staff, 20, 13); sp(S.staff, 12, 15.5); sp(S.staff, 24, 9);
  for (const [x, y] of [[17, 6], [22, 4], [24, 7], [18, 10], [8, 11], [12, 12], [4, 12], [7, 4], [10, 4]]) sp(S.cust, x, y);
  return S;
};
INT.biker = () => {
  const S = newScene(16, 10, 3);
  fz(S, 'counter', 1, 2, 5, 1, '🍺', '#78350f', { act: 'bar_order', label: 'Bar du club' });
  fz(S, 'pool', 8, 5, 3, 2, '🎱', '#166534', { act: 'pool', label: 'Billard' });
  fz(S, 'meet', 9, 1, 3, 1, '🗺️', '#7c2d12', { act: 'gang_meeting', label: 'Table de réunion' });
  fz(S, 'safe', 14, 1, 1, 1, '🔐', '#a16207', { act: 'gang_safe', label: 'Coffre du club' });
  fz(S, 'bike', 2, 6, 2, 1, '🏍️', '#ea580c');
  fz(S, 'bike', 2, 8, 2, 1, '🏍️', '#9a3412');
  fz(S, 'sofa', 13, 5, 1, 3, '🛋️', '#7f1d1d', { act: 'sofa', label: 'Se poser' });
  sp(S.staff, 3, 1); sp(S.staff, 12, 2); sp(S.staff, 14, 3);
  for (const [x, y] of [[5, 4], [7, 3], [6, 7], [12, 4], [4, 5], [10, 8]]) sp(S.cust, x, y);
  return S;
};
INT.mafia = () => {
  const S = newScene(16, 10, 6);
  fz(S, 'counter', 1, 2, 4, 1, '🥃', '#1f2937', { act: 'bar_order', label: 'Bar privé' });
  fz(S, 'roulette', 3, 5, 3, 2, '🎰', '#7f1d1d', { act: 'casino', label: 'Roulette (jouer)' });
  fz(S, 'poker', 7, 5, 3, 2, '🃏', '#14532d', { act: 'casino', label: 'Poker (jouer)' });
  fz(S, 'rope', 10, 1, 1, 3, '🪢', '#facc15');
  fz(S, 'meet', 12, 2, 3, 1, '🗂️', '#4c1d95', { act: 'gang_meeting', label: 'Bureau du Parrain' });
  fz(S, 'safe', 14, 1, 1, 1, '🔐', '#a16207', { act: 'gang_safe', label: 'Coffre de la Famille' });
  sp(S.staff, 2, 1); sp(S.staff, 13, 3); sp(S.staff, 8, 8); sp(S.staff, 12, 4);
  for (const [x, y] of [[5, 4], [8, 4], [4, 8], [11, 6], [12, 7]]) sp(S.cust, x, y);
  return S;
};
INT.street = () => {
  const S = newScene(12, 8, 4);
  fz(S, 'sofa', 1, 3, 1, 3, '🛋️', '#7f1d1d', { act: 'sofa', label: 'Se poser' });
  fz(S, 'tv', 3, 1, 3, 1, '📺', '#111827');
  fz(S, 'meet', 6, 3, 3, 1, '🗺️', '#450a0a', { act: 'gang_meeting', label: 'Table des Diablos' });
  fz(S, 'safe', 9, 1, 1, 1, '🔐', '#a16207', { act: 'gang_safe', label: 'Coffre des Diablos' });
  fz(S, 'stash', 9, 5, 1, 1, '📦', '#78350f', { act: 'gang_stash', label: 'Stock de marchandises' });
  sp(S.staff, 7, 2); sp(S.staff, 4, 3);
  for (const [x, y] of [[3, 4], [5, 5], [8, 5], [3, 6]]) sp(S.cust, x, y);
  return S;
};
INT.store = () => {
  const S = newScene(14, 9, 1);
  for (const y of [2, 4]) for (const x of [2, 6]) fz(S, 'shelf', x, y, 3, 1, '🥫', '#a16207');
  fz(S, 'counter', 9, 6, 3, 1, '🛒', '#0f766e', { act: 'shop', label: 'Caisse (acheter)' });
  fz(S, 'atm', 12, 1, 1, 1, '🏧', '#0f766e', { act: 'atm', label: 'Distributeur' });
  fz(S, 'locker', 1, 6, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  sp(S.staff, 10, 5); sp(S.staff, 12, 5);
  for (const [x, y] of [[3, 3], [7, 3], [3, 6], [8, 7], [11, 3]]) sp(S.cust, x, y);
  return S;
};
INT.gas = () => {
  const S = newScene(8, 6, 1);
  fz(S, 'counter', 2, 2, 3, 1, '⛽', '#ca8a04', { act: 'shop_gas', label: 'Caisse (snacks, mécanique)' });
  fz(S, 'shelf', 6, 1, 1, 3, '🍫', '#a16207');
  sp(S.staff, 3, 1); sp(S.cust, 3, 4); sp(S.cust, 5, 3);
  return S;
};
INT.dealer = () => {
  const S = newScene(16, 10, 1);
  [[2, 2], [6, 2], [10, 2]].forEach(([x, y], i) => fz(S, 'car', x, y, 3, 2, ['🚗', '🏎️', '🏍️'][i], ['#2563eb', '#dc2626', '#f97316'][i], { act: 'dealer_desk', label: 'Voir le catalogue' }));
  fz(S, 'desk', 12, 6, 3, 1, '🗂️', '#92400e', { act: 'dealer_desk', label: 'Bureau du vendeur' });
  fz(S, 'locker', 14, 1, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  sp(S.staff, 13, 5); sp(S.staff, 8, 7);
  sp(S.cust, 5, 5); sp(S.cust, 9, 5); sp(S.cust, 3, 7);
  return S;
};
INT.office = () => {
  const S = newScene(12, 8, 2);
  for (const [x, y] of [[2, 2], [5, 2], [8, 2], [2, 5], [5, 5], [8, 5]]) fz(S, 'desk', x, y, 2, 1, '💻', '#475569');
  fz(S, 'locker', 10, 1, 1, 1, '🗄️', '#64748b', { act: 'locker', label: 'Casier' });
  for (const [x, y] of [[2, 3], [5, 3], [8, 3], [2, 6]]) sp(S.staff, x, y);
  sp(S.cust, 10, 5);
  return S;
};
RP.scenes = {};
function sceneOf(b) {
  if (!RP.scenes[b.id]) { const S = (INT[b.kind] || INT.house)(b); S.bid = b.id; S.kind = b.kind; RP.scenes[b.id] = S; }
  return RP.scenes[b.id];
}
function blockedIn(S, x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h || S.wall[ty * S.w + tx]) return true;
  }
  for (const f of S.furn) {
    if (!f.solid) continue;
    if (x + r > f.x * TS && x - r < (f.x + f.w) * TS && y + r > f.y * TS && y - r < (f.y + f.h) * TS) return true;
  }
  return false;
}
function blockedOut(x, y, r) {
  const x0 = Math.floor((x - r) / TS), x1 = Math.floor((x + r) / TS), y0 = Math.floor((y - r) / TS), y1 = Math.floor((y + r) / TS);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (BUILD_SOLID(tileAt(tx, ty))) return true;
  return false;
}
