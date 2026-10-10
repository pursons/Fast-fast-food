'use strict';
// ===== Téléphone : applications =====
const APPS = [
  { id: 'messages', n: 'Messages', e: '💬', c: 'linear-gradient(135deg,#22c55e,#16a34a)' },
  { id: 'insta', n: 'Instagram', e: '📸', c: 'linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)' },
  { id: 'flamme', n: 'Flamme', e: '🔥', c: 'linear-gradient(135deg,#fb7185,#f43f5e)' },
  { id: 'bank', n: 'Banque', e: '🏦', c: 'linear-gradient(135deg,#0ea5e9,#2563eb)' },
  { id: 'gps', n: 'GPS & Taxi', e: '🧭', c: 'linear-gradient(135deg,#14b8a6,#0891b2)' },
  { id: 'job', n: 'Métier', e: '💼', c: 'linear-gradient(135deg,#64748b,#334155)' },
  { id: 'gang', n: 'Gang', e: '🕶️', c: 'linear-gradient(135deg,#475569,#111827)' },
  { id: 'dispatch', n: 'Dispatch', e: '📡', c: 'linear-gradient(135deg,#ef4444,#b91c1c)' },
  { id: 'news', n: 'Actus & Éco', e: '📰', c: 'linear-gradient(135deg,#a855f7,#6d28d9)' },
  { id: 'settings', n: 'Réglages', e: '⚙️', c: 'linear-gradient(135deg,#94a3b8,#475569)' },
];
const Phone = {
  state: { app: 'home', thread: null, tab: 0 },
  isOpen() { return !$('phone').classList.contains('hidden'); },
  open(app) {
    if (P.jail) { toast('📵 Votre téléphone a été confisqué à l\'entrée.', 'bad'); return; }
    if (UI.modalOpen) UI.close();
    $('phone').classList.remove('hidden'); Phone.state.app = app || 'home'; Phone.state.thread = null; Phone.render();
    Input.mx = Input.my = 0; $('knob').style.transform = '';
  },
  close() { $('phone').classList.add('hidden'); },
  toggle() { if (Phone.isOpen()) Phone.close(); else Phone.open('home'); },
  refresh() { if (Phone.isOpen()) Phone.render(); Phone.refreshBadge(); },
  refreshBadge() { const u = Object.values(G.msgs).reduce((s, t) => s + t.unread, 0); $('btn-phone').textContent = u ? '📱' + (u > 9 ? '9+' : u) : '📱'; },
  render() {
    const s = Phone.state; let body = '';
    const head = `<div class="ph-status"><span>${dayStr()} ${timeStr()}</span><span>${money(P.bank)}</span><span>📶 🔋</span></div>`;
    if (s.app === 'home') {
      const unread = Object.values(G.msgs).reduce((a, t) => a + t.unread, 0);
      body = '<div class="home">' + APPS.map((a) => `<div class="app" onclick="Phone.a('go','${a.id}')"><div class="ic" style="background:${a.c}">${a.e}</div>${a.n}${a.id === 'messages' && unread ? `<span class="badge">${unread}</span>` : ''}</div>`).join('') + '</div>';
    } else body = (Apps[s.app] ? Apps[s.app]() : '');
    $('phone').innerHTML = `${head}<div class="ph-body" id="ph-body">${body}</div><div class="ph-nav"><button onclick="Phone.a('back')">◀</button><button onclick="Phone.a('go','home')">⚪</button><button onclick="Phone.close()">✕</button></div>`;
    const pb = $('ph-body'); if (pb && Phone._scroll != null && Phone._scrollApp === s.app) pb.scrollTop = Phone._scroll;
    if (s.app === 'messages' && s.thread) pb.scrollTop = pb.scrollHeight;
  },
  a(act, arg, arg2) {
    const s = Phone.state; Snd.click();
    const pb = $('ph-body'); if (pb) { Phone._scroll = pb.scrollTop; Phone._scrollApp = s.app; }
    switch (act) {
      case 'go': s.app = arg; s.thread = null; s.tab = 0; Phone._scroll = 0; break;
      case 'back': if (s.thread) s.thread = null; else if (s.app !== 'home') s.app = 'home'; else Phone.close(); Phone._scroll = 0; break;
      case 'tab': s.tab = +arg; Phone._scroll = 0; break;
      default: Actions[act] && Actions[act](arg, arg2);
    }
    Phone.render();
  },
  doAction(key, arg) {
    if (key === 'turf_hq') { if (!P.mission) Missions.start('turf'); Phone.close(); }
    else if (key === 'goto') { if (P.gang) { const f = frontPx(W.buildings[Gangs.G().hq]); P.wp = { x: f.x, y: f.y, label: 'QG' }; toast('📍 GPS défini sur le QG.'); } }
  },
};
const hd = (t, right) => `<div class="ph-h"><span>${t}</span><span>${right || ''}</span></div>`;
const av = (n, size) => `<div class="av" style="background:${n.col || '#64748b'};${size ? `width:${size}px;height:${size}px` : ''}">${n.emoji || esc((n.name || '?')[0])}</div>`;
const barPct = (a, b) => `<div class="pbar"><i style="width:${clamp(a / b * 100, 0, 100)}%"></i></div>`;

