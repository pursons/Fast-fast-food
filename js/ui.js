'use strict';
// ===== Interface : toasts, menus, barres de progression, entrées =====
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = msg;
  $('toasts').appendChild(el);
  while ($('toasts').children.length > 4) $('toasts').removeChild($('toasts').firstChild);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = 0; setTimeout(() => el.remove(), 450); }, 3600);
  if (kind === 'good') Snd.beep(990, 0.07, 'sine', 0.04); else if (kind === 'bad') Snd.beep(200, 0.15, 'sawtooth', 0.04);
}
const UI = {
  modalOpen: false, prog: null, onClose: null,
  menu(title, sub, items, opts) {
    opts = opts || {};
    const m = $('modal'); UI.modalOpen = true; UI.onClose = opts.onClose || null;
    let h = `<div class="box"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}`;
    items.forEach((it, i) => {
      h += `<button class="opt" data-i="${i}" ${it.disabled ? 'disabled' : ''}><span>${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}</span>${it.right ? `<span class="dim">${it.right}</span>` : ''}</button>`;
    });
    if (!opts.noCancel) h += `<button class="opt cancel" data-i="-1">${opts.cancelLabel || 'Fermer'}</button>`;
    h += '</div>';
    m.innerHTML = h; m.classList.remove('hidden');
    m.onclick = (e) => {
      const b = e.target.closest('.opt'); if (!b) { if (e.target === m && !opts.noCancel) UI.close(); return; }
      const i = +b.dataset.i; Snd.click();
      if (i < 0) { UI.close(); return; }
      const it = items[i]; if (it.disabled) return;
      if (!it.keep) UI.close(true);
      if (it.fn) it.fn();
    };
  },
  html(content, btns) {
    const m = $('modal'); UI.modalOpen = true;
    m.innerHTML = `<div class="box">${content}${(btns || []).map((b, i) => `<button class="opt ${b.cls || ''}" data-i="${i}">${b.label}</button>`).join('')}</div>`;
    m.classList.remove('hidden');
    m.onclick = (e) => {
      const b = e.target.closest('.opt'); if (!b) return;
      const bt = btns[+b.dataset.i]; Snd.click(); if (!bt.keep) UI.close(true); if (bt.fn) bt.fn(m);
    };
  },
  alert(title, text, label, fn) { UI.html(`<h3>${title}</h3><div class="sub">${text}</div>`, [{ label: label || 'OK', fn }]); },
  confirm(title, text, yes, no, fnYes, fnNo) { UI.html(`<h3>${title}</h3><div class="sub">${text}</div>`, [{ label: yes || 'Oui', fn: fnYes }, { label: no || 'Non', cls: 'cancel', fn: fnNo }]); },
  input(title, placeholder, cb, def) {
    UI.html(`<h3>${title}</h3><input class="tx" id="ui-in" placeholder="${esc(placeholder || '')}" value="${esc(def || '')}" maxlength="80">`, [{ label: 'Valider', fn: () => cb($('ui-in') ? $('ui-in').value : '') }]);
    // la valeur doit être lue avant la fermeture
    const m = $('modal'); m.onclick = (e) => { const b = e.target.closest('.opt'); if (!b) return; const v = $('ui-in').value; UI.close(true); cb(v); };
    setTimeout(() => { const i = $('ui-in'); if (i) i.focus(); }, 50);
  },
  close(silent) {
    $('modal').classList.add('hidden'); $('modal').innerHTML = ''; UI.modalOpen = false;
    const f = UI.onClose; UI.onClose = null; if (f && !silent) f();
  },
  // barre de progression (reste immobile)
  progress(label, secs, cb, opts) {
    opts = opts || {};
    UI.prog = { label, t: 0, dur: secs, cb, x: P.x, y: P.y, free: !!opts.free, cancel: opts.onCancel };
    let el = $('prog'); if (!el) { el = document.createElement('div'); el.id = 'prog'; el.style.cssText = 'position:absolute;left:50%;top:38%;transform:translateX(-50%);background:#000c;border:1px solid #fff4;border-radius:14px;padding:10px 16px;min-width:200px;text-align:center;z-index:25;font-size:14px;font-weight:700'; el.innerHTML = '<div id="prog-l"></div><div class="pbar" style="margin-top:6px"><i id="prog-b" style="width:0"></i></div>'; $('game').appendChild(el); }
    $('prog-l').textContent = label; $('prog-b').style.width = '0'; el.style.display = 'block';
  },
  progUpdate(dt) {
    const p = UI.prog; if (!p) return;
    if (!p.free && Math.hypot(P.x - p.x, P.y - p.y) > 30) { UI.progCancel(); return; }
    p.t += dt; $('prog-b').style.width = Math.min(100, (p.t / p.dur) * 100) + '%';
    if (p.t >= p.dur) { UI.prog = null; $('prog').style.display = 'none'; p.cb && p.cb(); }
  },
  progCancel() { if (!UI.prog) return; const c = UI.prog.cancel; UI.prog = null; $('prog').style.display = 'none'; toast('Action interrompue.', 'warn'); c && c(); },
  fade(text, ms, mid) {
    const f = $('fade'); f.textContent = text || ''; f.style.opacity = 1;
    setTimeout(() => { mid && mid(); }, 350);
    setTimeout(() => { f.style.opacity = 0; f.textContent = ''; }, ms || 900);
  },
  setPrompt(label, fn) {
    const p = $('prompt');
    if (!label) { p.classList.add('hidden'); p._fn = null; return; }
    p.classList.remove('hidden'); p.textContent = label; p._fn = fn;
  },
};

