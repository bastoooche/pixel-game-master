# ARGO · Game master (V0)

Application du maître du jeu pour **Le Prototype disparu**, l'animation escape game du Fablab ISEN Méditerranée.
C'est une webapp statique (HTML, CSS, JS, sans dépendance ni serveur). Elle fonctionne hors ligne une fois installée sur la tablette.

## Mise en ligne sur GitHub Pages

1. Créer un dépôt (par exemple `argo-game-master`) et y déposer **le contenu de ce dossier** à la racine.
2. Dans le dépôt : Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. L'app est en ligne après une minute sur `https://<compte>.github.io/argo-game-master/`.

## Installation sur les tablettes Android

1. Ouvrir l'adresse dans Chrome.
2. Menu ⋮ → « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
3. Ouvrir l'app une fois avec le Wi-Fi : tout est mis en cache, elle marche ensuite sans réseau.

Pour la V0, il faut 2 tablettes :
- **Tablette 1 : Terminal d'enquête.** Accueil → Nouvelle partie.
- **Tablette 2 : Station circuit (énigme E2)** pendant l'enquête, avec le Makey Makey branché en USB OTG. Puis **Boîtier virtuel** pour la finale.

## Code animateur

Par défaut : **2026**. Il protège les réglages, le panneau animateur, la sortie de la station et le menu du boîtier.
À changer dans les Réglages. Après saisie, il reste valable 10 minutes.

## Déroulé dans l'app

Briefing → Enquête (chrono, saisie des codes, indices, coups de pouce) → Accusation (secrète) → Finale (chrono 10 min) → Révélation (cachette, solution, classement, débrief, QR code de fin).
La partie est sauvegardée en continu sur la tablette : on peut fermer l'app et reprendre.

## Codes de la V0 (sélection par défaut)

| Énigme | Code |
| --- | --- |
| E1 · Le code des résistances | 4216 |
| E2 · Le circuit au crayon | 3856 |
| E3 · Le disque de César | 7209 |
| E4 · Le journal binaire | 1306 |


E5 (version papier), E6, E7 et E8 sont dans la banque, décochées par défaut. Les codes se modifient dans les Réglages.

## Boîtier virtuel (finale)

Il tire au hasard un numéro de série, l'ordre des fils, la couleur du bouton et la séquence, et applique les règles des fiches A à D du document de game design.
Menu Animateur du boîtier : affiche la solution du tirage en cours (pour tester) et permet une nouvelle combinaison.

## Modifier le jeu

- **Textes, indices, suspects, énigmes, coups de pouce, débrief :** `js/scenario.js`. Une nouvelle enquête = une copie de ce fichier réécrite.
- **Couleurs et mise en page :** `css/app.css` (couleurs du Design System ISEN).
- **Après toute modification :** augmenter `VERSION` dans `sw.js`, sinon les tablettes gardent l'ancienne version en cache.

## Polices

Plus Jakarta Sans est incluse (licence SIL OFL, voir `fonts/`).
La police d'accent de la charte, Target Book, n'est pas incluse : le dépôt GitHub Pages est public, il faut d'abord vérifier que sa licence permet de la publier. Si c'est le cas, déposer `TargetBook.woff2` dans `fonts/` ; sinon l'app se replie sur Plus Jakarta Sans.
