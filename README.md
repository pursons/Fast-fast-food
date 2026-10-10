# 🍔 Fast Fast Life — jeu de rôle 2D de ville (mobile & navigateur)

Un « FiveM de poche » en 2D vue du dessus : une ville ouverte avec des habitants qui ont une routine,
des maisons et des intérieurs, un téléphone avec ses applications, des véhicules, des gangs, des métiers
et une économie reliée. 100 % HTML5 / Canvas / JavaScript — **aucune dépendance, aucun build**.

> C'est un jeu **solo hors-ligne** : les « autres joueurs » sont des PNJ simulés (habitants avec emploi,
> famille, gangs, etc.). Il n'y a pas de serveur multijoueur.

## ▶ Lancer le jeu

N'importe quel serveur de fichiers statiques suffit :

```bash
python3 -m http.server 8000     # puis ouvrir http://localhost:8000
```

* **Sur mobile** : ouvrez l'URL (ou publiez le dépôt avec GitHub Pages) puis « Ajouter à l'écran d'accueil » :
  le jeu est une PWA (plein écran, utilisable hors-ligne grâce au service worker).
* **Sur PC** : ZQSD / WASD ou flèches, `E` action, `F` véhicule, `Espace` frapper/tirer/sirène, `Maj` courir/frein,
  `P` téléphone, `I` sac, `Échap` menu.
* La partie est **sauvegardée automatiquement** (localStorage).

## 🕹️ Contrôles tactiles
Joystick à gauche · **A** agir (maintenir pour éteindre un feu) · 🚗 monter/descendre · 👊 frapper/tirer
(sirène dans un véhicule de service) · 🏃 courir (frein à main en voiture) · 📱 téléphone · 🎒 sac · ☰ menu.
En véhicule : gauche/droite = volant, haut = accélérer, bas = freiner/reculer.

## ⏱️ Temps
* **Accéléré (par défaut)** : 10 minutes réelles = 1 heure de jeu.
* **Temps réel** : 1 minute de jeu = 1 minute réelle, synchronisé sur l'horloge de votre appareil.
* Dormir (lit, cellule, hôpital…) accélère fortement l'horloge ; les PNJ se téléportent alors à leur position prévue.
* Se règle à tout moment dans 📱 Réglages (ou ☰ Menu).

## 🏙️ La ville
88 × 70 tuiles : grille de routes avec circulation PNJ, trottoirs, parc avec étang, jour/nuit, ~30 maisons et immeubles,
**commissariat, caserne, hôpital, prison, banque, 2 Fast Fast Food, 2 restaurants, 2 bars, boîte de nuit, QG des motards,
club privé de la mafia, planque du gang de rue, supérettes, stations-service, concession, bureaux**.
Chaque bâtiment a un **intérieur** (meubles interactifs, personnel, clients) avec horaires d'ouverture.

## 👥 Habitants (PNJ)
~70 habitants avec nom, âge, domicile, métier, argent, banque, traits (criminalité, sociabilité), numéro de téléphone,
profil de rencontre et compte Instagram.
Leur **routine** change selon le jour : réveil → trajet à pied (pathfinding par champs de distance) → travail en horaires
(jour/nuit/week-end) → pause déjeuner → loisirs le soir (bar, resto, boîte, parc, QG de gang…) → retour dormir.
Ils achètent vraiment dans les commerces, empruntent, se blessent, se font arrêter, braquent parfois une supérette, et sont remplacés s'ils meurent.

## 💼 Métiers jouables (via 📱 *Métier* → postuler → casier du bâtiment → prendre son service)
| Métier | Gameplay |
|---|---|
| 🚓 **Police** | Patrouille en voiture de service (sirène), dispatch, contrôle d'identité, menottage, escorte au commissariat, écrouement, séparation de bagarres, taser |
| 🚒 **Pompiers** | Incendies qui se propagent, extinction à la lance (camion) ou à l'extincteur, primes selon le grade |
| 🚑 **Ambulance / hôpital** | Urgences médicales en ville, soins sur place ou transport à l'hôpital |
| 🍔 **Fast Fast Food** | Prise de commande au comptoir, gril/friteuse/boissons, service rapide = pourboire. Manager : gestion des salaires et de l'équipe |
| 🏦 **Banquier** | Étudier des demandes de prêt (score approximatif), accorder/refuser ; les défauts de paiement tombent plus tard |
| 🔒 **Gardien de prison** | Rondes (points A→D), fouilles de cellules, séparer les bagarres de détenus |
| ⛓️ **Détenu** | Si vous êtes arrêté : travailler pour réduire la peine, dormir pour accélérer, muscu, avocat, caution, évasion |

Chaque métier a **6 grades** (XP → promotion automatique, salaire horaire croissant). À partir du grade 4 :
**recruter, promouvoir, rétrograder, licencier** des PNJ depuis 📱 *Métier*.

## 🕶️ Gangs (Famille Corvino 🎩 · Iron Wolves MC 🏍️ · Los Diablos 🔥)
Allez à leur QG, parlez au chef : droit d'entrée ou épreuve. Missions : livraison de colis, vol de véhicule ciblé,
racket, braquage de supérette, défense de territoire, casse de la banque, **run de moto** (motards).
**5 grades** par gang, respect, caisse commune, marché noir, casino clandestin (mafia), **recruter / renvoyer /
promouvoir / rétrograder** des membres, défier le chef pour prendre sa place. La police vous recherche (1–5 étoiles) :
fuyez, cachez-vous dans un bâtiment, ou finissez en prison.

## 📱 Téléphone
Messages · **Instagram** (photo de la scène, abonnés, sponsors) · **Flamme** (swipe, matchs, rencards, couple) ·
Banque (compte, prêts, éco de la ville) · GPS & Taxi · Métier · Gang · Dispatch · Actus & Éco (graphiques) · Réglages.

## 💶 Économie reliée
Salaires payés par l'employeur (État ou commerce) · TVA et impôts sur excédent → trésor public → salaires publics ·
loyers · prix dynamiques selon l'offre/la demande · inflation selon la masse monétaire · prêts bancaires · racket des gangs ·
casino · fournisseurs qui redistribuent. Tout est visible dans 📱 Banque / Actus & Éco.

## 🧪 Tests de fumée (optionnel, Playwright)
```bash
node tools/worldcheck.js          # cohérence de la carte et des intérieurs
python3 -m http.server 8123 &     # serveur local
node tools/logic.js               # métiers, gang, prison, social…
node tools/logic2.js              # poursuite, missions de gang, économie, sauvegarde
node tools/fuzz.js 5              # entrées aléatoires pour détecter les exceptions
```

## 🗂️ Structure
```
index.html · style.css · manifest.webmanifest · sw.js
js/util.js data.js   utilitaires, données (métiers, gangs, objets, véhicules)
js/world.js          génération de la ville + intérieurs
js/economy.js        temps, état global, économie
js/npc.js            habitants, routines, pathfinding, intérieurs
js/vehicle.js        physique, circulation, carburant
js/player.js         joueur, interactions, besoins, recherche, prison, dialogues
js/jobs.js           métiers + incidents
js/gangs.js          gangs + missions
js/acts.js           actions civiles (maison, commerces, bars, banque…)
js/phone.js          téléphone + Instagram + rencontres
js/render.js main.js rendu, boucle, sauvegarde, titre
```