const Apps = {
  // ---------- Messages ----------
  messages() {
    const s = Phone.state;
    if (s.thread) {
      const th = G.msgs[s.thread]; if (!th) { s.thread = null; return Apps.messages(); }
      th.unread = 0; Phone.refreshBadge();
      const n = th.npc != null ? G.npcs[th.npc] : null;
      let h = hd(esc(th.name), n ? `<span class="small dim">${Talk.jobStr(n)}</span>` : '');
      h += '<div class="ph-pad">' + th.msgs.map((m, i) => `<div class="bubble ${m.me ? 'me' : 'them'}">${esc(m.text)}</div>` + (m.actions ? m.actions.map((a) => `<button class="btn sm" onclick="Phone.a('msgact','${a.key}')">${esc(a.label)}</button>`).join(' ') : '')).join('') + '</div>';
      if (n) {
        h += '<div class="ph-pad"><div class="row" style="flex-wrap:wrap;gap:6px">';
        h += `<button class="btn sm alt" onclick="Phone.a('quick','Salut ! Ça va ?')">👋 Salut</button>`;
        h += `<button class="btn sm alt" onclick="Phone.a('where')">📍 Où es-tu ?</button>`;
        h += `<button class="btn sm alt" onclick="Phone.a('gift')">💶 Offrir 50 €</button>`;
        if (n.matched || n.rel > 25) h += `<button class="btn sm" onclick="Phone.a('datemenu')">💞 Rencard</button>`;
        h += '</div><div class="row" style="margin-top:8px"><input class="tx" id="msg-in" placeholder="Écrire…" onkeydown="if(event.key===\'Enter\')Phone.a(\'sendtxt\')"><button class="btn" onclick="Phone.a(\'sendtxt\')">➤</button></div></div>';
      }
      return h;
    }
    const ths = Object.values(G.msgs).sort((a, b) => (b.last || 0) - (a.last || 0));
    let h = hd('Messages');
    if (!ths.length) h += '<div class="ph-pad dim">Aucun message. Faites connaissance avec des habitants pour récupérer leur numéro.</div>';
    h += '<div class="ph-pad">' + ths.map((t) => {
      const n = t.npc != null ? G.npcs[t.npc] : null; const last = t.msgs[t.msgs.length - 1];
      return `<div class="card row" onclick="Phone.a('thread','${esc(t.name).replace(/'/g, '&#39;')}')"><div class="av" style="background:${t.col}">${n ? n.emoji : esc(t.name[0])}</div><div style="flex:1;min-width:0"><b>${esc(t.name)}</b>${t.unread ? ` <span class="badge" style="background:#ef4444;border-radius:10px;padding:1px 6px;font-size:10px">${t.unread}</span>` : ''}<div class="small dim" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(last ? last.text : '')}</div></div></div>`;
    }).join('') + '</div>';
    // contacts connus sans conversation
    const known = G.npcs.filter((n) => n.known && !G.msgs[n.name] && n.state !== 'dead');
    if (known.length) h += '<div class="ph-pad dim small">Contacts</div><div class="ph-pad">' + known.map((n) => `<div class="card row" onclick="Phone.a('newthread',${n.id})">${av(n)}<div style="flex:1"><b>${esc(n.name)}</b><div class="small dim">${n.phone}</div></div></div>`).join('') + '</div>';
    return h;
  },
  // ---------- Instagram ----------
  insta() {
    const s = Phone.state; const tabs = ['Fil', 'Publier', 'Profil'];
    let h = hd('Instagram', `<span class="small dim">${P.followers} abonnés</span>`) + `<div class="tabs">${tabs.map((t, i) => `<button class="${s.tab === i ? 'on' : ''}" onclick="Phone.a('tab',${i})">${t}</button>`).join('')}</div><div class="ph-pad">`;
    if (s.tab === 0) {
      for (const p of G.posts.slice(0, 18)) {
        const me = p.who === 'me'; const n = me ? null : G.npcs[p.who];
        const name = me ? P.name + ' (vous)' : n.name;
        h += `<div class="post"><div class="row" style="padding:8px 10px">${me ? `<div class="av" style="background:${P.col};width:30px;height:30px">🙂</div>` : av(n, 30)}<b class="small">${esc(name)}</b><span class="small dim" style="margin-left:auto">${Phone.ago(p.t)}</span></div>`;
        h += p.img ? `<img src="${p.img}">` : `<div class="pimg" style="background:${p.bg || 'linear-gradient(135deg,#1e293b,#334155)'};display:flex;align-items:center;justify-content:center;font-size:64px">${p.emoji || '📷'}</div>`;
        h += `<div class="pb"><button class="btn sm alt" onclick="Phone.a('like',${p.id})">${p.liked ? '❤️' : '🤍'} ${p.likes}</button> ${!me ? `<button class="btn sm alt" onclick="Phone.a('follow',${n.id})">${n.followed ? '✔ Suivi' : '➕ Suivre'}</button><button class="btn sm alt" onclick="Phone.a('dm',${n.id})">✉️</button>` : ''}<div style="margin-top:6px">${esc(p.cap)}</div></div></div>`;
      }
    } else if (s.tab === 1) {
      const cd = Math.max(0, 90 - (_rt - P.lastPostT));
      h += `<div class="card">Prenez une photo de ce que vous voyez dans le jeu et publiez-la. Plus vous êtes stylé (voiture, soirée, tenue) et populaire, plus vous gagnez d'abonnés.</div>`;
      h += `<input class="tx" id="cap" placeholder="Légende…" maxlength="90"><div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn" onclick="Phone.a('postcam')" ${cd > 0 ? 'disabled' : ''}>📸 Photo de la scène</button><button class="btn alt" onclick="Phone.a('posttxt')" ${cd > 0 ? 'disabled' : ''}>📝 Texte seul</button></div>${cd > 0 ? `<div class="small dim" style="margin-top:6px">Patientez ${Math.ceil(cd)} s avant de republier.</div>` : ''}`;
      h += `<div class="card" style="margin-top:10px"><b>🤝 Partenariats</b><div class="small dim">Dès 1 500 abonnés, des marques vous paient pour des posts sponsorisés.</div><button class="btn sm" style="margin-top:6px" ${P.followers < 1500 || (P.lastSponsor && G.t - P.lastSponsor < 1440) ? 'disabled' : ''} onclick="Phone.a('sponsor')">Poster une pub (${money(80 + P.followers * 0.06)})</button></div>`;
    } else {
      h += `<div class="card row">${`<div class="av" style="background:${P.col}">🙂</div>`}<div><b>${esc(P.name)}</b><div class="small dim">${P.followers} abonnés · ${G.posts.filter((p) => p.who === 'me').length} posts · charme ${Math.round(P.charm)}</div></div></div>`;
      for (const p of G.posts.filter((q) => q.who === 'me').slice(0, 8)) h += `<div class="card small">${p.img ? `<img src="${p.img}" style="width:100%;border-radius:8px">` : ''}<div>❤️ ${p.likes} · ${esc(p.cap)}</div></div>`;
    }
    return h + '</div>';
  },
  // ---------- Flamme ----------
  flamme() {
    const s = Phone.state; const tabs = ['Découvrir', 'Matchs', 'Rencards'];
    let h = hd('🔥 Flamme') + `<div class="tabs">${tabs.map((t, i) => `<button class="${s.tab === i ? 'on' : ''}" onclick="Phone.a('tab',${i})">${t}</button>`).join('')}</div><div class="ph-pad">`;
    if (s.tab === 0) {
      const n = Dating.current();
      if (!n) h += '<div class="card dim">Plus de profils pour l\'instant. Revenez plus tard !</div>';
      else {
        const c1 = `hsl(${(n.id * 47) % 360},70%,45%)`, c2 = `hsl(${(n.id * 47 + 60) % 360},70%,30%)`;
        h += `<div class="swipe" style="--c1:${c1};--c2:${c2}"><div class="big">${n.emoji}</div><b style="font-size:22px">${esc(n.first)}, ${n.age}</b><div>${esc(n.bio)}</div><div class="small" style="opacity:.85;margin-top:4px">❤️ ${n.interests.join(' · ')}</div><div class="small" style="opacity:.85">💼 ${Talk.jobStr(n)}</div></div>`;
        h += `<div class="row" style="justify-content:center;gap:30px;margin-top:12px"><button class="bigbtn" onclick="Phone.a('swipe',0)">✖️</button><button class="bigbtn" style="background:#be123c" onclick="Phone.a('swipe',1)">💚</button></div>`;
      }
    } else if (s.tab === 1) {
      const m = G.npcs.filter((n) => n.matched && n.state !== 'dead');
      if (!m.length) h += '<div class="card dim">Aucun match pour le moment.</div>';
      h += m.map((n) => `<div class="card row" onclick="Phone.a('newthread',${n.id})">${av(n)}<div style="flex:1"><b>${esc(n.name)}</b><div class="small dim">Affinité : ${Math.round(n.aff || 0)}/100 ${n.partner ? '· 💍 en couple' : ''}</div>${barPct(n.aff || 0, 100)}</div></div>`).join('');
    } else {
      const d = P.date;
      if (d) { const n = G.npcs[d.npc]; h += `<div class="card"><b>💞 Rencard avec ${esc(n.name)}</b><div class="small">${esc(W.buildings[d.bid].name)} — ${d.at > G.t ? 'dans ' + Jail.fmt(d.at - G.t) : 'maintenant !'}</div><button class="btn sm" onclick="Phone.a('datego')">📍 GPS</button> <button class="btn sm bad" onclick="Phone.a('datecancel')">Annuler</button></div>`; }
      else h += '<div class="card dim">Aucun rencard prévu. Ouvrez une conversation avec un match pour en proposer un.</div>';
      if (P.partner != null) { const n = G.npcs[P.partner]; h += `<div class="card">💍 En couple avec <b>${esc(n.name)}</b></div>`; }
    }
    return h + '</div>';
  },
  // ---------- Banque ----------
  bank() {
    const E = Eco.stats();
    let h = hd('🏦 Banque') + '<div class="ph-pad">';
    h += `<div class="card"><div class="small dim">Solde du compte</div><div style="font-size:28px;font-weight:800">${money(P.bank)}</div><div class="small">Espèces sur vous : ${money(P.cash)}</div></div>`;
    if (P.loan) h += `<div class="card"><b>Prêt en cours</b><div>Reste dû : <b class="bad">${money(P.loan.owed)}</b></div><div class="small dim">Prélèvement : ${money(P.loan.daily)}/jour${P.loan.late ? ` · ${P.loan.late} jours de retard !` : ''}</div></div>`;
    if (P.rentLate) h += `<div class="card bad">Loyer en retard : ${P.rentLate} jour(s)</div>`;
    h += `<div class="card small">Loyer : ${money(P.homeRent * (1 + G.eco.infl))}/jour · Salaire estimé : ${P.job !== 'none' ? money(Jobs.wage()) + '/h' : '—'}</div>`;
    h += `<div class="card"><b>📊 Économie de la ville</b><div class="small">Trésor public : ${money(E.treasury)}<br>Taux de TVA : ${(E.tax * 100).toFixed(1)} %<br>Inflation : ${(E.infl * 100).toFixed(1)} %<br>Chômage : ${(E.unemp * 100).toFixed(0)} %<br>Richesse moyenne : ${money(E.avgWealth)}</div></div>`;
    h += '<div class="card"><b>Prix actuels</b><div class="small">' + ['burger', 'fries', 'soda', 'beer', 'cocktail', 'meal', 'grocery'].map((k) => `${ITEMS[k].e} ${ITEMS[k].n} : <b>${money(Eco.price(k))}</b>`).join('<br>') + `<br>⛽ Essence : <b>${Eco.fuelPrice().toFixed(2)} €/L</b></div></div>`;
    h += `<div class="card"><b>Virement rapide</b><div class="small dim">Retirez/déposez dans une agence ou un distributeur 🏧.</div></div>`;
    return h + '</div>';
  },
  // ---------- GPS ----------
  gps() {
    let h = hd('🧭 GPS & Taxi') + '<div class="ph-pad">';
    if (P.wp) h += `<div class="card row sp"><span>📍 ${esc(P.wp.label || 'Destination')}</span><span><button class="btn sm" onclick="Phone.a('taxi')">🚕 Taxi ${money(Phone.taxiFare())}</button> <button class="btn sm alt" onclick="Phone.a('clearwp')">✖</button></span></div>`;
    const kinds = [['house', '🏠 Mon domicile', 'home'], ['fastfood', '🍔 Fast Fast Food'], ['bank', '🏦 Banque'], ['police', '🚓 Commissariat'], ['fire', '🚒 Caserne'], ['hospital', '🏥 Hôpital'], ['prison', '🔒 Prison'], ['dealer', '🚘 Concession'], ['gas', '⛽ Station-service'], ['store', '🛒 Supérette'], ['restaurant', '🍝 Restaurant'], ['bar', '🍺 Bar'], ['club', '🪩 Boîte de nuit'], ['biker', '🏍️ QG Iron Wolves'], ['mafia', '🎩 Le Corvino'], ['street', '🔥 Planque des Diablos']];
    for (const [k, label, special] of kinds) {
      const b = special === 'home' ? W.buildings[P.homeBid] : nearestOfKind(k, P); if (!b) continue;
      const f = frontPx(b); const d = Math.round(Math.hypot(f.x - P.x, f.y - P.y) / TS * 3);
      h += `<div class="card row sp" onclick="Phone.a('setwp',${b.id})"><span>${label}</span><span class="dim small">${d} m</span></div>`;
    }
    const v = P.ownV.map((i) => Veh.byId(i)).filter(Boolean);
    for (const x of v) h += `<div class="card row sp" onclick="Phone.a('setveh',${x.id})"><span>${VEH[x.type].emoji} ${VEH[x.type].n} (${x.plate})</span><span class="dim small">⛽ ${Math.round(x.fuel)}L · ${Math.round(x.hp)}%</span></div>`;
    return h + '</div>';
  },
  // ---------- Métier ----------
  job() {
    let h = hd('💼 Métier') + '<div class="ph-pad">';
    if (P.job === 'none') {
      h += '<div class="card dim small">Choisissez un métier. Vous devrez ensuite vous présenter sur place et passer au casier pour prendre votre service.</div>';
      for (const k in JOBS) { if (k === 'none') continue; const J = JOBS[k]; h += `<div class="card"><div class="row sp"><b>${J.emoji} ${J.name}</b><span class="good small">${money(J.pay[0])}/h</span></div><div class="small dim">${J.ranks.join(' → ')}</div><button class="btn sm" style="margin-top:6px" onclick="Phone.a('apply','${k}')">Postuler</button></div>`; }
    } else {
      const J = JOBS[P.job]; const b = W.buildings[P.empBid]; const next = RANK_XP[P.jobRank + 1];
      h += `<div class="card"><b>${J.emoji} ${J.name}</b><div class="small dim">${esc(b.name)}</div><div style="font-size:18px;margin:6px 0">${esc(Jobs.rankName())}</div>${next ? barPct(P.jobXp - RANK_XP[P.jobRank], next - RANK_XP[P.jobRank]) + `<div class="small dim">XP ${P.jobXp} / ${next}</div>` : '<div class="small good">Grade maximum</div>'}<div class="small" style="margin-top:6px">Salaire : <b>${money(Jobs.wage())}/h</b> · ${P.onDuty ? '<span class="good">En service</span>' : '<span class="dim">Hors service</span>'}</div></div>`;
      h += `<div class="card"><button class="btn sm alt" onclick="Phone.a('setwp',${b.id})">📍 Aller au travail</button> <button class="btn sm bad" onclick="Phone.a('quit')">Démissionner</button></div>`;
      if (Jobs.canManage()) {
        h += `<div class="card"><b>👥 Gestion d'équipe</b><div class="small dim">Recrutez, promouvez ou licenciez vos subordonnés.</div></div>`;
        const team = Jobs.team();
        h += team.map((n) => `<div class="card row sp"><div>${esc(n.name)}<div class="small dim">${J.ranks[Math.min(n.jr, J.ranks.length - 1)]}</div></div><div><button class="btn sm alt" onclick="Phone.a('tpromo',${n.id})" ${n.jr >= P.jobRank - 1 ? 'disabled' : ''}>⬆</button> <button class="btn sm alt" onclick="Phone.a('tdemo',${n.id})" ${n.jr <= 0 ? 'disabled' : ''}>⬇</button> <button class="btn sm bad" onclick="Phone.a('tfire',${n.id})" ${n.jr >= P.jobRank ? 'disabled' : ''}>Virer</button></div></div>`).join('') || '<div class="small dim">Aucun employé.</div>';
        const un = G.npcs.filter((n) => (!n.job || n.job === 'none') && !n.sjob && !n.gang && n.state !== 'dead' && n.loc !== 'prison').slice(0, 8);
        h += '<div class="small dim" style="margin:8px 0 4px">Candidats disponibles</div>' + un.map((n) => `<div class="card row sp"><div>${esc(n.name)} <span class="small dim">${n.age} ans</span></div><button class="btn sm" onclick="Phone.a('thire',${n.id})">Embaucher</button></div>`).join('');
      }
    }
    return h + '</div>';
  },
  // ---------- Gang ----------
  gang() {
    let h = hd('🕶️ Gang') + '<div class="ph-pad">';
    if (!P.gang) {
      h += '<div class="card dim small">Rendez-vous dans le QG d\'un gang pour demander à entrer. Chacun a son style, ses missions et ses règles.</div>';
      for (const k in GANGS) { const g = GANGS[k]; const b = W.byKind[g.hq][0]; h += `<div class="card"><b>${g.emoji} ${g.name}</b><div class="small dim">${g.blurb}</div><div class="small">Membres : ${G.gangs[k].members.length} · Respect ${Math.round(G.gangs[k].respect)}</div><button class="btn sm alt" onclick="Phone.a('setwp',${b.id})">📍 QG</button></div>`; }
      return h + '</div>';
    }
    const g = Gangs.def(), gs = Gangs.G(); const tabs = ['Aperçu', 'Membres', 'Recrutement', 'Rivaux'];
    h += `<div class="tabs">${tabs.map((t, i) => `<button class="${Phone.state.tab === i ? 'on' : ''}" onclick="Phone.a('tab',${i})">${t}</button>`).join('')}</div>`;
    const t = Phone.state.tab;
    if (t === 0) {
      const nextR = g.resp[P.gangRank + 1];
      h += `<div class="card" style="border-color:${g.col}"><b>${g.emoji} ${g.name}</b><div style="font-size:18px">${esc(Gangs.myRankName())}</div>${nextR != null && P.gangRank < 3 ? barPct(P.respect - g.resp[P.gangRank], nextR - g.resp[P.gangRank]) + `<div class="small dim">Respect ${Math.round(P.respect)} / ${nextR}</div>` : `<div class="small dim">Respect ${Math.round(P.respect)}</div>`}<div class="small">Caisse du gang : <b>${money(gs.treasury)}</b> · ${gs.members.length} membres</div></div>`;
      if (P.mission) h += `<div class="card"><b>🎯 ${esc(P.mission.title)}</b><div class="small">${esc(Missions.text())}</div><button class="btn sm" onclick="Phone.a('missionwp')">📍 GPS</button> <button class="btn sm bad" onclick="Phone.a('missioncancel')">Abandonner</button></div>`;
      else h += '<div class="card small dim">Aucune mission. Rendez-vous à la table de réunion de votre QG.</div>';
      if (P.gangRank >= 4) h += `<div class="card"><b>👑 Tribut des membres</b><div class="small dim">Part prélevée sur leurs revenus : ${Math.round(gs.tribute * 100)} %</div><button class="btn sm alt" onclick="Phone.a('tribute',-1)">−</button> <button class="btn sm alt" onclick="Phone.a('tribute',1)">+</button></div>`;
      h += `<div class="card"><button class="btn sm alt" onclick="Phone.a('setwp',${gs.hq})">📍 Aller au QG</button></div>`;
    } else if (t === 1) {
      const mem = Gangs.members(P.gang).sort((a, b) => b.gr - a.gr);
      h += mem.map((n) => `<div class="card"><div class="row sp"><div><b>${esc(n.name)}</b><div class="small dim">${Gangs.rankName(P.gang, n.gr)} · loyauté ${Math.round(n.rel)}</div></div></div>${P.gangRank >= 3 || n.gr < P.gangRank ? `<div class="row" style="margin-top:6px">${P.gangRank >= 3 ? `<button class="btn sm alt" onclick="Phone.a('gpromo',${n.id})">⬆ Promouvoir</button><button class="btn sm alt" onclick="Phone.a('gdemo',${n.id})">⬇</button>` : ''}<button class="btn sm bad" onclick="Phone.a('gfire',${n.id})" ${n.gr >= P.gangRank ? 'disabled' : ''}>Renvoyer</button></div>` : ''}</div>`).join('');
    } else if (t === 2) {
      if (P.gangRank < 2) h += '<div class="card dim small">Il faut le grade de ' + esc(g.ranks[2]) + ' pour recruter.</div>';
      else {
        const c = G.npcs.filter((n) => !n.gang && !['police', 'guard'].includes(n.job) && n.state !== 'dead' && n.loc !== 'prison' && n.age < 60).sort((a, b) => b.crim - a.crim).slice(0, 10);
        h += c.map((n) => `<div class="card row sp"><div><b>${esc(n.name)}</b><div class="small dim">${Talk.jobStr(n)} · pr. ${Math.round(Gangs.recruitChance(n) * 100)} %</div></div><button class="btn sm" onclick="Phone.a('grecruit',${n.id})">Recruter</button></div>`).join('');
      }
    } else {
      for (const k in GANGS) if (k !== P.gang) { const o = G.gangs[k], d = GANGS[k]; h += `<div class="card"><b>${d.emoji} ${d.name}</b><div class="small dim">${o.members.length} membres · respect ${Math.round(o.respect)} · caisse ${money(o.treasury)}</div></div>`; }
    }
    return h + '</div>';
  },
  // ---------- Dispatch ----------
  dispatch() {
    let h = hd('📡 Dispatch') + '<div class="ph-pad">';
    const list = G.incidents.filter((i) => !i.done);
    if (!list.length) h += '<div class="card dim">Aucune intervention en cours.</div>';
    const lab = { fire: '🔥 Incendie', medical: '🚑 Urgence médicale', robbery: '🚨 Braquage', fight: '👊 Bagarre' };
    h += list.map((i) => `<div class="card row sp"><div><b>${lab[i.type]}</b><div class="small dim">Depuis ${Math.round(i.age)} s</div></div><button class="btn sm" onclick="Phone.a('incwp',${i.id})">📍 GPS</button></div>`).join('');
    const jobok = ['police', 'fire', 'ems'].includes(P.job);
    h += `<div class="card small dim">${jobok ? (P.onDuty ? 'Vous êtes en service : les appels vous sont adressés en priorité.' : 'Prenez votre service pour recevoir les appels.') : 'Les services d\'urgence gèrent ces interventions. Vous pouvez aider si vous passez par là…'}</div>`;
    return h + '</div>';
  },
  // ---------- Actus ----------
  news() {
    const hist = G.eco.hist; const E = Eco.stats();
    let h = hd('📰 Actus & Éco') + '<div class="ph-pad">';
    h += '<div class="card"><b>Évolution des prix (indice)</b>' + Phone.spark(hist.map((x) => x.avg), '#f59e0b') + '</div>';
    h += '<div class="card"><b>Chômage</b>' + Phone.spark(hist.map((x) => x.un * 100), '#ef4444') + `<div class="small dim">Actuel : ${(E.unemp * 100).toFixed(0)} %</div></div>`;
    h += '<div class="card"><b>Trésor public</b>' + Phone.spark(hist.map((x) => x.tr), '#34d399') + `<div class="small dim">${money(E.treasury)}</div></div>`;
    h += G.news.map((n) => `<div class="card small"><span class="dim">Jour ${n.d}</span><br>${esc(n.t)}</div>`).join('');
    return h + '</div>';
  },
  settings() {
    let h = hd('⚙️ Réglages') + '<div class="ph-pad">';
    h += `<div class="card"><b>Écoulement du temps</b><div class="small dim">Heure actuelle : ${dayStr()} ${timeStr()}</div><div class="row" style="flex-wrap:wrap;margin-top:8px"><button class="btn sm ${G.mode === 'accel' ? '' : 'alt'}" onclick="Phone.a('mode','accel')">⏩ 10 min = 1 h</button><button class="btn sm ${G.mode === 'real' ? '' : 'alt'}" onclick="Phone.a('mode','real')">🕰️ Temps réel (heure de l'appareil)</button></div></div>`;
    h += `<div class="card row sp"><span>Pause quand le téléphone est ouvert</span><button class="btn sm ${G.settings.pausePhone ? '' : 'alt'}" onclick="Phone.a('pausetog')">${G.settings.pausePhone ? 'Oui' : 'Non'}</button></div>`;
    h += `<div class="card row sp"><span>Volume</span><span><button class="btn sm alt" onclick="Phone.a('vol',-1)">−</button> ${Math.round(G.settings.vol * 100)} % <button class="btn sm alt" onclick="Phone.a('vol',1)">+</button></span></div>`;
    h += `<div class="card"><button class="btn" onclick="Phone.a('save')">💾 Sauvegarder</button> <button class="btn bad" onclick="Phone.a('reset')">🗑️ Nouvelle partie</button></div>`;
    h += `<div class="card small dim">Commandes clavier : ZQSD/WASD déplacer · E action · F véhicule · Espace attaquer/sirène · Maj courir/frein · P téléphone · I sac</div>`;
    return h + '</div>';
  },
};
Phone.ago = (t) => { const m = Math.max(0, G.t - t); return m < 60 ? Math.round(m) + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' j'; };
Phone.spark = (arr, col) => {
  if (arr.length < 2) return '<div class="small dim">Données insuffisantes (attendez quelques jours).</div>';
  const mn = Math.min(...arr), mx = Math.max(...arr), rg = mx - mn || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1)) * 300},${50 - ((v - mn) / rg) * 44 - 3}`).join(' ');
  return `<svg viewBox="0 0 300 50" style="width:100%;height:60px"><polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5"/></svg>`;
};
Phone.taxiFare = () => P.wp ? Math.round(6 + Math.hypot(P.wp.x - P.x, P.wp.y - P.y) / TS * 0.18) : 0;

