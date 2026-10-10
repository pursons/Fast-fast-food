'use strict';
// ===== Données statiques du jeu =====
const DAYN = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const FIRST_M = ['Lucas', 'Hugo', 'Nathan', 'Enzo', 'Louis', 'Mehdi', 'Karim', 'Tom', 'Yanis', 'Adam', 'Théo', 'Maxime', 'Antoine', 'Rayan', 'Bastien', 'Julien', 'Ismaël', 'Nicolas', 'Jordan', 'Samir', 'Victor', 'Dylan', 'Marco', 'Franck'];
const FIRST_F = ['Emma', 'Léa', 'Chloé', 'Inès', 'Manon', 'Sarah', 'Camille', 'Jade', 'Lina', 'Zoé', 'Nina', 'Alice', 'Yasmine', 'Clara', 'Sofia', 'Océane', 'Julie', 'Amira', 'Lola', 'Maëlle', 'Anaïs', 'Fatou', 'Marina', 'Elsa'];
const LAST = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Mercier', 'Blanc', 'Guerin', 'Boyer', 'Garnier', 'Chevalier', 'Francois', 'Benali', 'Diallo', 'Rossi', 'Costa', 'Silva', 'Lopez'];
const NPC_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#475569', '#ea580c', '#0d9488', '#9333ea'];
const SKIN = ['#f1c9a5', '#e0ac82', '#c68642', '#8d5524', '#ffdbac', '#a9724a'];
const HAIR = ['#1a1a1a', '#3b2417', '#6b4423', '#c9a227', '#8a1c1c', '#444', '#e8e8e8'];

// Métiers : rang, salaire horaire (en heures de jeu), employeur
const RANK_XP = [0, 120, 340, 760, 1500, 2800];
const JOBS = {
  none: { name: 'Sans emploi', emoji: '🧑', ranks: ['—'], pay: [0], emp: null },
  police: { name: 'Police', emoji: '🚓', emp: 'state', ranks: ['Cadet', 'Officier', 'Sergent', 'Lieutenant', 'Capitaine', 'Commissaire'], pay: [18, 24, 31, 40, 52, 68], bld: 'police', col: '#1d4ed8' },
  fire: { name: 'Pompiers', emoji: '🚒', emp: 'state', ranks: ['Stagiaire', 'Pompier', 'Caporal', 'Sergent', 'Lieutenant', 'Capitaine'], pay: [16, 22, 28, 36, 46, 60], bld: 'fire', col: '#dc2626' },
  ems: { name: 'Ambulance / Hôpital', emoji: '🚑', emp: 'state', ranks: ['Brancardier', 'Ambulancier', 'Infirmier', 'Urgentiste', 'Chef de garde', 'Directeur médical'], pay: [16, 23, 30, 40, 54, 72], bld: 'hospital', col: '#10b981' },
  fastfood: { name: 'Fast Fast Food', emoji: '🍔', emp: 'biz', ranks: ['Équipier', 'Cuisinier', 'Chef d\'équipe', 'Manager', 'Gérant', 'Directeur'], pay: [11, 14, 18, 24, 32, 42], bld: 'fastfood', col: '#f59e0b' },
  banker: { name: 'Banquier', emoji: '🏦', emp: 'biz', ranks: ['Stagiaire', 'Conseiller', 'Conseiller senior', 'Directeur d\'agence', 'Directeur régional', 'Directeur général'], pay: [15, 22, 30, 42, 58, 80], bld: 'bank', col: '#475569' },
  guard: { name: 'Gardien de prison', emoji: '🔒', emp: 'state', ranks: ['Surveillant stagiaire', 'Gardien', 'Brigadier', 'Major', 'Chef de détention', 'Directeur'], pay: [16, 22, 29, 38, 50, 66], bld: 'prison', col: '#334155' },
};
const SIDE_JOBS = { // emplois PNJ non jouables (ou vendeurs…)
  clerk: { name: 'Employé', bld: ['store', 'gas', 'dealer', 'office'] },
  waiter: { name: 'Serveur', bld: ['restaurant', 'bar'] },
  clubstaff: { name: 'Personnel de club', bld: ['club'] },
};

