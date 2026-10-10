'use strict';
// ===== Actes civils : maison, commerces, bars, clubs, banque, concession =====
const Bank = {
  menu(b) {
    const items = [];
    const L = P.loan;
    items.push({ label: '📥 Déposer toutes les espèces', sub: money(P.cash), disabled: P.cash < 1, fn: () => { const a = Math.floor(P.cash); P.cash -= a; P.bank += a; toast(`${money(a)} déposés.`, 'good'); } });
    for (const a of [100, 500, 2000]) items.push({ label: `📤 Retirer ${money(a)}`, disabled: P.bank < a, fn: () => { P.bank -= a; P.cash += a; toast(`${money(a)} retirés.`); } });
    const lim = Eco.loanLimit();
    if (b.kind === 'bank') {
      if (L) items.push({ label: '💳 Rembourser le prêt', sub: `Restant dû : ${money(L.owed)} (mensualité ${money(L.daily)}/jour)`, fn: () => { const p = Math.min(L.owed, P.bank + P.cash); Eco.charge(P, p); L.owed -= p; G.biz[b.id].cash += p; if (L.owed <= 0.5) P.loan = null; toast(`${money(p)} remboursés.`, 'good'); } });
      for (const a of [1000, 3000, 8000]) items.push({ label: `🏦 Emprunter ${money(a)}`, sub: `Taux ≈ 10 % · plafond conseillé : ${money(lim)}`, disabled: !!L && L.late > 0 || a > lim * 2, fn: () => { const e = Eco.takeLoan(a); if (e) toast(e, 'bad'); else { toast(`Prêt de ${money(a)} accordé (remboursement automatique quotidien).`, 'good'); P.stats.loans++; } } });
    }
    UI.menu('🏦 Services bancaires', `Espèces : ${money(P.cash)} · Compte : ${money(P.bank)}${L ? ` · Dette : ${money(L.owed)}` : ''}`, items);
  },
};
Acts.atm = (f, b) => Bank.menu(b);
Acts.bank_teller = (f, b) => Bank.menu(b);
Acts.bank_desk = (f, b) => Jobs.bank.desk(b);

