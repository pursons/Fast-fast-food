'use strict';
// ===== État global + temps + économie reliée =====
const G = {
  t: 0, mode: 'accel', scene: 'out', npcs: [], vehicles: [], biz: {}, eco: null, gangs: {}, msgs: {}, posts: [],
  incidents: [], fires: [], loans: [], news: [], ff: 0, settings: { pausePhone: false, vol: 0.6, joy: 1 }, uid: 1, started: false,
};
const dayN = () => Math.floor(G.t / 1440);
const hourOf = () => Math.floor(G.t / 60) % 24;
const minOfDay = () => G.t % 1440;
const dowOf = () => dayN() % 7; // 0=Dim
const timeStr = () => { const m = Math.floor(minOfDay()); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const dayStr = () => DAYN[dowOf()];
const isNight = () => { const h = hourOf(); return h >= 21 || h < 6; };
const weekend = () => { const d = dowOf(); return d === 0 || d === 6; };
// minutes de jeu par seconde réelle
function minPerSec() {
  if (G.mode === 'real') return 1 / 60;
  return 0.1; // 10 min réelles = 1 h de jeu
}

const Eco = {
  init() {
    const it = {}, tgt = {};
    for (const k in ITEMS) { it[k] = 1; tgt[k] = 0; }
    G.eco = { treasury: 120000, pm: it, sold: Object.assign({}, tgt), infl: 0, taxRate: 0.1, hist: [], lastDay: dayN(), wholesale: 0, supply: 0, M0: 0, lastTreasury: 120000 };
    G.biz = {};
    for (const b of W.buildings) {
      if (['house', 'apt', 'prison', 'police', 'fire', 'hospital'].includes(b.kind)) continue;
      const base = { fastfood: 9000, restaurant: 8000, bar: 7000, club: 20000, bank: 300000, store: 9000, gas: 7000, dealer: 60000, office: 20000 }[b.kind] || 5000;
      G.biz[b.id] = { cash: base, base, rev: 0, exp: 0, revY: 0, wageMult: 1, name: b.name, strug: 0, visits: 0 };
    }
  },
  price(item) { return Math.max(1, Math.round(ITEMS[item].p * G.eco.pm[item] * (1 + G.eco.infl) * 10) / 10); },
  vehPrice(type) { return Math.round(VEH[type].price * (1 + G.eco.infl) / 50) * 50; },
  fuelPrice() { return Math.round(FUEL_PRICE * (1 + G.eco.infl) * 100) / 100; },
  // retire de l'argent à un acheteur (joueur ou PNJ)
  charge(buyer, amt) {
    if (buyer === P) {
      if (P.cash >= amt) { P.cash -= amt; return true; }
      if (P.cash + P.bank >= amt) { const rest = amt - P.cash; P.cash = 0; P.bank -= rest; return true; }
      return false;
    }
    if (buyer.money >= amt) { buyer.money -= amt; return true; }
    if (buyer.money + buyer.bank >= amt) { const rest = amt - buyer.money; buyer.money = 0; buyer.bank -= rest; return true; }
    return false;
  },
  credit(buyer, amt) { if (buyer === P) P.cash += amt; else buyer.money += amt; },
  // vente à un commerce (TVA -> État)
  sale(bid, item, qty, buyer) {
    const amt = Math.round(Eco.price(item) * qty * 100) / 100;
    if (!Eco.charge(buyer, amt)) return 0;
    Eco.income(bid, amt);
    G.eco.sold[item] = (G.eco.sold[item] || 0) + qty;
    return amt;
  },
  income(bid, amt) {
    const tax = amt * G.eco.taxRate / (1 + G.eco.taxRate);
    G.eco.treasury += tax;
    const biz = G.biz[bid];
    if (biz) { biz.cash += amt - tax; biz.rev += amt - tax; biz.visits++; }
  },
  // Paye un salaire depuis le compte de l'employeur : retourne le montant réellement versé
  pay(emp, bid, amt) {
    amt = Math.round(amt * 100) / 100;
    if (emp === 'state') {
      const ok = G.eco.treasury > -50000;
      const v = ok ? amt : amt * 0.6;
      G.eco.treasury -= v; return v;
    }
    const biz = G.biz[bid];
    if (!biz) return 0;
    const v = Math.min(amt * biz.wageMult, Math.max(0, biz.cash + 500) );
    biz.cash -= v; biz.exp += v; if (v < amt) biz.strug++;
    return v;
  },
  wageOf(job, rank) { return JOBS[job].pay[Math.min(rank, JOBS[job].pay.length - 1)] * (1 + G.eco.infl * 0.8); },
  // visite d'un PNJ dans un commerce
  onVisit(npc, b) {
    const k = b.kind;
    const buy = (item, q) => Eco.sale(b.id, item, q || 1, npc);
    if (k === 'fastfood') {
      const want = []; if (chance(0.8)) want.push('burger'); if (chance(0.55)) want.push('fries'); if (chance(0.8) || !want.length) want.push('soda');
      if (!want.length) return;
      if (G.scene === b.id && P.onDuty && P.job === 'fastfood' && P.empBid === b.id && Jobs.ff) { Jobs.ff.addTicket(npc, b, want); return; }
      let ok = false;
      for (const w of want) if (buy(w)) ok = true;
      if (ok) npc.hunger = 0;
    } else if (k === 'restaurant') { if (buy('meal')) npc.hunger = 0; if (chance(0.4)) buy('cocktail'); }
    else if (k === 'bar') { buy('beer', randi(1, 3)); if (chance(0.3)) buy('cocktail'); npc.drunk = true; }
    else if (k === 'club') { Eco.income(b.id, Eco.charge(npc, 15) ? 15 : 0); buy('cocktail', randi(1, 2)); npc.drunk = true; }
    else if (k === 'store') { if (chance(0.7)) buy('grocery'); else buy('water'); }
    else if (k === 'gas') { buy(pick(['soda', 'water', 'burger'])); }
    else if (k === 'bank') { if (G.scene === b.id && P.onDuty && P.job === 'banker' && Jobs.bank) Jobs.bank.addRequest(npc, b); else Eco.autoBank(npc, b); }
    else if (k === 'dealer') { if (chance(0.01) && npc.bank > 12000) { npc.bank -= 12000; Eco.income(b.id, 12000); } }
  },
  // décision de prêt automatique (hors joueur)
  loanRequest(npc) {
    const inc = npc.job && npc.job !== 'none' ? Eco.wageOf(npc.job, npc.jr) * 8 : (npc.sjob ? 70 : 20);
    const amt = Math.round((inc * randi(15, 60)) / 100) * 100;
    const debt = G.loans.filter((l) => l.npc === npc.id && !l.done).reduce((s, l) => s + l.amt, 0);
    const score = clamp(0.5 + inc / 800 - debt / (inc * 40 + 1) + (npc.crim - 0.3) * -0.4 + rand(-0.15, 0.15), 0, 1);
    return { npc, amt, inc, debt, score, risky: score < 0.42 };
  },
  autoBank(npc, b) {
    if (chance(0.15)) {
      const r = Eco.loanRequest(npc);
      if (r.score > 0.45) Eco.grantLoan(r, b.id, null);
    } else { npc.bank += npc.money > 150 ? 100 : 0; npc.money -= npc.money > 150 ? 100 : 0; }
  },
  grantLoan(r, bid, byPlayer) {
    const biz = G.biz[bid]; if (!biz || biz.cash < r.amt) return false;
    biz.cash -= r.amt; r.npc.bank += r.amt;
    G.loans.push({ npc: r.npc.id, amt: r.amt, rate: 0.12, due: dayN() + randi(4, 9), risky: r.risky, bid, byPlayer: !!byPlayer, done: false, issuedDay: dayN() });
    return true;
  },
  loanDaily() {
    for (const l of G.loans) {
      if (l.done) continue;
      if (dayN() < l.due) continue;
      const n = G.npcs[l.npc];
      const due = l.amt * (1 + l.rate);
      const biz = G.biz[l.bid];
      let paid = 0;
      if (n && !(l.risky && chance(0.7))) { const have = n.bank + n.money; paid = Math.min(have, due); Eco.charge(n, paid); }
      if (biz) biz.cash += paid;
      l.done = true;
      if (paid < due - 1) {
        l.default = true;
        if (l.byPlayer && P.job === 'banker') { P.jobXp = Math.max(0, P.jobXp - 40); Msg.push('Banque', `Le prêt accordé à ${n ? n.name : 'un client'} est en défaut (${money(due - paid)} perdus). Votre direction n'est pas contente. (-40 XP)`); }
      } else if (l.byPlayer && P.job === 'banker') { P.jobXp += 12; }
    }
    G.loans = G.loans.filter((l) => !l.done || dayN() - l.due < 3);
  },
  // tick quotidien
  daily() {
    const E = G.eco;
    let totalCash = 0;
    // salaires PNJ
    for (const n of G.npcs) {
      if (n.loc === 'prison') continue;
      let w = 0;
      if (n.job && n.job !== 'none') {
        const J = JOBS[n.job];
        w = Eco.pay(J.emp === 'state' ? 'state' : 'biz', n.work, Eco.wageOf(n.job, n.jr) * 8 * (n.partTime ? 0.5 : 1));
      } else if (n.sjob && n.work != null) {
        w = Eco.pay('biz', n.work, 11 * 8 * (1 + E.infl));
      } else if (E.treasury > -80000) { w = 22; E.treasury -= w; }
      n.bank += w;
      // dépenses de la vie courante (loyer, énergie) -> État
      const cost = 30 * (1 + E.infl);
      const paid = Math.min(cost, n.bank + n.money); Eco.charge(n, paid); E.treasury += paid * 0.5; E.wholesale += paid * 0.5;
      if (n.money < 60 && n.bank > 150) { n.bank -= 100; n.money += 100; }
      if (n.gang) { const g = G.gangs[n.gang]; const due = Math.min(n.bank, 15); n.bank -= due; g.treasury += due; }
      totalCash += n.money + n.bank;
    }
    // grossistes : redistribuent aux ménages (emplois indirects)
    const share = E.wholesale * 0.8;
    if (share > 0) { const lucky = G.npcs.filter((n) => n.loc !== 'prison'); const per = share / Math.max(1, lucky.length); for (const n of lucky) n.bank += per; E.wholesale -= share; }
    // commerces : achats de stock + impôt sur excédent
    let bizCash = 0;
    for (const id in G.biz) {
      const b = G.biz[id];
      const supply = b.rev * 0.32;
      b.cash -= supply; E.wholesale += supply; b.exp += supply;
      const cap = (b.base || 8000) * 1.8; if (b.cash > cap) { const tax = (b.cash - cap) * 0.25; b.cash -= tax; E.treasury += tax; }
      if (b.cash < -2000) b.cash = -2000;
      b.revY = b.rev; b.rev = 0; b.exp = 0; b.strug = 0;
      bizCash += b.cash;
    }
    // loyer du joueur
    if (P.homeRent) { const r = P.homeRent * (1 + E.infl); if (Eco.charge(P, r)) { E.treasury += r; } else { P.rentLate = (P.rentLate || 0) + 1; } }
    // intérêts / prêts
    P.bank += P.bank > 0 ? P.bank * 0.0008 : 0;
    Eco.playerLoanDaily();
    Eco.loanDaily();
    // prix dynamiques (offre/demande)
    const pop = G.npcs.length;
    const targets = { burger: pop * 0.5, fries: pop * 0.3, soda: pop * 0.5, beer: pop * 0.5, cocktail: pop * 0.3, meal: pop * 0.35, grocery: pop * 0.35, water: pop * 0.1 };
    for (const k in targets) {
      const ratio = (E.sold[k] || 0) / Math.max(1, targets[k]);
      E.pm[k] = clamp(E.pm[k] * (1 + clamp((ratio - 1) * 0.06, -0.05, 0.05)), 0.7, 1.7);
      E.sold[k] = 0;
    }
    // inflation selon la masse monétaire
    const M = totalCash + bizCash + E.treasury + P.cash + P.bank;
    if (!E.M0) E.M0 = M;
    const target = clamp((M / E.M0 - 1) * 0.5, -0.15, 0.6);
    E.infl += (target - E.infl) * 0.2;
    // impôt ajusté
    const dT = E.treasury - E.lastTreasury; E.lastTreasury = E.treasury;
    if (E.treasury < 20000 && dT < 0) E.taxRate = Math.min(0.25, E.taxRate + 0.005);
    else if (E.treasury > 250000 && dT > 0) E.taxRate = Math.max(0.06, E.taxRate - 0.005);
    const unemp = G.npcs.filter((n) => (!n.job || n.job === 'none') && !n.sjob && !(n.gang && n.gr >= 1)).length / pop;
    const avg = (Eco.price('burger') / ITEMS.burger.p + Eco.price('meal') / ITEMS.meal.p + Eco.price('grocery') / ITEMS.grocery.p) / 3;
    E.hist.push({ d: dayN(), avg, tr: E.treasury, un: unemp, M });
    if (E.hist.length > 40) E.hist.shift();
    // gangs : revenus du racket
    Gangs.daily();
    // actualités
    if (chance(0.7)) Eco.addNews(pick(NEWS_BITS));
    if (E.infl > 0.1) Eco.addNews('Inflation : les prix augmentent de ' + Math.round(E.infl * 100) + ' % !');
    if (E.treasury < 0) Eco.addNews('Les caisses de l\'État sont vides : hausse des taxes en vue.');
  },
  addNews(t) { G.news.unshift({ d: dayN(), t }); if (G.news.length > 25) G.news.pop(); },
  // prêts du joueur
  loanLimit() { const base = 1500 + (P.job !== 'none' && P.job ? P.jobRank * 2500 : 0) + Math.max(0, P.bank) * 0.5 - (P.rentLate || 0) * 500; return Math.max(0, Math.round(base / 100) * 100); },
  takeLoan(amt) {
    const have = (P.loan ? P.loan.owed : 0);
    if (amt + have > Eco.loanLimit() * 2) return 'Le conseiller refuse : montant trop élevé pour votre profil.';
    const bank = W.byKind.bank[0].id; const biz = G.biz[bank];
    if (biz.cash < amt) return 'La banque n\'a pas assez de liquidités.';
    biz.cash -= amt; P.bank += amt;
    P.loan = P.loan || { owed: 0, daily: 0, late: 0 };
    P.loan.owed += amt * 1.1; P.loan.daily = Math.max(P.loan.daily, Math.ceil(P.loan.owed / 12));
    return null;
  },
  playerLoanDaily() {
    const L = P.loan; if (!L || L.owed <= 0) return;
    const p = Math.min(L.daily, L.owed);
    if (P.bank >= p) { P.bank -= p; L.owed -= p; L.late = 0; G.biz[W.byKind.bank[0].id].cash += p; }
    else { L.late++; L.owed *= 1.03; if (L.late === 3) Msg.push('Banque', 'Impayé : votre prêt est en retard. Régularisez avant que le recouvrement n\'intervienne.'); if (L.late >= 6) { const seize = Math.min(P.cash, p); P.cash -= seize; L.owed -= seize; Msg.push('Banque', 'Recouvrement : ' + money(seize) + ' saisis sur vos espèces.'); } }
    if (L.owed <= 0.5) P.loan = null;
  },
  // statistiques
  stats() {
    const pop = G.npcs.length;
    const unemp = G.npcs.filter((n) => (!n.job || n.job === 'none') && !n.sjob && !(n.gang && n.gr >= 1)).length / pop;
    const cashPeople = G.npcs.reduce((s, n) => s + n.money + n.bank, 0) / pop;
    return { unemp, avgWealth: cashPeople, treasury: G.eco.treasury, infl: G.eco.infl, tax: G.eco.taxRate };
  },
};