const GANGS = {
  mafia: { id: 'mafia', name: 'Famille Corvino', emoji: '🎩', col: '#8b5cf6', hq: 'mafia', ranks: ['Associé', 'Soldat', 'Caporegime', 'Sous-chef', 'Parrain'], resp: [0, 150, 500, 1200, 2600], blurb: 'Mafia italienne : racket, casino clandestin, blanchiment.' },
  bikers: { id: 'bikers', name: 'Iron Wolves MC', emoji: '🏍️', col: '#f97316', hq: 'biker', ranks: ['Prospect', 'Patché', 'Sergent d\'armes', 'Vice-président', 'Président'], resp: [0, 130, 450, 1100, 2400], blurb: 'Club de motards : trafic, convois, bagarres.' },
  street: { id: 'street', name: 'Los Diablos', emoji: '🔥', col: '#ef4444', hq: 'street', ranks: ['Recrue', 'Soldat', 'Lieutenant', 'Bras droit', 'Chef'], resp: [0, 100, 380, 950, 2200], blurb: 'Gang de rue : deal, vols de voitures, territoire.' },
};

// Objets / prix de base
const ITEMS = {
  burger: { n: 'Burger', e: '🍔', p: 8, hun: 38, cat: 'food' },
  fries: { n: 'Frites', e: '🍟', p: 4, hun: 15, cat: 'food' },
  soda: { n: 'Soda', e: '🥤', p: 3, thi: 30, cat: 'food' },
  water: { n: 'Eau', e: '💧', p: 2, thi: 35, cat: 'food' },
  beer: { n: 'Bière', e: '🍺', p: 6, thi: 12, alc: 14, cat: 'drink' },
  cocktail: { n: 'Cocktail', e: '🍸', p: 13, thi: 8, alc: 22, cat: 'drink' },
  meal: { n: 'Plat du jour', e: '🍝', p: 24, hun: 70, thi: 10, cat: 'food' },
  grocery: { n: 'Courses', e: '🛒', p: 25, hun: 55, cat: 'food' },
  medkit: { n: 'Trousse de soins', e: '🩹', p: 35, heal: 60, cat: 'misc' },
  lockpick: { n: 'Crochet', e: '🗝️', p: 60, cat: 'crime' },
  pistol: { n: 'Pistolet', e: '🔫', p: 900, cat: 'crime' },
  ammo: { n: 'Munitions (x12)', e: '🔸', p: 80, cat: 'crime' },
  colis: { n: 'Colis suspect', e: '📦', p: 120, cat: 'crime' },
  fuelcan: { n: 'Bidon d\'essence', e: '⛽', p: 18, cat: 'misc' },
  mask: { n: 'Cagoule', e: '🎭', p: 25, cat: 'crime' },
  outfit: { n: 'Tenue stylée', e: '👔', p: 120, charm: 6, cat: 'misc' },
};
const FUEL_PRICE = 1.9; // €/L