Acts.sleep = (f, b) => {
  if (b.id !== P.homeBid) { toast('Ce n\'est pas votre lit.', 'warn'); return; }
  UI.menu('🛏️ Se reposer', `Énergie ${Math.round(P.ene)}% · il est ${timeStr()}`, [
    { label: '😴 Dormir jusqu\'au matin (7 h)', sub: 'Le temps s\'écoule vite (touchez pour vous réveiller)', fn: () => Sleep.start('maison', 8, true) },
    { label: '💤 Sieste (2 h)', fn: () => Sleep.start('sieste', 2) },
    { label: '⏳ Attendre 1 h', fn: () => Sleep.start('attente', 1) },
  ]);
};
Acts.wardrobe = () => {
  const cols = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#111827', '#f8fafc'];
  UI.menu('👕 Garde-robe', 'Choisissez une couleur de haut', cols.map((c) => ({ label: `<span style="display:inline-block;width:16px;height:16px;border-radius:50%;background:${c};vertical-align:middle;margin-right:8px;border:1px solid #fff5"></span>Tenue ${c}`, fn: () => { P.col = c; toast('Nouvelle tenue !'); } })));
};
Acts.fridge = (f, b) => {
  if (b.id !== P.homeBid) { toast('Le frigo des autres ne vous appartient pas.', 'warn'); return; }
  const food = Object.keys(P.inv).filter((k) => ITEMS[k] && (ITEMS[k].cat === 'food' || ITEMS[k].cat === 'drink'));
  if (!food.length) { toast('Le frigo est vide. Achetez des courses à la supérette.', 'warn'); return; }
  UI.menu('🧊 Frigo', 'Manger ce qu\'il y a dans votre sac', food.map((k) => ({ label: `${ITEMS[k].e} ${ITEMS[k].n}`, right: '×' + P.inv[k], fn: () => Shop.consume(k) })));
};
Acts.sofa = () => UI.progress('Détente…', 5, () => { P.fun = clamp(P.fun + 14, 0, 100); P.ene = clamp(P.ene + 3, 0, 100); toast('😌 Ça repose.'); });
Acts.tv = () => UI.progress('Vous regardez la télé…', 6, () => { P.fun = clamp(P.fun + 18, 0, 100); toast('📺 Bonne série !'); });
Acts.pc = () => Phone.open('insta');
Acts.shower = (f, b) => { if (b.id !== P.homeBid) { toast('Pas chez les autres !', 'warn'); return; } UI.progress('Douche…', 4, () => { P.charm = Math.min(100, P.charm + 0.5); P.fun = clamp(P.fun + 3, 0, 100); toast('🚿 Frais et propre.'); }); };
Acts.stash = (f, b) => {
  if (b.id === P.homeBid) {
    P.stash = P.stash || { cash: 0, inv: {} };
    const items = [
      { label: '📥 Cacher des espèces', sub: `Cachette : ${money(P.stash.cash)}`, disabled: P.cash < 1, keep: false, fn: () => { P.stash.cash += Math.floor(P.cash); P.cash -= Math.floor(P.cash); toast('Espèces cachées.'); } },
      { label: '📤 Récupérer les espèces', disabled: P.stash.cash < 1, fn: () => { P.cash += P.stash.cash; P.stash.cash = 0; toast('Espèces récupérées.'); } },
    ];
    for (const k of ['pistol', 'ammo', 'colis', 'lockpick', 'mask']) {
      if (P.inv[k]) items.push({ label: `Cacher : ${ITEMS[k].e} ${ITEMS[k].n}`, fn: () => { P.stash.inv[k] = (P.stash.inv[k] || 0) + P.inv[k]; delete P.inv[k]; if (k === 'pistol') P.weapon = 'fists'; } });
      if (P.stash.inv[k]) items.push({ label: `Reprendre : ${ITEMS[k].e} ${ITEMS[k].n}`, right: '×' + P.stash.inv[k], fn: () => { P.inv[k] = (P.inv[k] || 0) + P.stash.inv[k]; delete P.stash.inv[k]; } });
    }
    UI.menu('🧰 Cachette', 'Les objets illégaux y sont à l\'abri des fouilles.', items); return;
  }
  // cambriolage
  if (P.burglary !== b.id) { toast('Coffre verrouillé.', 'warn'); return; }
  if (b.lootedDay === dayN()) { toast('Déjà fouillé aujourd\'hui.'); return; }
  UI.progress('Fouille du logement…', 7, () => {
    b.lootedDay = dayN(); const res = G.npcs.filter((n) => n.home === b.id);
    let loot = 0; for (const n of res) { const t = Math.min(n.money + n.bank * 0.1, randi(80, 400)); Eco.charge(n, t); loot += t; }
    loot = Math.round(loot); P.cash += loot; if (chance(0.15)) { Inv.add('pistol'); toast('Vous trouvez aussi un pistolet !', 'good'); }
    Wanted.crime(1.2, 'cambriolage', true); toast(`💰 Butin : ${money(loot)}`, 'good'); for (const n of res) n.rel -= 40;
  }, { onCancel: () => { } });
};