// ---------- entrées ----------
const Input = {
  mx: 0, my: 0, run: false, held: {}, edge: {}, keys: {},
  consume(k) { const v = this.edge[k]; this.edge[k] = false; return v; },
  init() {
    const stick = $('stick'), knob = $('knob'); let id = null;
    const setv = (e) => {
      const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const R = r.width / 2 - 10; const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      Input.mx = dx / R; Input.my = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
    };
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); setv(e); e.preventDefault(); });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) setv(e); });
    const end = (e) => { if (e.pointerId === id) { id = null; Input.mx = Input.my = 0; knob.style.transform = ''; } };
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
    const bind = (el, key, hold) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); Input.edge[key] = true; Input.held[key] = true; el.classList.add('on'); Snd.init && !Snd.ctx && Snd.init(); });
      const up = () => { Input.held[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerup', up); el.addEventListener('pointerleave', up); el.addEventListener('pointercancel', up);
    };
    bind($('btn-act'), 'act'); bind($('btn-veh'), 'veh'); bind($('btn-atk'), 'atk'); bind($('btn-run'), 'run');
    $('btn-phone').onclick = () => Phone.toggle(); $('btn-inv').onclick = () => Inv.open(); $('btn-menu').onclick = () => Menu.open();
    $('prompt').addEventListener('pointerdown', (e) => { e.preventDefault(); Input.edge.act = true; });
    window.addEventListener('keydown', (e) => {
      if (/input|textarea/i.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
      Input.keys[e.key.toLowerCase()] = true;
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'enter') Input.edge.act = true;
      if (k === 'f') Input.edge.veh = true;
      if (k === ' ') { Input.edge.atk = true; e.preventDefault(); }
      if (k === 'p') Phone.toggle();
      if (k === 'i') Inv.open();
      if (k === 'escape') { if (UI.modalOpen) UI.close(); else if (Phone.isOpen()) Phone.close(); else Menu.open(); }
    });
    window.addEventListener('keyup', (e) => { Input.keys[e.key.toLowerCase()] = false; });
  },
  vec() {
    let x = Input.mx, y = Input.my;
    const K = Input.keys;
    if (K.a || K.arrowleft || K.q) x -= 1; if (K.d || K.arrowright) x += 1; if (K.w || K.arrowup || K.z) y -= 1; if (K.s || K.arrowdown) y += 1;
    const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  },
  running() { return Input.held.run || Input.keys.shift; },
};