const Actions = {
  thread(name) { Phone.state.thread = name.replace(/&#39;/g, "'"); },
  newthread(id) { const n = G.npcs[id]; G.msgs[n.name] = G.msgs[n.name] || { name: n.name, msgs: [], unread: 0, npc: n.id, col: n.col, last: G.t }; Phone.state.app = 'messages'; Phone.state.thread = n.name; },
  msgact(key) { Phone.doAction(key); },
  quick(txt) { Phone.sendTo(Phone.state.thread, txt); },
  sendtxt() { const i = $('msg-in'); if (i && i.value.trim()) Phone.sendTo(Phone.state.thread, i.value.trim()); },
  where() {
    const th = G.msgs[Phone.state.thread]; const n = G.npcs[th.npc]; Phone.sendTo(th.name, 'Tu es où là ?', true);
    setTimeout(() => {
      const wh = typeof n.loc === 'number' ? W.buildings[n.loc] : null;
      const txt = wh ? `Je suis à ${wh.name}.` : n.loc === 'out' ? 'Je me balade dehors.' : 'Je préfère ne pas le dire.';
      th.msgs.push({ me: false, text: txt, t: G.t }); th.unread++;
      if (wh) { const f = frontPx(wh); P.wp = { x: f.x, y: f.y, label: n.name + ' — ' + wh.name }; } else if (n.loc === 'out') P.wp = { x: n.x, y: n.y, label: n.name };
      Phone.refresh();
    }, 1500);
  },
  gift() {
    const th = G.msgs[Phone.state.thread]; const n = G.npcs[th.npc];
    if (!Eco.charge(P, 50)) { toast('Fonds insuffisants.', 'bad'); return; }
    n.bank += 50; n.rel = clamp(n.rel + 8, -100, 100); n.aff = Math.min(100, (n.aff || 0) + 4); Phone.sendTo(th.name, 'Je t\'ai envoyé un petit cadeau 🎁', true);
  },
  datemenu() {
    const th = G.msgs[Phone.state.thread]; const n = G.npcs[th.npc];
    const opts = [['restaurant', '🍝 Restaurant'], ['bar', '🍺 Bar'], ['club', '🪩 Boîte de nuit']];
    UI.menu(`💞 Rencard avec ${n.first}`, 'Choisissez le lieu — le rendez-vous est fixé dans 2 h.', opts.map(([k, l]) => ({ label: l, fn: () => Dating.propose(n, k) })).concat([{ label: '🌳 Balade au parc', fn: () => Dating.propose(n, 'park') }]));
    Phone.close();
  },
  swipe(like) {
    const n = Dating.current(); if (!n) return;
    Dating.idx++;
    if (like) {
      const p = clamp(0.2 + P.charm / 220 + n.soc * 0.15 + (n.rel > 0 ? 0.1 : 0) - (n.partner ? 0.5 : 0), 0.05, 0.85);
      if (chance(p)) { n.matched = true; n.known = true; n.aff = n.aff || 5; toast(`💞 Match avec <b>${esc(n.first)}</b> !`, 'good'); Snd.good(); G.msgs[n.name] = G.msgs[n.name] || { name: n.name, msgs: [], unread: 0, npc: n.id, col: n.col, last: G.t }; G.msgs[n.name].msgs.push({ me: false, text: pick([`Salut ${P.name.split(' ')[0]} ! On a matché 😊`, 'Hey ! Ton profil m\'a tapé dans l\'œil.', 'Coucou ! Tu fais quoi de beau ?']), t: G.t }); G.msgs[n.name].unread++; Phone.refreshBadge(); }
    }
  },
  like(id) { const p = G.posts.find((q) => q.id === id); if (!p) return; p.liked = !p.liked; p.likes += p.liked ? 1 : -1; if (p.liked && p.who !== 'me') G.npcs[p.who].rel += 1; },
  follow(id) { const n = G.npcs[id]; n.followed = !n.followed; if (n.followed) n.rel += 2; },
  dm(id) { Actions.newthread(id); },
  postcam() { Social.post(true); },
  posttxt() { Social.post(false); },
  sponsor() { Social.sponsor(); },
  datego() { const d = P.date; const b = W.buildings[d.bid]; const f = frontPx(b); P.wp = { x: f.x, y: f.y, label: 'Rencard' }; toast('📍 GPS défini.'); },
  datecancel() { Dating.cancel(); },
  setwp(bid) { const b = W.buildings[bid]; const f = frontPx(b); P.wp = { x: f.x, y: f.y, label: b.name }; toast('📍 ' + b.name); },
  setveh(id) { const v = Veh.byId(+id); if (v) { P.wp = { x: v.x, y: v.y, label: VEH[v.type].n }; toast('📍 Véhicule localisé.'); } },
  clearwp() { P.wp = null; },
  taxi() {
    if (!P.wp) return; if (P.heat > 0) { toast('Le chauffeur refuse de vous prendre (la police vous cherche).', 'bad'); return; }
    if (P.veh) { toast('Descendez de votre véhicule.', 'warn'); return; }
    const f = Phone.taxiFare(); if (!Eco.charge(P, f)) { toast('Fonds insuffisants.', 'bad'); return; }
    G.eco.treasury += f * 0.1; const wp = P.wp; Phone.close();
    UI.fade('🚕 En route…', 1500, () => { if (G.scene !== 'out') { Interior.unload(); G.scene = 'out'; } const pos = Veh.nearestFree(wp.x, wp.y, 8); P.x = pos.x; P.y = pos.y; });
  },
  apply(job) { const e = Jobs.apply(job); if (e) toast(e, 'bad'); else toast('✅ Candidature acceptée !', 'good'); },
  quit() { UI.confirm('Démissionner ?', 'Vous perdrez votre grade.', 'Démissionner', 'Annuler', () => { Jobs.quit(); Phone.render(); }); },
  thire(id) { const n = G.npcs[id]; NPC.hire(n, P.job, P.empBid, 0); toast(`${n.name} est embauché(e).`, 'good'); },
  tfire(id) { const n = G.npcs[id]; NPC.fire(n); toast(`${n.name} est licencié(e).`, 'warn'); },
  tpromo(id) { const n = G.npcs[id]; if (n.jr < P.jobRank - 1) { n.jr++; toast(`${n.name} promu(e).`, 'good'); } },
  tdemo(id) { const n = G.npcs[id]; if (n.jr > 0) { n.jr--; toast(`${n.name} rétrogradé(e).`); } },
  gpromo(id) { const e = Gangs.promote(G.npcs[id]); toast(e || 'Promotion accordée.', e ? 'warn' : 'good'); },
  gdemo(id) { const e = Gangs.demote(G.npcs[id]); toast(e || 'Rétrogradation effectuée.', e ? 'warn' : ''); },
  gfire(id) { const n = G.npcs[id]; UI.confirm('Renvoyer', `Exclure ${n.name} du gang ? Il/elle risque de vous en vouloir.`, 'Renvoyer', 'Non', () => { const e = Gangs.fire(n); toast(e || `${n.name} est exclu(e).`, e ? 'warn' : ''); Phone.render(); }); },
  grecruit(id) { const e = Gangs.recruit(G.npcs[id]); toast(e || `${G.npcs[id].name} rejoint le gang !`, e ? 'warn' : 'good'); },
  tribute(d) { const g = Gangs.G(); g.tribute = clamp(g.tribute + d * 0.05, 0.05, 0.4); },
  missionwp() { Missions.setWp(); toast('📍 GPS mis à jour.'); },
  missioncancel() { Missions.cancel(); Gangs.addRespect(-10); },
  incwp(id) { const i = G.incidents.find((q) => q.id === +id); if (i) { P.wp = { x: i.x, y: i.y, label: 'Intervention' }; toast('📍 GPS défini.'); } },
  mode(m) {
    G.mode = m;
    if (m === 'real') { const d = new Date(); G.t = Math.floor(G.t / 1440) * 1440 + d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; toast('🕰️ Temps réel : 1 min de jeu = 1 min réelle (heure de votre appareil).'); }
    else toast('⏩ Temps accéléré : 10 min réelles = 1 h de jeu.');
  },
  pausetog() { G.settings.pausePhone = !G.settings.pausePhone; },
  vol(d) { G.settings.vol = clamp(Math.round((G.settings.vol + d * 0.1) * 10) / 10, 0, 1); },
  save() { Save.save(true); },
  reset() { UI.confirm('Nouvelle partie', 'Toute la progression sera perdue.', 'Recommencer', 'Annuler', () => { Save.clear(); location.reload(); }); },
};
Phone.sendTo = function (name, text, silentMe) {
  const th = G.msgs[name]; if (!th) return;
  th.msgs.push({ me: true, text, t: G.t }); th.last = G.t;
  const n = th.npc != null ? G.npcs[th.npc] : null;
  if (n) {
    n.rel = clamp(n.rel + 1, -100, 100);
    setTimeout(() => {
      let r;
      const low = text.toLowerCase();
      if (silentMe) { Phone.refresh(); return; }
      if (/resto|dîner|diner|manger/.test(low)) r = n.rel > 5 ? 'Avec plaisir ! Propose-moi un rencard depuis l\'appli 😉' : 'Peut-être un jour…';
      else if (/soir|sortir|boire|club/.test(low)) r = n.rel > 5 ? 'Carrément, ça me tente !' : 'On verra.';
      else if (/je t'aime|bébé|chéri/.test(low)) r = n.aff > 60 ? '❤️❤️' : 'Hé, doucement ! 😅';
      else r = n.rel > 30 ? pick(['Haha, tu me fais rire 😄', 'Toujours un plaisir de te lire !', 'Je pensais justement à toi.']) : n.rel < -10 ? pick(['Laisse-moi tranquille.', '...']) : pick(['Ok 🙂', 'Je suis un peu occupé(e), je te réponds plus tard.', 'Sympa !']);
      th.msgs.push({ me: false, text: r, t: G.t }); th.unread++; th.last = G.t;
      if (Phone.isOpen()) { if (Phone.state.thread === name) th.unread = 0; Phone.render(); } else toast(`📩 <b>${esc(n.name)}</b> : ${esc(r)}`);
      Phone.refreshBadge();
    }, 1200 + Math.random() * 1600);
  }
};

// ================= Dating =================
const Dating = {
  idx: 0, list: null,
  current() {
    if (!Dating.list || Dating.idx >= Dating.list.length) { Dating.list = G.npcs.filter((n) => !n.matched && !n.partner && n.state !== 'dead' && n.loc !== 'prison' && n.age >= 18).sort(() => Math.random() - 0.5).slice(0, 12); Dating.idx = 0; }
    return Dating.list[Dating.idx];
  },
  propose(n, kind) {
    const k = kind === 'park' ? 'park' : kind;
    let b = kind === 'park' ? null : nearestOfKind(k, P);
    if (kind === 'park') b = null;
    const at = G.t + 120;
    if (b) { P.date = { npc: n.id, bid: b.id, at, kind }; n.override = { key: 'b' + b.id, from: at - 25, until: at + 200 }; }
    else { const poi = n.fav.park; P.date = { npc: n.id, bid: null, poi, at, kind }; n.override = { key: poi, from: at - 20, until: at + 200 }; }
    n.destKey = null;
    const name = b ? b.name : 'le parc';
    Phone.sendTo(n.name, `Et si on se voyait à ${name} dans 2 h ?`, true);
    setTimeout(() => { const th = G.msgs[n.name]; th.msgs.push({ me: false, text: n.rel > -5 ? `Ok, c'est noté ! À tout à l'heure à ${name} 😊` : 'Hmm, ok…', t: G.t }); th.unread++; Phone.refreshBadge(); toast(`💞 Rencard fixé avec ${esc(n.first)} (${name}) dans 2 h.`, 'good'); }, 1400);
    toast('Rencard proposé...');
  },
  cancel() { if (P.date) { const n = G.npcs[P.date.npc]; n.override = null; n.rel -= 8; P.date = null; toast('Rencard annulé.'); } },
  venue(b) {
    const d = P.date; if (!d || d.bid !== b.id) return;
    const n = G.npcs[d.npc];
    if (n.loc === b.id) toast(`💞 ${esc(n.first)} est là ! Asseyez-vous à une table pour commencer.`, 'good');
    else toast(`${esc(n.first)} n'est pas encore arrivé(e)…`, 'warn');
  },
  sit(b) {
    const d = P.date;
    if (!d || d.bid !== b.id) {
      UI.progress('Vous vous asseyez un moment…', 4, () => { P.fun = clamp(P.fun + 5, 0, 100); P.ene = clamp(P.ene + 2, 0, 100); });
      return;
    }
    const n = G.npcs[d.npc];
    if (n.loc !== b.id) { toast(`${esc(n.first)} n'est pas encore là.`, 'warn'); return; }
    const items = [];
    const price = b.kind === 'restaurant' ? 'meal' : 'cocktail';
    items.push({ label: b.kind === 'restaurant' ? '🍝 Dîner à deux' : '🍸 Commander à boire', sub: 'Paie pour deux', right: money(Eco.price(price) * 2), fn: () => {
      if (!Eco.sale(b.id, price, 2, P)) { toast('Pas assez d\'argent !', 'bad'); return; }
      P.hun = clamp(P.hun + 40, 0, 100); if (price === 'cocktail') P.alc = clamp(P.alc + 15, 0, 100);
      n.aff = clamp((n.aff || 5) + randi(8, 16), 0, 100); n.rel += 10; P.fun = clamp(P.fun + 15, 0, 100); toast(`${esc(n.first)} apprécie. Affinité ${Math.round(n.aff)}/100`, 'good');
    } });
    items.push({ label: '💬 Discuter longuement', fn: () => UI.progress('Vous discutez…', 6, () => { n.aff = clamp((n.aff || 5) + randi(4, 9), 0, 100); n.rel += 6; toast(`Bonne conversation. Affinité ${Math.round(n.aff)}/100`, 'good'); }) });
    if ((n.aff || 0) >= 75 && !n.partner && P.partner == null) items.push({ label: '💍 Proposer d\'être en couple', fn: () => {
      if (chance(0.5 + (n.aff - 75) / 60)) { n.partner = true; P.partner = n.id; n.rel = 60; toast(`💍 ${esc(n.name)} accepte ! Vous êtes en couple.`, 'good'); Snd.good(); P.charm += 3; } else { toast('Pas encore prêt(e)…', 'warn'); n.aff -= 8; }
    } });
    items.push({ label: '✅ Terminer le rencard', fn: () => { n.override = null; P.date = null; n.destKey = null; toast('Rencard terminé.'); } });
    UI.menu(`💞 ${n.name}`, `Affinité : ${Math.round(n.aff || 0)}/100`, items);
  },
  hangout(n) {
    if (G.t - (n.hangT || -999) < 240) { toast('Vous avez déjà passé du temps ensemble récemment.', 'warn'); return; }
    UI.progress('Vous passez du temps ensemble…', 5, () => { n.hangT = G.t; n.aff = clamp((n.aff || 5) + 4, 0, 100); n.rel += 5; P.fun = clamp(P.fun + 8, 0, 100); toast(`💞 Affinité avec ${esc(n.first)} : ${Math.round(n.aff)}`, 'good'); });
  },
  update() {
    const d = P.date; if (!d) return;
    if (G.t > d.at + 90) {
      const n = G.npcs[d.npc];
      if (!(G.scene === d.bid)) { n.rel -= 25; n.aff = Math.max(0, (n.aff || 5) - 15); n.override = null; n.destKey = null; Msg.push(n.name, 'Je t\'ai attendu... Tu ne viens pas ? C\'est pas cool.', { npc: n.id }); toast('Vous avez posé un lapin à votre rencard !', 'bad'); }
      P.date = null;
    }
  },
};

// ================= Instagram =================
const Social = {
  post(withPhoto) {
    const cap = ($('cap') ? $('cap').value : '') || pick(['Ma vie en ce moment ✨', 'Vibes 😎', 'Ville de nuit 🌃', 'Pas mal le coin !']);
    if (_rt - P.lastPostT < 90) { toast('Vous publiez trop vite !', 'warn'); return; }
    let img = null;
    if (withPhoto) { Phone.close(); img = RP.snapshot ? RP.snapshot() : null; Phone.open('insta'); Phone.state.tab = 0; }
    P.lastPostT = _rt;
    const post = { id: G.uid++, who: 'me', cap, img, likes: 0, liked: false, t: G.t, bg: null, emoji: '📷', boost: 1 };
    let q = 1 + P.charm / 60 + (Player.inVeh() && VEH[Player.inVeh().type].price > 30000 ? 1 : 0) + (G.scene !== 'out' && ['club', 'mafia'].includes(Interior.b.kind) ? 0.8 : 0) + (P.gang ? 0.3 : 0);
    post.target = Math.round((8 + P.followers * 0.08) * q * rand(0.7, 1.4)); post.grow = 0;
    G.posts.unshift(post); if (G.posts.length > 40) G.posts.pop();
    toast('📸 Publication en ligne !', 'good');
  },
  sponsor() {
    const pay = Math.round(80 + P.followers * 0.06); P.bank += pay; P.lastSponsor = G.t; G.eco.treasury -= 0;
    const post = { id: G.uid++, who: 'me', cap: '#pub Un burger au Fast Fast Food, c\'est la vie 🍔', img: null, bg: 'linear-gradient(135deg,#ef4444,#f59e0b)', emoji: '🍔', likes: 0, liked: false, t: G.t, target: Math.round(P.followers * 0.12), grow: 0 };
    G.posts.unshift(post); toast(`🤝 Partenariat : +${money(pay)}`, 'good'); P.charm += 0.5;
  },
  tick(dtReal) {
    for (const p of G.posts) if (p.who === 'me' && p.target && p.grow < p.target) {
      const inc = Math.max(1, Math.round(p.target * dtReal / 40)); p.grow += inc; p.likes += inc; P.followers += Math.round(inc * 0.12 + (Math.random() < 0.3 ? 1 : 0));
    }
  },
  npcPost() {
    const cands = G.npcs.filter((n) => n.state !== 'dead' && n.loc !== 'prison');
    const n = pick(cands); const b = typeof n.loc === 'number' ? W.buildings[n.loc] : null;
    let cap, emoji, bg;
    if (b) { const m = { fastfood: ['Pause burger au Fast Fast Food 🍔', '🍔', '#ef4444,#f59e0b'], restaurant: ['Dîner au resto 🍝', '🍝', '#a16207,#7c2d12'], bar: ['Un verre entre amis 🍻', '🍻', '#78350f,#b45309'], club: ['Ce soir on met le feu 🪩', '🪩', '#7e22ce,#db2777'], mafia: ['Soirée privée 🥃', '🥃', '#1e1b4b,#4c1d95'], biker: ['Run de moto ce week-end 🏍️', '🏍️', '#9a3412,#1f2937'], store: ['Courses ! 🛒', '🛒', '#0f766e,#14b8a6'], house: ['Cocooning à la maison 🛋️', '🛋️', '#1e293b,#475569'], bank: ['Rendez-vous à la banque 💼', '💼', '#334155,#64748b'] }[b.kind]; if (m) { cap = m[0]; emoji = m[1]; bg = `linear-gradient(135deg,${m[2]})`; } }
    if (!cap) { cap = pick(['Belle balade 🌳', 'Journée tranquille ☀️', 'En route ! 🚶']); emoji = '🌳'; bg = 'linear-gradient(135deg,#166534,#4ade80)'; }
    G.posts.unshift({ id: G.uid++, who: n.id, cap, emoji, bg, likes: randi(3, Math.max(5, Math.round(n.followers / 25))), liked: false, t: G.t });
    if (G.posts.length > 40) G.posts.pop();
  },
};