// commerces
Acts.menu = (f, b) => { Dating.venue(b); Shop.open(b, ['meal', 'water', 'soda', 'beer', 'cocktail'], '🍝 ' + b.name, { eat: true }); };
Acts.robItem = (b) => {
  const rm = P.mission && P.mission.type === 'rob_store' && P.mission.stage === 0 && P.mission.data.bid === b.id;
  return { label: '🔫 Braquer la caisse', sub: rm ? 'Mission en cours' : (P.weapon === 'pistol' ? 'Avec votre pistolet' : 'Sans arme, c\'est risqué'), fn: () => {
    UI.progress('Vous menacez la caissière…', P.weapon === 'pistol' ? 4 : 8, () => {
      const biz = G.biz[b.id]; const loot = Math.round(Math.min(Math.max(biz.cash, 0), randi(300, 900)) * (P.weapon === 'pistol' ? 1 : 0.5));
      biz.cash -= loot; P.cash += loot; Wanted.crime(2, 'braquage', false); P.cool = 0;
      toast(`💰 Butin : ${money(loot)} — fuyez !`, 'good');
      if (rm) { P.mission.stage = 1; P.mission.data.loot = loot; Missions.setWp(); }
      for (const e of Interior.list) if (e.role === 'staff') NPC.say(e.n, 'Ne me faites pas de mal !', 3);
    });
  } };
};
Acts.shop = (f, b) => {
  UI.menu('🛒 Caisse', b.name, [{ label: '🛒 Faire des achats', fn: () => Shop.open(b, ['water', 'soda', 'burger', 'grocery', 'medkit', 'fuelcan', 'outfit'], '🛒 ' + b.name) }, Acts.robItem(b)]);
};
Acts.shop_gas = (f, b) => UI.menu('⛽ ' + b.name, 'Caisse', [{ label: '🛒 Acheter', fn: () => Shop.open(b, ['water', 'soda', 'burger', 'fuelcan', 'lockpick'], '⛽ ' + b.name) }, Acts.robItem(b)]);
Acts.sit = (f, b) => { Dating.sit(b); };
Acts.jukebox = () => { P.fun = clamp(P.fun + 4, 0, 100); Snd.beep(520, 0.2, 'triangle', 0.06); setTimeout(() => Snd.beep(660, 0.2, 'triangle', 0.06), 220); setTimeout(() => Snd.beep(784, 0.3, 'triangle', 0.06), 440); toast('🎵 Une chanson démarre…'); };
Acts.darts = (f, b) => {
  UI.menu('🎯 Fléchettes', 'Pariez contre un habitué', [10, 50].map((bet) => ({ label: `Miser ${money(bet)}`, fn: () => {
    if (!Eco.charge(P, bet)) { toast('Pas assez d\'argent.', 'bad'); return; }
    if (chance(0.4 + P.skills.shoot * 0.02)) { P.cash += bet * 2; toast(`🎯 Gagné ! +${money(bet)}`, 'good'); } else toast('🎯 Perdu…', 'bad'); P.fun = clamp(P.fun + 5, 0, 100);
  } })));
};
Acts.pool = (f, b) => {
  UI.menu('🎱 Billard', 'Défiez un biker', [{ label: `Parier ${money(100)}`, fn: () => { if (!Eco.charge(P, 100)) { toast('Pas assez d\'argent.', 'bad'); return; } if (chance(0.42)) { P.cash += 200; toast('🎱 Gagné !', 'good'); if (P.gang === 'bikers') Gangs.addRespect(4); } else toast('🎱 Perdu.', 'bad'); P.fun = clamp(P.fun + 5, 0, 100); } }]);
};
Acts.bar_order = (f, b) => {
  Shop.open(b, ['beer', 'cocktail', 'water', 'soda'], '🍺 ' + b.name, { eat: true });
};
Acts.dance = (f, b) => {
  UI.progress('Vous dansez !', 6, () => {
    P.fun = clamp(P.fun + 14, 0, 100); P.ene = Math.max(0, P.ene - 3); P.charm = Math.min(100, P.charm + 0.4);
    const near = Interior.list.filter((e) => !e.ghost && !e.n.ghost && Math.hypot(e.x - P.x, e.y - P.y) < 100 && e.role !== 'staff');
    if (near.length) { const e = pick(near); e.n.rel = clamp(e.n.rel + 6, -100, 100); toast(`💃 ${e.n.name} danse avec vous.`, 'good'); }
    else toast('💃 Quelle ambiance !');
    P.followers += 2;
  }, { free: false });
};
Acts.vip = (f, b) => {
  UI.confirm('Table VIP', 'Bouteille et service pour 300 € : rencontrez du monde et gagnez en réputation.', 'Réserver', 'Non', () => {
    if (!Eco.sale(b.id, 'cocktail', 6, P)) { toast('Pas assez d\'argent.', 'bad'); return; }
    P.fun = clamp(P.fun + 30, 0, 100); P.charm = Math.min(100, P.charm + 2); P.alc = clamp(P.alc + 25, 0, 100); P.followers += 25;
    const cands = G.npcs.filter((n) => !n.known && n.state !== 'dead' && n.looks > 50); const n = pick(cands);
    if (n) { n.known = true; n.rel += 15; Msg.push(n.name, `Salut, c'était sympa de te croiser au club ! (numéro enregistré)`, { npc: n.id }); }
  });
};
Acts.dj = () => { P.fun = clamp(P.fun + 3, 0, 100); toast('🎧 Le DJ vous fait un clin d\'œil.'); };
Acts.rest = () => Sleep.start('caserne', 3);
Acts.dealer_desk = (f, b) => Dealer.menu(b);