const VEH = {
  scooter: { n: 'Scooter', w: 24, h: 10, max: 210, acc: 150, steer: 3.6, price: 2200, fuel: 8, emoji: '🛵', moto: true },
  moto: { n: 'Moto sportive', w: 28, h: 11, max: 380, acc: 240, steer: 3.2, price: 7800, fuel: 14, emoji: '🏍️', moto: true },
  chopper: { n: 'Chopper (custom)', w: 32, h: 12, max: 320, acc: 190, steer: 2.7, price: 16500, fuel: 16, emoji: '🏍️', moto: true },
  car: { n: 'Berline', w: 36, h: 19, max: 300, acc: 190, steer: 2.3, price: 13500, fuel: 50, emoji: '🚗' },
  compact: { n: 'Citadine', w: 32, h: 18, max: 260, acc: 170, steer: 2.5, price: 8200, fuel: 36, emoji: '🚙' },
  sport: { n: 'Coupé sport', w: 38, h: 18, max: 430, acc: 280, steer: 2.2, price: 52000, fuel: 55, emoji: '🏎️' },
  van: { n: 'Utilitaire', w: 44, h: 21, max: 240, acc: 130, steer: 1.9, price: 19000, fuel: 70, emoji: '🚐' },
  police: { n: 'Voiture de police', w: 38, h: 19, max: 360, acc: 240, steer: 2.4, price: 0, fuel: 60, emoji: '🚓' },
  fire: { n: 'Camion de pompiers', w: 56, h: 22, max: 240, acc: 120, steer: 1.7, price: 0, fuel: 90, emoji: '🚒' },
  ambu: { n: 'Ambulance', w: 46, h: 21, max: 300, acc: 170, steer: 2.0, price: 0, fuel: 70, emoji: '🚑' },
  taxi: { n: 'Taxi', w: 36, h: 19, max: 280, acc: 180, steer: 2.3, price: 0, fuel: 50, emoji: '🚕' },
};
const CAR_COLORS = ['#e5e7eb', '#111827', '#dc2626', '#2563eb', '#16a34a', '#eab308', '#9ca3af', '#7c3aed', '#f97316'];

// Types de bâtiments : taille extérieure, couleur de toit, nom, emoji
const BKINDS = {
  house: { n: 'Maison', w: 6, h: 5, col: '#b45f3c', e: '🏠' },
  apt: { n: 'Immeuble', w: 8, h: 6, col: '#8a8f9c', e: '🏢' },
  fastfood: { n: 'Fast Fast Food', w: 8, h: 6, col: '#e11d48', e: '🍔' },
  restaurant: { n: 'Restaurant', w: 8, h: 6, col: '#a16207', e: '🍝' },
  bar: { n: 'Bar', w: 7, h: 5, col: '#7c2d12', e: '🍺' },
  club: { n: 'Boîte de nuit', w: 10, h: 6, col: '#3b0764', e: '🪩' },
  bank: { n: 'Banque', w: 8, h: 6, col: '#475569', e: '🏦' },
  police: { n: 'Commissariat', w: 10, h: 6, col: '#1e3a8a', e: '🚓' },
  fire: { n: 'Caserne', w: 10, h: 6, col: '#b91c1c', e: '🚒' },
  hospital: { n: 'Hôpital', w: 11, h: 7, col: '#e5e7eb', e: '🏥' },
  prison: { n: 'Prison', w: 12, h: 9, col: '#52525b', e: '🔒' },
  biker: { n: 'QG Iron Wolves', w: 8, h: 5, col: '#9a3412', e: '🏍️' },
  mafia: { n: 'Le Corvino (club privé)', w: 8, h: 5, col: '#4c1d95', e: '🎩' },
  street: { n: 'Planque des Diablos', w: 6, h: 5, col: '#7f1d1d', e: '🔥' },
  store: { n: 'Supérette', w: 8, h: 5, col: '#0f766e', e: '🛒' },
  gas: { n: 'Station-service', w: 6, h: 4, col: '#ca8a04', e: '⛽' },
  dealer: { n: 'Concession', w: 10, h: 6, col: '#1d4ed8', e: '🚘' },
  office: { n: 'Bureaux', w: 8, h: 6, col: '#64748b', e: '🏬' },
};
// Effectifs PNJ par bâtiment
const STAFF = { fastfood: 5, restaurant: 3, bar: 2, club: 3, bank: 3, police: 5, fire: 4, hospital: 5, prison: 6, store: 2, gas: 1, dealer: 2, office: 3 };

const NEWS_BITS = [
  'Les prix de la restauration rapide fluctuent selon la demande.',
  'Le maire promet plus de patrouilles de police en ville.',
  'La Famille Corvino aurait étendu son influence au centre-ville.',
  'Les Iron Wolves organisent une run de moto ce week-end.',
  'Hausse du prix de l\'essence dans les stations de la ville.',
  'Le taux de chômage reste un sujet de débat.',
  'La soirée au club « Néon » fait salle comble chaque vendredi.',
  'La prison est surpeuplée selon un syndicat de gardiens.',
];
