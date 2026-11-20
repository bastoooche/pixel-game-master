/*
 * PIXEL · Game master — fichier de scénario (« cartouche »)
 * ---------------------------------------------------------
 * Tout le contenu narratif du jeu est ici. Pour créer une nouvelle enquête,
 * copier ce fichier, réécrire les textes, garder la même structure.
 * Les codes des énigmes peuvent aussi être modifiés dans les Réglages de l'app
 * (ils sont alors enregistrés sur la tablette et remplacent ceux d'ici).
 */
window.SCENARIO = {
  id: "affaire-pixel",
  version: 1,
  titre: "L'affaire PIXEL",
  accroche: "PIXEL, le robot-poulpe du Fablab, a disparu cette nuit. Retrouve-le avant la Coupe de robotique.",

  // Durées par défaut, en minutes (modifiables dans les Réglages)
  dureeEnquete: 45,
  dureeFinale: 10,

  pitch: [
    "Demain matin, l'ISEN inscrit PIXEL à la Coupe de France de robotique. PIXEL, c'est la mascotte du Fablab : un robot-poulpe imprimé en 3D par les élèves, dont les bras multiples attrapent plusieurs objets à la fois. Aucun robot concurrent ne sait faire ça.",
    "Sauf que ce matin, son support est vide. La porte du Fablab a été ouverte cette nuit, et le système de sécurité du labo s'est verrouillé tout seul.",
    "Vous êtes la cellule d'enquête. Résolvez les énigmes laissées dans le labo, démasquez le coupable et désactivez le système de sécurité. Lui seul sait où se trouve PIXEL."
  ],

  regles: [
    "Chaque équipe commence à sa station. Quand la tablette sonne « On tourne ! », passez à la station suivante.",
    "Un code à 4 chiffres trouvé ? Venez le saisir ici. Une erreur bloque votre clavier 1 minute.",
    "Bloqués ? Demandez un coup de pouce sur la tablette. Il coûte des points.",
    "Avant de partir, remettez la station comme vous l'avez trouvée."
  ],

  suspects: [
    { n: 1, nom: "Lina Morel", role: "Enseignante-chercheuse en IA", mobile: "Voulait réutiliser les bras de PIXEL pour son projet de recherche" },
    { n: 2, nom: "Max Ferrand", role: "Élève-ingénieur en 4e année, option cyber", mobile: "Écarté de l'équipe de la Coupe le mois dernier" },
    { n: 3, nom: "Inès Daoud", role: "Technicienne du Fablab", mobile: "Seule à avoir le badge d'accès de nuit" },
    { n: 4, nom: "Hugo Lemaire", role: "Fondateur d'une start-up partenaire", mobile: "Prépare un robot concurrent pour la même Coupe de robotique" }
  ],

  methodes: [
    { id: "clone", label: "Badge copié (cloné)" },
    { id: "force", label: "Porte forcée" },
    { id: "complice", label: "Complice à l'intérieur" },
    { id: "vol", label: "Badge volé dans le casier" }
  ],

  // Donnés dans l'ordre, au fil des énigmes résolues par chaque équipe
  indices: [
    { titre: "Journal de la porte", texte: "La porte du Fablab a été ouverte à 23h47 avec le badge d'Inès Daoud." },
    { titre: "Casier connecté", texte: "Le casier d'Inès, où elle range son badge, n'a pas été ouvert entre 18h et 8h. Son badge n'en est jamais sorti : quelqu'un a utilisé une copie." },
    { titre: "Visioconférence", texte: "De 23h à minuit, Lina Morel était en visio avec un laboratoire de Montréal. L'enregistrement est horodaté." },
    { titre: "Photos-alibis", texte: "Max a posté une photo du gala de l'école à 23h40, Hugo une photo d'un restaurant à Marseille à 23h45. L'analyse montre que la photo d'Hugo a été générée par IA : six doigts sur la main qui tient le verre." },
    { titre: "Colis", texte: "La semaine dernière, un lecteur-copieur de badges NFC a été livré à l'adresse de la start-up d'Hugo." }
  ],

  solution: {
    suspect: 4,
    methode: "clone",
    explication: "Hugo Lemaire a copié le badge d'Inès avec un lecteur NFC pendant une visite du Fablab, puis s'est fabriqué un faux alibi avec une image générée par IA. Un badge sans contact se copie, et une photo ne prouve plus rien : c'est tout le métier d'ingénieur en cybersécurité."
  },

  cachette: "PIXEL est caché dans l'armoire à filaments du Fablab, étagère 3.",

  // Banque d'énigmes. "reference: true" = sélection par défaut pour 1h30.
  enigmes: [
    {
      id: "E1", nom: "Le code des résistances", domaine: "Électronique", code: "4216", minutes: 6, reference: true,
      coups: ["Chaque couleur vaut un chiffre.", "La 1re bande est celle collée au bord, à l'opposé de la bande dorée."],
      solution: "Premières bandes de R1 à R4 : jaune (4), rouge (2), marron (1), bleu (6). Code 4216.",
      debrief: { fait: "Tu as lu la valeur d'un composant électronique.", isen: "C'est le premier geste de l'électronique, qu'on pratique dès le cycle préparatoire." }
    },
    {
      id: "E2", nom: "La machine à prédire", domaine: "Intelligence artificielle", code: "3856", minutes: 8, reference: true,
      coups: ["Comparez bien les pourcentages : c'est souvent serré, et PIXEL-IA prend toujours le plus haut. Arrêtez-vous au mot FIN.", "La phrase commence par : LE CODE DU SERVEUR EST…"],
      solution: "LE CODE DU SERVEUR EST TROIS HUIT CINQ SIX FIN. Code 3856.",
      debrief: { fait: "Tu as fait parler une IA mot par mot, exactement comme ChatGPT.", isen: "Une IA générative ne comprend pas ce qu'elle écrit : elle prédit le mot le plus probable. Si un mauvais mot passe devant, elle continue avec aplomb : c'est une hallucination. À l'ISEN, on apprend à construire ces modèles et à vérifier ce qu'ils disent." }
    },
    {
      id: "E3", nom: "Le disque de César", domaine: "Cybersécurité", code: "7209", minutes: 8, reference: true,
      coups: ["La mascotte s'appelle PIXEL. Compte ses lettres.", "Aligne le A extérieur sur le F intérieur."],
      solution: "Clé 5 (PIXEL = 5 lettres). XJUY IJZC EJWT SJZK = SEPT DEUX ZERO NEUF. Code 7209.",
      debrief: { fait: "Tu as cassé un chiffrement vieux de 2000 ans.", isen: "En cybersécurité, on apprend pourquoi les chiffrements modernes, eux, ne se cassent pas." }
    },
    {
      id: "E4", nom: "Le journal binaire", domaine: "Informatique", code: "1306", minutes: 8, reference: true,
      coups: ["Lis la carte « Comment lire un nombre binaire » : prends le jeu HEURE pour l'heure et le jeu MINUTE pour les minutes, retourne côté points sous chaque 1, et compte les points.", "10111 en heures, ça fait 23. Attention : deux lignes ont cette heure-là, vérifie aussi les minutes."],
      solution: "Ligne 4 : 10111 = 16 + 4 + 2 + 1 = 23 et 101111 = 32 + 8 + 4 + 2 + 1 = 47, donc 23h47. Son code de session : 1306.",
      debrief: { fait: "Tu as lu l'heure en binaire dans la mémoire d'une machine.", isen: "Tout ce que manipule un ordinateur s'écrit en 0 et en 1, de l'heure d'un badge à une photo." }
    },
    {
      // V0 : version papier (plateau quadrillé + pion + programme). Plus tard : Ozobot.
      id: "E5", nom: "Le parcours de PIXEL", domaine: "Robotique et algorithmique", code: "5831", minutes: 10, reference: false,
      coups: ["PIXEL démarre sur la case DÉPART, tourné vers le haut du plateau. TOURNE change seulement sa direction, pas sa case.", "RÉPÈTE 2 FOIS [ … ] : exécute tout le bloc entre crochets, puis exécute-le une deuxième fois."],
      solution: "En exécutant le programme pas à pas, PIXEL attrape les objets des cases 5, 8, 3 puis 1. Code 5831.",
      debrief: { fait: "Tu as exécuté un algorithme pas à pas, exactement comme un robot.", isen: "Programmer un robot, c'est écrire ces instructions : en cours, on les écrit en Python ou en C." }
    },
    {
      id: "E6", nom: "La pièce de rechange", domaine: "Fabrication 3D", code: "2648", minutes: 8, reference: false,
      coups: ["Ce n'est pas la forme qui compte, c'est ce qu'il y a dedans.", "Regarde la pièce à travers la lumière."],
      solution: "Les 4 morceaux assemblés devant la lampe révèlent le code 2648.",
      debrief: { fait: "Tu as lu une image cachée dans l'épaisseur du plastique.", isen: "L'impression 3D sert à prototyper vite : cette pièce a été conçue et imprimée au Fablab." }
    },
    {
      id: "E7", nom: "Le message invisible", domaine: "Optique et embarqué", code: "9174", minutes: 8, reference: false,
      coups: ["Certaines encres ne se voient qu'à une certaine lumière.", "Un clignotement long, c'est un trait. Une pause longue sépare les chiffres."],
      solution: "Morse : −−−−. / .−−−− / −−... / ....− = 9 1 7 4. Code 9174.",
      debrief: { fait: "Tu as décodé le signal d'un système embarqué.", isen: "La micro:bit est un vrai système embarqué : même principe qu'un capteur industriel." }
    },
    {
      id: "E8", nom: "Le vrai du faux", domaine: "Intelligence artificielle", code: "3390", minutes: 10, reference: false,
      coups: ["Ne regarde pas l'image, regarde ses infos : appareil, nom du fichier, taille, lieu, heure. Deux incohérences ou plus = une fausse.", "La photo du restaurant à 23h45 est fausse : son GPS dit Toulon et sa taille est un carré parfait. Il en reste 3 à trouver."],
      solution: "Les 4 fausses, dans l'ordre des heures : 19h12 soudure (3), 21h40 affiche (3), 23h45 restaurant (9), 23h58 robot en plein soleil (0). Code 3390.",
      debrief: { fait: "Tu as démasqué des images IA parfaitement réalistes en enquêtant sur leurs infos.", isen: "On ne croit plus une image, on vérifie sa provenance : c'est le travail des ingénieurs en cybersécurité et en investigation numérique." }
    },
    // Version Makey Makey (2e tablette, écran « Station circuit » : adresse #station). Même code que E2 : n'en activer qu'une des deux.
    {
      id: "E9", nom: "Le circuit au crayon", domaine: "Électronique", code: "3856", minutes: 10, reference: false,
      coups: ["Ta réponse à chaque question donne l'entrée du labyrinthe : une seule entrée rejoint la bande MASSE. Appuie fort et repasse 3 fois.", "Les bonnes entrées : HAUT A, BAS B, GAUCHE B, DROITE A."],
      solution: "Les 4 circuits fermés affichent 3, 8, 5, 6 de gauche à droite. Code 3856.",
      debrief: { fait: "Tu as fermé un circuit pour envoyer un signal à un écran.", isen: "Un circuit, une entrée, un signal, un affichage : c'est le principe de tout objet connecté." }
    }
  ],

  // Énigme E9 (Makey Makey) : touches envoyées par le Makey Makey → chiffre affiché par la station
  stationCircuit: [
    { touche: "ArrowUp", porte: "Porte Haut", chiffre: "3" },
    { touche: "ArrowDown", porte: "Porte Bas", chiffre: "8" },
    { touche: "ArrowLeft", porte: "Porte Gauche", chiffre: "5" },
    { touche: "ArrowRight", porte: "Porte Droite", chiffre: "6" }
  ],

  // Pages du manuel du boîtier, attribuées aux équipes dans l'ordre
  fiches: [
    { id: "A", nom: "Les fils" },
    { id: "B", nom: "Le bouton" },
    { id: "C", nom: "La séquence" },
    { id: "D", nom: "Le code final" },
    { id: "S", nom: "Numéro de série" }
  ],

  messageFinal: "Tu viens de faire de l'électronique, de l'intelligence artificielle, de la cybersécurité et de l'informatique en une heure. C'est ça, être ingénieur du numérique."
};