// ----- fast food -----
Acts.ff_counter = (f, b) => Jobs.ff.counter(b);
Acts.ff_grill = () => Jobs.ff.station('burger', 3.2);
Acts.ff_fryer = () => Jobs.ff.station('fries', 2.4);
Acts.ff_drink = () => Jobs.ff.station('soda', 1.6);

// ----- concession -----
const Dealer = {
  menu(b) {
    const items = [];
    for (const t of ['scooter', 'compact', 'car', 'moto', 'chopper', 'van', 'sport']) {
      const pr = Eco.vehPrice(t);
      items.push({ label: `${VEH[t].emoji} ${VEH[t].n}`, sub: `Vitesse ${VEH[t].max} · Réservoir ${VEH[t].fuel} L`, right: money(pr), fn: () => {
        if (P.ownV.length >= 5) { toast('Vous avez déjà 5 véhicules : vendez-en un.', 'warn'); return; }
        UI.confirm('Achat', `Acheter ${VEH[t].n} pour ${money(pr)} ?`, 'Acheter', 'Non', () => {
          if (!Eco.charge(P, pr)) { toast('Fonds insuffisants (le virement bancaire est aussi accepté).', 'bad'); return; }
          Eco.income(b.id, pr);
          const fp = frontPx(b); const pos = Veh.nearestFree(fp.x + 40, fp.y + (b.face === 'N' ? -40 : 40), 16);
          const v = Veh.create(t, pos.x, pos.y, 0, { owner: 'player', col: pick(CAR_COLORS) }); P.ownV.push(v.id);
          toast(`🔑 ${VEH[t].n} livré(e) devant la concession.`, 'good'); Snd.good();
        });
      } });
    }
    const mine = P.ownV.map((id) => Veh.byId(id)).filter(Boolean);
    for (const v of mine) items.push({ label: `Vendre : ${VEH[v.type].emoji} ${VEH[v.type].n}`, sub: `Reprise à 55 % (${v.plate})`, right: money(Eco.vehPrice(v.type) * 0.55 * (0.4 + v.hp / 170)), fn: () => {
      const val = Eco.vehPrice(v.type) * 0.55 * (0.4 + v.hp / 170); const biz = G.biz[b.id]; if (biz.cash < val) { toast('Le concessionnaire n\'a pas les fonds.', 'warn'); return; }
      biz.cash -= val; P.cash += val; P.ownV = P.ownV.filter((i) => i !== v.id); if (P.veh === v.id) { P.veh = null; } Veh.remove(v); toast('Véhicule vendu.', 'good');
    } });
    UI.menu('🚘 Concession', `Espèces ${money(P.cash)} · Banque ${money(P.bank)}`, items);
  },
};
const BlackMarket = {
  open() {
    const g = P.gang; if (!g) return;
    const list = ['lockpick', 'mask', 'pistol', 'ammo', 'colis'];
    UI.menu('🕶️ Marché noir', 'Les bénéfices vont dans la caisse du gang', list.map((k) => ({ label: `${ITEMS[k].e} ${ITEMS[k].n}`, right: money(ITEMS[k].p), keep: true, disabled: P.gangRank < (k === 'pistol' ? 1 : 0), sub: k === 'pistol' ? 'Grade 2+' : '', fn: () => { if (!Eco.charge(P, ITEMS[k].p)) { toast('Fonds insuffisants.', 'bad'); return; } Gangs.G().treasury += ITEMS[k].p * 0.8; Inv.add(k); toast(`${ITEMS[k].e} acheté.`, 'good'); } })));
  },
};
const _gm2 = Acts.gang_meeting;
Acts.gang_meeting = (f, b) => {
  if (P.gang && GANGS[P.gang].hq === b.kind && !P.mission) {
    UI.menu('Que faire ?', '', [{ label: '🎯 Missions du gang', fn: () => _gm2(f, b) }, { label: '🕶️ Marché noir', fn: () => BlackMarket.open() }]);
  } else _gm2(f, b);
};
