/* PIXEL · Game master — application (vanilla JS, hors ligne, sans dépendance) */
(() => {
  "use strict";
  const S = window.SCENARIO;
  const LS_KEY = "pixel-gm:" + S.id;
  const LS_BOITIER = "pixel-gm:boitier:" + S.id;
  const VERSION_APP = "v1.6.2";

  const COULEURS = [
    { id: "rouge", nom: "Rouge", hex: "#E30613", texte: "#fff" },
    { id: "bleue", nom: "Bleue", hex: "#003879", texte: "#fff" },
    { id: "verte", nom: "Verte", hex: "#6AB87E", texte: "#231F20" },
    { id: "corail", nom: "Corail", hex: "#F0926F", texte: "#231F20" },
    { id: "ciel", nom: "Ciel", hex: "#5E8EBE", texte: "#fff" },
    { id: "bordeaux", nom: "Bordeaux", hex: "#980A2B", texte: "#fff" }
  ];
  const COUTS = [10, 25, 60];               // coup de pouce 1, 2, solution
  const PTS = { enigme: 100, erreur: 10, coupable: 150, methode: 50 };
  const PENALITE_FINALE_MS = 30000;

  /* ------------------------------------------------------------------ */
  /* Stockage                                                            */
  /* ------------------------------------------------------------------ */
  function reglagesParDefaut() {
    return {
      nbEquipes: 4,
      equipes: COULEURS.map(c => ({ couleur: c.id, nom: "Équipe " + c.nom })),
      dureeEnquete: S.dureeEnquete,
      dureeFinale: S.dureeFinale,
      actives: S.enigmes.filter(e => e.reference).map(e => e.id),
      codes: {},
      seuilManuel: 3,
      rotationMin: 10,
      penaliteSec: 60,
      lienFin: "",
      cachette: "",
      pin: "2026"
    };
  }
  function lire(cle) { try { const v = localStorage.getItem(cle); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function ecrire(cle, v) { try { localStorage.setItem(cle, JSON.stringify(v)); } catch (e) { /* stockage indisponible : on continue en mémoire */ } }

  const sauve = lire(LS_KEY) || {};
  const store = {
    reglages: Object.assign(reglagesParDefaut(), sauve.reglages || {}),
    partie: sauve.partie || null
  };
  function save() { if (!window.__razEnCours) ecrire(LS_KEY, store); }

  const R = () => store.reglages;
  const P = () => store.partie;

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */
  const pl = (n, mot, plur) => n + " " + (n > 1 ? (plur || mot + "s") : mot);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = sel => document.querySelector(sel);
  const now = () => Date.now();
  function fmt(ms) {
    const neg = ms < 0; ms = Math.abs(ms);
    const t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60;
    return (neg ? "−" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  const couleur = id => COULEURS.find(c => c.id === id) || COULEURS[0];
  const enigme = id => S.enigmes.find(e => e.id === id);
  const codeDe = e => (R().codes[e.id] || e.code);
  // Stations de la rotation : figées au lancement de la partie. Énigmes en plus : ajoutées à la volée, hors rotation.
  const stationsBase = () => { const p = P(), ids = p && p.stations ? p.stations : R().actives; return S.enigmes.filter(e => ids.includes(e.id)); };
  const actives = () => { const p = P(), ids = new Set(p && p.stations ? p.stations : R().actives); ((p && p.bonus) || []).forEach(id => ids.add(id)); return S.enigmes.filter(e => ids.has(e.id)); };
  const fiche = id => S.fiches.find(f => f.id === id);
  const cachette = () => (R().cachette || "").trim() || S.cachette;

  function fichesPour(index, nb) {
    if (nb <= 2) return [["A", "B"], ["C", "D"]][index] || [];
    if (nb === 3) return [["A", "B"], ["C"], ["D"]][index] || [];
    return [["A"], ["B"], ["C"], ["D"], ["S"], []][index] || [];
  }
  const nomsFiches = ids => ids.map(id => "fiche " + id + " (" + fiche(id).nom + ")").join(" et ");

  /* Chronos : { debut, pauseDebut, pauseCumul } */
  function ecoule(t) { if (!t || !t.debut) return 0; return (t.pauseDebut || now()) - t.debut - t.pauseCumul; }
  function resteEnquete() { const p = P(); return R().dureeEnquete * 60000 + (p.enquete.bonusMs || 0) - ecoule(p.enquete); }
  function resteFinale() { const p = P(); return R().dureeFinale * 60000 - p.finale.penalites * PENALITE_FINALE_MS - ecoule(p.finale); }
  function pause(t) { if (t.debut && !t.pauseDebut) t.pauseDebut = now(); }
  function reprendre(t) { if (t.pauseDebut) { t.pauseCumul += now() - t.pauseDebut; t.pauseDebut = null; } }

  function scoreEquipe(eq, avecAccusation) {
    let s = eq.resolues.length * PTS.enigme - eq.erreurs * PTS.erreur;
    Object.values(eq.coups).forEach(n => { for (let i = 0; i < n; i++) s -= COUTS[i]; });
    if (avecAccusation && eq.accusation) {
      if (eq.accusation.suspect === S.solution.suspect) s += PTS.coupable;
      if (eq.accusation.methode === S.solution.methode) s += PTS.methode;
    }
    return s;
  }

  /* Rotation des stations : chaque équipe change de station toutes les N minutes */
  function rotation() {
    const p = P(), min = Number(R().rotationMin) || 0;
    if (!p || !min || !p.enquete.debut) return null;
    const st = stationsBase(), nb = Math.max(p.equipes.length, st.length), dur = min * 60000, e = ecoule(p.enquete);
    const e2 = e + (p.avanceMs || 0);          // avance cumulée quand un tour est écourté
    const tour = Math.floor(e2 / dur) + 1;
    return { tour, nb, dur, reste: dur - (e2 % dur), fini: tour > nb };
  }
  /* Une équipe a fini sa station quand elle a trouvé le code de l'énigme de ce tour (ou qu'elle est en pause dossier) */
  function stationFinie(i, tour) {
    const e = stationDe(i, tour), eq = P().equipes[i];
    return !e || eq.resolues.some(r => r.id === e.id);
  }
  const tousFinis = rot => P().equipes.every((eq, i) => stationFinie(i, rot.tour));
  const DELAI_TOUR_MS = 20000;   // les équipes ont 20 s pour ranger avant de tourner
  function avancerTour() {
    const p = P(), rot = rotation();
    if (!rot || rot.fini) return;
    p.avanceMs = (p.avanceMs || 0) + rot.reste + 50;
    p.tousFinisA = null; save(); tic();
  }
  function stationDe(i, tour) {
    const st = stationsBase(), nb = Math.max(P().equipes.length, st.length);
    const k = (i + tour - 1) % nb;
    return k < st.length ? st[k] : null;
  }
  function tableauRotation() {
    const p = P(), st = stationsBase(), nb = Math.max(p.equipes.length, st.length), min = Number(R().rotationMin);
    const tete = p.equipes.map(eq => `<th><span class="couleur-pastille" style="background:${couleur(eq.couleur).hex};width:18px;height:18px;display:inline-block;vertical-align:middle"></span> ${esc(eq.nom.replace(/^Équipe /, ""))}</th>`).join("");
    let lignes = "";
    for (let t = 1; t <= nb; t++) {
      lignes += `<tr><td><strong>Tour ${t}</strong><div class="douce" style="font-size:14px">${(t - 1) * min}–${t * min} min</div></td>${p.equipes.map((eq, i) => { const e = stationDe(i, t); return `<td>${e ? `<strong>${e.id}</strong> <span class="douce">${esc(e.nom)}</span>` : `<span class="douce">pause dossier</span>`}</td>`; }).join("")}</tr>`;
    }
    return `<table class="liste rotation"><thead><tr><th></th>${tete}</tr></thead><tbody>${lignes}</tbody></table>`;
  }
  let annonceT = null;
  function annoncerTour(t) {
    const p = P(), el = $("#annonce");
    if (!el) return;
    const lignes = p.equipes.map((eq, i) => { const e = stationDe(i, t); const c = couleur(eq.couleur); return `<div class="an-l"><span class="an-p" style="background:${c.hex}"></span><strong>${esc(eq.nom)}</strong><span>→ ${e ? `<strong>${e.id}</strong> · ${esc(e.nom)}` : "pause dossier"}</span></div>`; }).join("");
    el.innerHTML = `<div class="an-boite" data-a="fermerAnnonce"><div class="an-t">On tourne !</div><div class="an-s">Tour ${t} · passez à la station suivante</div><div class="an-lignes">${lignes}</div><div class="an-f">Touchez pour fermer</div></div>`;
    el.classList.remove("cache");
    clearTimeout(annonceT); annonceT = setTimeout(() => el.classList.add("cache"), 12000);
  }

  function annoncerBonus(e) {
    const el = $("#annonce");
    if (!el) return;
    el.innerHTML = `<div class="an-boite" data-a="fermerAnnonce"><div class="an-t">Nouvelle énigme !</div><div class="an-s">${esc(e.id)} · ${esc(e.nom)} · ${esc(e.domaine)}</div><div class="an-l" style="justify-content:center"><span>Une nouvelle table vient d'ouvrir. Les équipes qui ont fini leur station peuvent y aller, à tour de rôle. Elle rapporte ${PTS.enigme} points.</span></div><div class="an-f">Touchez pour fermer</div></div>`;
    el.classList.remove("cache");
    clearTimeout(annonceT); annonceT = setTimeout(() => el.classList.add("cache"), 15000);
  }

  /* ------------------------------------------------------------------ */
  /* Son, écran allumé, plein écran                                      */
  /* ------------------------------------------------------------------ */
  let ctx = null;
  function son(type) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = {
        ok: [[660, 0, .12, "sine"], [990, .12, .22, "sine"]],
        err: [[160, 0, .45, "sawtooth"]],
        tic: [[880, 0, .05, "square"]],
        fin: [[523, 0, .2, "triangle"], [659, .2, .2, "triangle"], [784, .4, .2, "triangle"], [1047, .6, .5, "triangle"]],
        alarme: [[440, 0, .3, "square"], [330, .35, .3, "square"], [440, .7, .3, "square"], [330, 1.05, .3, "square"]]
      }[type] || [];
      const t0 = ctx.currentTime;
      notes.forEach(([f, d, dur, forme]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = forme; o.frequency.value = f;
        g.gain.setValueAtTime(.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(.25, t0 + d + .01);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + d + dur);
        o.connect(g).connect(ctx.destination); o.start(t0 + d); o.stop(t0 + d + dur + .05);
      });
    } catch (e) { /* pas de son, pas grave */ }
  }
  let verrouEcran = null;
  async function garderEcranAllume() {
    try { if ("wakeLock" in navigator && !verrouEcran) { verrouEcran = await navigator.wakeLock.request("screen"); verrouEcran.addEventListener("release", () => { verrouEcran = null; }); } } catch (e) { /* refusé */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") garderEcranAllume(); });
  function pleinEcran() {
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { /* non pris en charge */ }
  }

  /* ------------------------------------------------------------------ */
  /* Fenêtres, toasts, code animateur                                    */
  /* ------------------------------------------------------------------ */
  let modal = null; // { rendu: () => html, ... }
  function ouvrir(m) { modal = m; rendreModal(); }
  function fermer() { modal = null; rendreModal(); }
  function rendreModal() {
    const el = $("#modal");
    if (!modal) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="voile" data-a="voile"><div class="fenetre ${modal.large ? "large" : ""}" data-stop>${modal.rendu()}</div></div>`;
  }
  let toastT = null;
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.classList.remove("cache");
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.add("cache"), 2600);
  }

  function demander(titre, texte, libelleOui, surOui) {
    ouvrir({ surOui, rendu: () => `<div class="entete"><h2>${esc(titre)}</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
      <p style="font-size:19px">${esc(texte)}</p><div class="ligne mt"><button class="btn" data-a="oui">${esc(libelleOui)}</button><button class="btn contour" data-a="fermer">Annuler</button></div>` });
  }

  let adminJusqua = 0;
  // Après une remise à zéro : on recharge l'appli sur l'accueil, sans réécrire ce qui vient d'être effacé
  function recharger(sansSauver) {
    if (sansSauver) window.__razEnCours = true;
    location.replace(location.pathname + "#accueil"); location.reload();
  }
  function avecCode(suite, toujours) {
    if (!R().pin || (now() < adminJusqua && !toujours)) { suite(); return; }
    const m = {
      saisie: "", erreur: false,
      rendu() {
        return `<div class="entete"><h2>${toujours ? "Confirmez avec le code animateur" : "Code animateur"}</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
          ${saisieHTML(this.saisie, R().pin.length, this.erreur ? "erreur" : "")}
          ${paveHTML("pin")}`;
      },
      touche(k) {
        if (k === "eff") this.saisie = this.saisie.slice(0, -1);
        else if (k === "ok") return this.valider();
        else if (this.saisie.length < R().pin.length) this.saisie += k;
        this.erreur = false;
        if (this.saisie.length === R().pin.length) return this.valider();
        rendreModal();
      },
      valider() {
        if (this.saisie === R().pin) { adminJusqua = now() + 10 * 60000; fermer(); suite(); }
        else { this.erreur = true; this.saisie = ""; son("err"); rendreModal(); }
      }
    };
    ouvrir(m);
  }

  function saisieHTML(valeur, n, etat) {
    let h = `<div class="saisie ${etat || ""}">`;
    for (let i = 0; i < n; i++) h += `<div class="case ${i === valeur.length ? "active" : ""}">${esc(valeur[i] || "")}</div>`;
    return h + "</div>";
  }
  function paveHTML(cible) {
    const t = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "eff", "0", "ok"];
    return `<div class="pave">${t.map(k => `<button data-a="pave" data-cible="${cible}" data-k="${k}" class="${k === "ok" ? "valider" : k === "eff" ? "effacer" : ""}">${k === "eff" ? "Effacer" : k === "ok" ? "Valider" : k}</button>`).join("")}</div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Partie                                                              */
  /* ------------------------------------------------------------------ */
  function nouvellePartie() {
    const nb = R().nbEquipes;
    store.partie = {
      phase: "brief",
      creeLe: now(),
      equipes: R().equipes.slice(0, nb).map((e, i) => ({
        couleur: e.couleur, nom: e.nom, fiches: fichesPour(i, nb),
        resolues: [], coups: {}, erreurs: 0, verrouJusqua: 0, ficheRemise: false, accusation: null
      })),
      enquete: { debut: null, pauseDebut: null, pauseCumul: 0, bonusMs: 0 },
      finale: { debut: null, pauseDebut: null, pauseCumul: 0, penalites: 0, ouvertA: null },
      etape: 0,
      finSonnee: false,
      stations: R().actives.slice(),
      bonus: []
    };
    save();
    aller("jeu");
  }

  /* Indices connus d'une équipe : celui de chaque énigme résolue (ou le premier libre si déjà connu),
     et tous les indices restants quand l'équipe a résolu toutes les énigmes de la séance. */
  function indicesConnus(eq) {
    const N = S.indices.length, connus = new Set();
    for (const r of eq.resolues) {
      const e = enigme(r.id);
      let n = e && e.indice;
      if (!n || n > N || connus.has(n)) { n = 0; for (let k = 1; k < N; k++) if (!connus.has(k)) { n = k; break; } }
      if (n) connus.add(n);
    }
    if (stationsBase().every(e => eq.resolues.some(r => r.id === e.id))) for (let k = 1; k <= N; k++) connus.add(k);
    return connus;
  }
  function saisirCode(iEq, code) {
    const p = P(), eq = p.equipes[iEq];
    const e = actives().find(x => codeDe(x) === code);
    if (e && eq.resolues.some(r => r.id === e.id)) return { type: "deja", e };
    if (!e) {
      eq.erreurs++; eq.verrouJusqua = now() + R().penaliteSec * 1000; save(); son("err");
      return { type: "faux" };
    }
    const avant = indicesConnus(eq);
    eq.resolues.push({ id: e.id, t: now() }); save(); son("ok");
    const k = eq.resolues.length;
    const nouveaux = [...indicesConnus(eq)].filter(n => !avant.has(n)).sort((x, y) => x - y).map(n => ({ n, ...S.indices[n - 1] }));
    return { type: "ok", e, indices: nouveaux, rang: k, fiche: k === R().seuilManuel && eq.fiches.length ? eq.fiches : null };
  }

  /* ------------------------------------------------------------------ */
  /* Routage                                                             */
  /* ------------------------------------------------------------------ */
  function vue() { return (location.hash || "#").slice(1) || "accueil"; }
  function aller(v) { if (vue() === v) rendre(); else location.hash = v === "accueil" ? "" : v; }
  window.addEventListener("hashchange", () => { modal = null; rendreModal(); rendre(); });

  function rendre() {
    const v = vue();
    document.body.classList.toggle("ecran-noir", v === "station" || v === "boitier");
    const app = $("#app");
    if (v === "reglages") app.innerHTML = vueReglages();
    else if (v === "jeu" && P()) app.innerHTML = vueJeu();
    else if (v === "station") app.innerHTML = vueStation();
    else if (v === "boitier") app.innerHTML = vueBoitier();
    else app.innerHTML = vueAccueil();
    if (v === "jeu" && P() && ["enquete", "finale"].includes(P().phase)) garderEcranAllume();
    if (v === "station" || v === "boitier") garderEcranAllume();
    tic();
  }

  function barre(contenuDroite) {
    return `<header class="topbar">
      <div class="brand"><span class="etiquette">ISEN Méditerranée · Fablab</span><span class="titre">${esc(S.titre)}</span></div>
      <div class="spacer"></div>${contenuDroite || ""}
      <button class="icon-btn" data-a="pleinecran" aria-label="Plein écran" title="Plein écran">⤢</button>
    </header>`;
  }

  /* ------------------------------------------------------------------ */
  /* Accueil                                                             */
  /* ------------------------------------------------------------------ */
  function vueAccueil() {
    const p = P();
    const reprise = p ? `<button class="tuile-menu" data-a="aller" data-v="jeu"><span class="etiquette">Partie en cours</span><strong>Reprendre la partie</strong><span>${p.equipes.length} équipes · phase : ${esc(libellePhase(p.phase))}</span></button>` : "";
    return barre() + `<main class="page"><div class="accueil-hero">
      <section class="panneau rouge pile hero-pixel"><img class="mascotte" src="img/pixel.png" alt="PIXEL, la mascotte du Fablab"><span class="etiquette" style="color:#fff">Jeu d'enquête · 1h30 · 2 à 6 équipes</span>
        <h1>${esc(S.titre)}</h1><p style="font-size:22px">${esc(S.accroche)}</p>
        <p style="margin-top:auto;opacity:.9">Application du maître du jeu. Elle fonctionne hors ligne une fois installée sur la tablette.<br><span style="font-size:14px;opacity:.8">Version ${VERSION_APP}</span></p></section>
      <section class="pile">${reprise}
        <button class="tuile-menu" data-a="nouvelle"><span class="etiquette">Animateur</span><strong>Nouvelle partie</strong><span>Vérifie les réglages, puis lance le briefing.</span></button>
        <div class="grille g2">
          <button class="tuile-menu" data-a="aller" data-v="station"><span class="etiquette">2e tablette · Énigme en plus E9</span><strong>Station circuit</strong><span>Si tu ajoutes E9 : Makey Makey branché en USB.</span></button>
          <button class="tuile-menu" data-a="aller" data-v="boitier"><span class="etiquette">2e tablette · Finale</span><strong>Boîtier virtuel</strong><span>Le système de sécurité PIXEL-LOCK.</span></button>
        </div>
        <button class="tuile-menu" data-a="reglages"><span class="etiquette">Animateur</span><strong>Réglages</strong><span>Équipes, durées, énigmes, codes, QR code de fin.</span></button>
      </section></div></main>`;
  }
  function libellePhase(ph) { return { brief: "Briefing", enquete: "Enquête", accusation: "Accusation", finale: "Finale", revelation: "Révélation" }[ph] || ph; }

  /* ------------------------------------------------------------------ */
  /* Réglages                                                            */
  /* ------------------------------------------------------------------ */
  function vueReglages() {
    const r = R();
    const minutes = actives().reduce((a, e) => a + e.minutes, 0);
    const equipes = r.equipes.slice(0, r.nbEquipes).map((e, i) => {
      const c = couleur(e.couleur);
      return `<div class="ligne"><span class="couleur-pastille" style="background:${c.hex}"></span>
        <div class="champ" style="flex:1"><input type="text" value="${esc(e.nom)}" data-set="equipe" data-i="${i}" aria-label="Nom de l'équipe ${i + 1}"></div>
        <span class="douce fiche-label">${esc(nomsFiches(fichesPour(i, r.nbEquipes)) || "pas de fiche")}</span></div>`;
    }).join("");
    const lignes = S.enigmes.map(e => `<tr>
      <td><input type="checkbox" class="coche" data-set="active" data-id="${e.id}" ${r.actives.includes(e.id) ? "checked" : ""} aria-label="Jouer ${esc(e.nom)}"></td>
      <td><strong>${e.id}</strong></td><td>${esc(e.nom)}</td><td class="douce">${esc(e.domaine)}</td><td>${e.minutes} min</td>
      <td><input type="text" inputmode="numeric" maxlength="4" value="${esc(codeDe(e))}" data-set="code" data-id="${e.id}" aria-label="Code de ${esc(e.nom)}"></td></tr>`).join("");
    return barre(`<button class="btn contour petit" data-a="aller" data-v="accueil">Accueil</button>`) + `<main class="page pile">
      <h1>Réglages</h1>
      <div class="grille g2">
        <section class="panneau pile"><h2>Équipes</h2>
          <div class="stepper"><button class="icon-btn" data-a="nbEquipes" data-d="-1" aria-label="Moins d'équipes">−</button><span class="val">${r.nbEquipes}</span><button class="icon-btn" data-a="nbEquipes" data-d="1" aria-label="Plus d'équipes">+</button><span class="douce">équipes (2 à 6)</span></div>
          ${equipes}
        </section>
        <section class="panneau pile"><h2>Durées et règles</h2>
          <div class="grille g2">
            <div class="champ"><label>Enquête (minutes)</label><input type="number" min="10" max="120" value="${r.dureeEnquete}" data-set="num" data-k="dureeEnquete"></div>
            <div class="champ"><label>Finale (minutes)</label><input type="number" min="3" max="30" value="${r.dureeFinale}" data-set="num" data-k="dureeFinale"></div>
            <div class="champ"><label>Blocage après erreur (secondes)</label><input type="number" min="0" max="300" value="${r.penaliteSec}" data-set="num" data-k="penaliteSec"></div>
            <div class="champ"><label>Page du manuel après (énigmes)</label><input type="number" min="1" max="8" value="${r.seuilManuel}" data-set="num" data-k="seuilManuel"></div>
            <div class="champ"><label>Rotation des stations (minutes, 0 = circulation libre)</label><input type="number" min="0" max="30" value="${r.rotationMin}" data-set="num" data-k="rotationMin"></div>
          </div>
          <div class="champ"><label>Cachette de PIXEL (affichée à l'ouverture du boîtier et à la révélation)</label><input type="text" placeholder="${esc(S.cachette)}" value="${esc(r.cachette)}" data-set="txt" data-k="cachette"></div>
          <div class="champ"><label>Lien du QR code de fin (formulaire, inscription JPO…)</label><input type="url" placeholder="https://…" value="${esc(r.lienFin)}" data-set="txt" data-k="lienFin"></div>
          <div class="champ"><label>Code animateur (vide = pas de code)</label><input type="text" inputmode="numeric" maxlength="8" value="${esc(r.pin)}" data-set="txt" data-k="pin"></div>
        </section>
      </div>
      <section class="panneau pile"><div class="ligne"><h2 style="margin:0;flex:1">Énigmes jouées</h2><span class="etiquette-contour">${actives().length} énigmes · ~${minutes} min de jeu</span></div>
        <p class="douce">Chaque code doit être unique. Les codes modifiés ici sont gardés sur cette tablette.</p>
        <table class="liste"><thead><tr><th></th><th>#</th><th>Énigme</th><th>Domaine</th><th>Durée</th><th>Code</th></tr></thead><tbody>${lignes}</tbody></table>
      </section>
      <div class="ligne"><button class="btn grand" data-a="lancerPartie">Lancer une nouvelle partie</button><button class="btn contour" data-a="resetReglages">Revenir aux réglages d'origine</button></div>
      <section class="panneau pile"><h2 style="margin:0">Remettre l'appli à zéro</h2>
        <p class="douce" style="margin:0">Pratique après des tests. Double validation : une confirmation, puis le code animateur.</p>
        <div class="ligne"><button class="btn contour" data-a="razPartie">Effacer la partie et le boîtier</button><button class="btn" data-a="razTout">Tout effacer (réglages compris)</button></div>
      </section><div class="ligne" style="display:none"></div>
    </main>`;
  }

  /* ------------------------------------------------------------------ */
  /* Jeu                                                                 */
  /* ------------------------------------------------------------------ */
  function vueJeu() {
    const p = P();
    if (p.phase === "brief") return vueBrief();
    if (p.phase === "enquete") return vueEnquete();
    if (p.phase === "accusation") return vueAccusation();
    if (p.phase === "finale") return vueFinale();
    return vueRevelation();
  }

  function cartesSuspects() {
    return `<div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${S.suspects.map(s => `<div class="carte"><div class="num">Suspect n° ${s.n}</div><h3>${esc(s.nom)}</h3><p class="douce" style="margin:0 0 6px">${esc(s.role)}</p><p style="margin:0;font-size:16px">${esc(s.mobile)}</p></div>`).join("")}</div>`;
  }

  function vueBrief() {
    return barre(`<span class="phase-pill">Briefing</span><button class="btn contour petit" data-a="animateur">Animateur</button>`) + `<main class="page pile">
      <div class="grille g2">
        <section class="panneau pile" style="background:var(--rouge);color:#fff"><div class="mission-tete"><div><span class="etiquette" style="color:#fff">Mission</span><h1 style="color:#fff">${esc(S.titre)}</h1></div><img class="mascotte-mini" src="img/pixel.png" alt="PIXEL"></div>${S.pitch.map(t => `<p style="font-size:20px">${esc(t)}</p>`).join("")}</section>
        <section class="panneau pile"><h2>Les règles</h2><ol style="margin:0;padding-left:24px;font-size:19px">${S.regles.map(t => `<li style="margin-bottom:8px">${esc(t)}</li>`).join("")}</ol>
          <p class="douce">${actives().length} stations · ${R().dureeEnquete} minutes d'enquête · puis une finale où toutes les équipes devront coopérer.</p></section>
      </div>
      ${Number(R().rotationMin) ? `<section class="pile"><h2>Qui commence où ?</h2><p class="douce" style="margin:0">Toutes les ${R().rotationMin} minutes, la tablette sonne « On tourne ! » : chaque équipe passe à la station suivante.</p>${tableauRotation()}</section>` : ""}
      <section class="pile"><h2>Les suspects</h2>${cartesSuspects()}</section>
      <div class="ligne"><button class="btn grand" data-a="lancerEnquete">Lancer l'enquête · ${R().dureeEnquete}:00</button></div>
    </main>`;
  }

  function tuileEquipe(eq, i, mode) {
    const c = couleur(eq.couleur);
    const n = actives().length;
    const puces = actives().map((e, k) => `<span class="puce ${k < eq.resolues.length ? "pleine" : ""}"></span>`).join("");
    let bas = "", verrou = "";
    if (mode === "enquete") {
      const rot = rotation();
      if (rot && !rot.fini) { const e = stationDe(i, rot.tour); bas += `<span class="badge-station">${e ? "Station " + e.id + " · " + esc(e.nom) + (stationFinie(i, rot.tour) ? " ✓ finie" : "") : "Pause : relisez votre dossier"}</span>`; }
      bas += `<div class="cta">Saisir un code</div>`;
      if (eq.verrouJusqua > now()) verrou = `<div class="verrou" data-verrou="${i}"><span>Clavier bloqué</span><span class="gros" data-reste="${i}">${fmt(eq.verrouJusqua - now())}</span><span style="font-size:15px;font-weight:600">Mauvais code : −${PTS.erreur} points</span></div>`;
    } else if (mode === "accusation") {
      bas = `<div class="cta">${eq.accusation ? "Accusation déposée ✓" : "Déposer l'accusation"}</div>`;
    }
    const fiche = eq.fiches.length && eq.resolues.length >= R().seuilManuel ? `<span class="badge-fiche">${eq.ficheRemise ? "Fiche " + eq.fiches.join("+") + " remise" : "Fiche " + eq.fiches.join("+") + " à remettre"}</span>` : "";
    return `<button class="tuile-equipe ${c.texte !== "#fff" ? "texte-encre" : ""}" style="background:${c.hex}" data-a="${mode === "accusation" ? "accuser" : "equipe"}" data-i="${i}">
      <span class="nom">${esc(eq.nom)}</span>
      <div class="stats"><span><span class="gros">${eq.resolues.length}</span> / ${n} énigmes</span><span><span class="gros">${scoreEquipe(eq, false)}</span> pts</span></div>
      <div class="puces">${puces}</div>${fiche}${bas}${verrou}</button>`;
  }

  function tuileBonus(e) {
    const p = P(), faites = p.equipes.filter(eq => eq.resolues.some(r => r.id === e.id));
    const pastilles = p.equipes.map(eq => `<span class="pastille-bonus ${eq.resolues.some(r => r.id === e.id) ? "ok" : ""}" style="background:${couleur(eq.couleur).hex}"></span>`).join("");
    return `<button class="tuile-equipe tuile-bonus" data-a="bonusTuile" data-id="${e.id}">
      <span class="etiquette" style="color:rgba(255,252,247,.75)">Énigme en plus · ${esc(e.domaine)}</span>
      <span class="nom">${esc(e.id)} · ${esc(e.nom)}</span>
      <div class="pastilles">${pastilles}<span style="margin-left:8px">${faites.length} / ${p.equipes.length} équipes</span></div>
      <div class="cta">Saisir un code</div></button>`;
  }
  function fenetreChoixEquipe(e) {
    return {
      rendu() {
        const p = P();
        const boutons = p.equipes.map((eq, i) => {
          const c = couleur(eq.couleur), fait = eq.resolues.some(r => r.id === e.id), bloque = eq.verrouJusqua > now();
          return `<button class="choix-equipe ${c.texte !== "#fff" ? "texte-encre" : ""}" style="background:${c.hex}" data-a="equipe" data-i="${i}" ${fait || bloque ? "disabled" : ""}>${esc(eq.nom)}${fait ? "<small>déjà résolue ✓</small>" : bloque ? "<small>clavier bloqué</small>" : ""}</button>`;
        }).join("");
        return `<div class="entete"><h2>${esc(e.id)} · ${esc(e.nom)}</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
          <p class="centre" style="font-size:20px">Quelle est votre équipe ?</p><div class="grille g2">${boutons}</div>`;
      }
    };
  }

  function vueEnquete() {
    const p = P();
    const enPause = !!p.enquete.pauseDebut;
    return barre(`<span class="phase-pill">${enPause ? "En pause" : "Enquête"}</span>${rotation() ? `<button class="rot" id="rot" data-a="tourSuivant">Tour –</button>` : ""}<span class="chrono" id="chrono">--:--</span>
        <button class="btn contour petit" data-a="dossierGeneral">Suspects</button><button class="btn contour petit" data-a="animateur">Animateur</button>`) +
      `<main class="page pile"><div class="equipes">${p.equipes.map((eq, i) => tuileEquipe(eq, i, "enquete")).join("")}</div>
       ${(p.bonus || []).length ? `<div class="equipes">${p.bonus.map(id => tuileBonus(enigme(id))).join("")}</div>` : ""}
       <p class="douce centre">Touche la couleur de ton équipe pour saisir un code, demander un coup de pouce ou relire ton dossier.</p></main>`;
  }

  function vueAccusation() {
    const p = P();
    const manquantes = p.equipes.filter(eq => eq.fiches.length && !eq.ficheRemise);
    return barre(`<span class="phase-pill">Accusation</span><button class="btn contour petit" data-a="dossierGeneral">Suspects</button><button class="btn contour petit" data-a="animateur">Animateur</button>`) +
      `<main class="page pile"><section class="panneau"><h2>Qui a pris PIXEL, et comment ?</h2><p style="font-size:19px;margin:0">Chaque équipe désigne en secret un suspect et une méthode. Bon coupable : +${PTS.coupable} points. Bonne méthode : +${PTS.methode} points. Les réponses restent cachées jusqu'à la révélation.</p></section>
       <div class="equipes">${p.equipes.map((eq, i) => tuileEquipe(eq, i, "accusation")).join("")}</div>
       ${manquantes.length ? `<section class="panneau pile"><h3>Avant la finale, remettre les pages du manuel</h3>${manquantes.map(eq => `<div class="ligne"><span class="couleur-pastille" style="background:${couleur(eq.couleur).hex}"></span><span style="flex:1">${esc(eq.nom)} : ${esc(nomsFiches(eq.fiches))}</span><button class="btn petit bleu" data-a="ficheRemise" data-i="${p.equipes.indexOf(eq)}">Fiche remise</button></div>`).join("")}</section>` : ""}
       <div class="ligne"><button class="btn grand" data-a="versFinale">Passer à la finale</button></div></main>`;
  }

  function vueFinale() {
    const p = P(), f = p.finale;
    const lance = !!f.debut, enPause = !!f.pauseDebut;
    const repart = p.equipes.map(eq => `<div class="ligne"><span class="couleur-pastille" style="background:${couleur(eq.couleur).hex}"></span><strong style="flex:1">${esc(eq.nom)}</strong><span>${esc(nomsFiches(eq.fiches) || "aide les autres équipes")}</span></div>`).join("");
    return barre(`<span class="phase-pill">Finale</span><button class="btn contour petit" data-a="animateur">Animateur</button>`) +
      `<main class="page pile"><div class="grille g2">
        <section class="panneau nuit pile centre" style="justify-content:center"><span class="etiquette" style="color:var(--creme)">Système de sécurité PIXEL-LOCK</span>
          <div class="chrono" id="chrono" style="font-size:120px;color:#fff">--:--</div>
          <p>Erreurs : <strong>${f.penalites}</strong> (−30 s chacune)</p>
          <div class="ligne" style="justify-content:center">
            ${!lance ? `<button class="btn grand" data-a="finaleDemarrer">Démarrer la finale</button>` : enPause ? `<button class="btn" data-a="finalePause">Reprendre</button>` : `<button class="btn contour" style="color:#fff;border-color:#fff" data-a="finalePause">Pause</button>`}
            ${lance ? `<button class="btn bleu" data-a="finaleErreur">Erreur −30 s</button><button class="btn" data-a="finaleOuvert">Boîtier ouvert !</button>` : ""}
          </div></section>
        <section class="panneau pile"><h2>Qui a quelle page du manuel</h2>${repart}
          <p class="douce">Une personne de chaque équipe manipule le boîtier à tour de rôle, sans jamais voir de manuel. On ne manipule jamais le module dont son équipe a le manuel.</p></section>
      </div></main>`;
  }

  function vueRevelation() {
    const p = P(), et = p.etape || 0;
    const sol = S.suspects.find(s => s.n === S.solution.suspect);
    const meth = S.methodes.find(m => m.id === S.solution.methode);
    const temps = p.finale.ouvertA && p.finale.debut ? fmt(p.finale.ouvertA - p.finale.debut - p.finale.pauseCumul + p.finale.penalites * PENALITE_FINALE_MS) : null;
    let corps = "";
    if (et === 0) {
      corps = `<section class="panneau pile centre" style="background:var(--rouge);color:#fff;padding:64px"><span class="etiquette" style="color:#fff">Système déverrouillé${temps ? " en " + temps : ""}</span><h1 style="color:#fff;font-size:56px">${esc(cachette())}</h1><img class="mascotte-ouvert" src="img/pixel.png" alt="PIXEL"><p style="font-size:22px">Allez chercher PIXEL !</p></section>`;
    } else if (et === 1) {
      const res = p.equipes.map(eq => {
        const a = eq.accusation; const s = a && S.suspects.find(x => x.n === a.suspect); const m = a && S.methodes.find(x => x.id === a.methode);
        const okS = a && a.suspect === S.solution.suspect, okM = a && a.methode === S.solution.methode;
        return `<div class="ligne carte"><span class="couleur-pastille" style="background:${couleur(eq.couleur).hex}"></span><strong style="min-width:180px">${esc(eq.nom)}</strong>
          <span style="flex:1">${a ? `${okS ? "✓" : "✗"} ${esc(s.nom)} · ${okM ? "✓" : "✗"} ${esc(m.label)}` : "Pas d'accusation"}</span>
          <strong>${a ? "+" + ((okS ? PTS.coupable : 0) + (okM ? PTS.methode : 0)) : "+0"}</strong></div>`;
      }).join("");
      corps = `<div class="grille g2"><section class="panneau pile"><span class="etiquette">Le coupable</span><h1>${esc(sol.nom)}</h1><p><strong>${esc(sol.role)}</strong> · méthode : ${esc(meth.label)}</p><p style="font-size:19px">${esc(S.solution.explication)}</p></section>
        <section class="pile"><h2>Vos accusations</h2>${res}</section></div>`;
    } else if (et === 2) {
      const cl = p.equipes.map(eq => ({ eq, s: scoreEquipe(eq, true) })).sort((a, b) => b.s - a.s);
      corps = `<section class="pile"><h1>Classement</h1>${cl.map((x, k) => {
        const coups = Object.values(x.eq.coups).reduce((a, n) => a + n, 0);
        return `<div class="podium-ligne ${k === 0 ? "premier" : ""}"><span class="rang">${k + 1}</span><div><strong style="font-size:22px">${esc(x.eq.nom)}</strong><div style="font-size:15px;opacity:.85">${pl(x.eq.resolues.length, "énigme")} · ${pl(coups, "coup", "coups")} de pouce · ${pl(x.eq.erreurs, "erreur")}</div></div><span class="pts">${x.s} pts</span></div>`;
      }).join("")}</section>`;
    } else if (et === 3) {
      corps = `<section class="pile"><h1>Ce que tu viens de faire</h1><div class="grille g2">${actives().map(e => `<div class="carte"><div class="num">${e.id} · ${esc(e.domaine)}</div><h3>${esc(e.nom)}</h3><p>${esc(e.debrief.fait)}</p><p class="douce" style="margin:0">${esc(e.debrief.isen)}</p></div>`).join("")}</div></section>`;
    } else {
      let qr = "";
      if (R().lienFin && window.qrcode) {
        try { const q = window.qrcode(0, "M"); q.addData(R().lienFin); q.make(); qr = `<div class="qr">${q.createSvgTag({ cellSize: 8, margin: 2, scalable: true })}</div>`; } catch (e) { qr = ""; }
      }
      corps = `<section class="panneau pile centre" style="padding:48px;align-items:center"><span class="etiquette">Cellule d'enquête du Fablab ISEN</span><h1 style="max-width:900px">${esc(S.messageFinal)}</h1>${qr}${qr ? `<p class="douce">Scanne pour recevoir ton diplôme d'enquêteur et les prochaines dates.</p>` : ""}</section>`;
    }
    const nav = `<div class="ligne" style="justify-content:space-between">${et > 0 ? `<button class="btn contour" data-a="etape" data-d="-1">Précédent</button>` : "<span></span>"}
      ${et < 4 ? `<button class="btn grand" data-a="etape" data-d="1">${["La solution", "Le classement", "Le débrief", "Le mot de la fin"][et]}</button>` : `<button class="btn grand" data-a="terminer">Terminer la partie</button>`}</div>`;
    return barre(`<span class="phase-pill">Révélation</span>`) + `<main class="page pile">${corps}${nav}</main>`;
  }

  /* --- Fenêtres de l'enquête --- */
  function fenetreEquipe(i) {
    const p = P(), eq = p.equipes[i], c = couleur(eq.couleur);
    const entete = titre => `<div class="entete"><span class="pastille" style="background:${c.hex}"></span><h2>${esc(titre)}</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>`;
    const m = {
      i, saisie: "", etat: "", resultat: null, choix: null, confirme: false, onglet: "code",
      rendu() {
        if (this.onglet === "resultat") return entete(eq.nom) + this.vueResultat();
        if (this.onglet === "coups") return entete(eq.nom + " · coup de pouce") + this.vueCoups();
        if (this.onglet === "dossier") return entete(eq.nom + " · dossier d'enquête") + this.vueDossier();
        return entete(eq.nom) + `<p class="centre douce">Tape le code à 4 chiffres trouvé à une station, puis appuie sur Valider.</p>${saisieHTML(this.saisie, 4, this.etat)}${paveHTML("equipe")}
          <div class="ligne mt" style="justify-content:center"><button class="btn contour" data-a="onglet" data-o="coups">Coup de pouce</button><button class="btn contour" data-a="onglet" data-o="dossier">Dossier d'enquête (${eq.resolues.length})</button></div>`;
      },
      vueResultat() {
        const r = this.resultat;
        if (r.type === "deja") return `<div class="carte centre"><h3>Énigme déjà résolue</h3><p>${esc(r.e.id)} · ${esc(r.e.nom)}. Pas de pénalité, va vers une autre station.</p></div><div class="ligne mt" style="justify-content:center"><button class="btn" data-a="fermer">OK</button></div>`;
        const bonus = r.indices.length > 1 ? `<p class="centre" style="margin:12px 0 0;font-weight:700">Toutes vos énigmes sont résolues : vous gagnez aussi le dernier indice !</p>` : "";
        const ind = r.indices.length ? bonus + r.indices.map(i => `<div class="carte indice mt"><div class="num">Indice n° ${i.n} · ${esc(i.titre)}</div><p style="font-size:21px;margin:6px 0 0">${esc(i.texte)}</p></div>`).join("") : `<div class="carte mt"><p style="margin:0">Pas de nouvel indice avec cette énigme. Elle rapporte quand même ${PTS.enigme} points.</p></div>`;
        const fi = r.fiche ? `<div class="carte mt" style="border:2px solid var(--bleu)"><div class="num" style="color:var(--bleu)">Pour la finale</div><p style="font-size:19px;margin:6px 0 0">Vous avez gagné votre page du manuel : <strong>${esc(nomsFiches(r.fiche))}</strong>. Allez la chercher auprès de l'animateur et gardez-la secrète.</p></div>` : "";
        return `<div class="centre"><span class="etiquette">Énigme résolue · +${PTS.enigme} points</span><h2 style="margin-top:6px">${esc(r.e.id)} · ${esc(r.e.nom)}</h2></div>${ind}${fi}<div class="ligne mt" style="justify-content:center"><button class="btn grand" data-a="fermer">Compris</button></div>`;
      },
      vueCoups() {
        const liste = actives().filter(e => !eq.resolues.some(r => r.id === e.id));
        if (!this.choix) {
          return `<p>Sur quelle énigme êtes-vous bloqués ? Coûts : ${COUTS[0]}, puis ${COUTS[1]}, puis ${COUTS[2]} points pour la solution.</p>
            <div class="grille g2">${liste.map(e => `<button class="carte choix" data-a="choixCoup" data-id="${e.id}"><div class="num">${e.id} · ${esc(e.domaine)}</div><strong>${esc(e.nom)}</strong><div class="douce" style="font-size:15px">${eq.coups[e.id] || 0} / 3 utilisés</div></button>`).join("") || "<p>Toutes vos énigmes sont résolues.</p>"}</div>
            <div class="ligne mt"><button class="btn contour" data-a="onglet" data-o="code">Retour</button></div>`;
        }
        const e = enigme(this.choix), n = eq.coups[e.id] || 0;
        const textes = [...e.coups, "Solution : " + e.solution];
        const vus = textes.slice(0, n).map((t, k) => `<div class="carte indice" style="margin-bottom:12px"><div class="num">${k < 2 ? "Coup de pouce " + (k + 1) : "Solution"}</div><p style="font-size:20px;margin:4px 0 0">${esc(t)}</p></div>`).join("");
        const suivant = n < 3 ? `<button class="btn ${this.confirme ? "" : "bleu"}" data-a="voirCoup">${this.confirme ? "Confirmer : −" + COUTS[n] + " points" : (n < 2 ? "Voir le coup de pouce " + (n + 1) : "Voir la solution") + " (−" + COUTS[n] + " pts)"}</button>` : "";
        return `<h3>${esc(e.id)} · ${esc(e.nom)}</h3>${vus || `<p class="douce">Aucun coup de pouce utilisé sur cette énigme.</p>`}
          <div class="ligne mt">${suivant}<button class="btn contour" data-a="retourCoups">Autre énigme</button><button class="btn contour" data-a="onglet" data-o="code">Saisir un code</button></div>`;
      },
      vueDossier() {
        const connus = indicesConnus(eq), N = S.indices.length;
        const cartes = S.indices.map((ind, k) => connus.has(k + 1)
          ? `<div class="carte indice"><div class="num">Indice n° ${k + 1} · ${esc(ind.titre)}</div><p style="margin:4px 0 0;font-size:19px">${esc(ind.texte)}</p></div>`
          : `<div class="carte verrouille"><div class="num" style="color:var(--encre-douce)">Indice n° ${k + 1}</div><p style="margin:4px 0 0">${k + 1 === N ? "Résolvez toutes les énigmes pour le débloquer." : "Il se cache derrière une énigme que vous n'avez pas encore résolue."}</p></div>`).join("");
        return `<div class="pile">${cartes}</div><h3 class="mt">Les suspects</h3>${cartesSuspects()}<div class="ligne mt"><button class="btn contour" data-a="onglet" data-o="code">Retour</button></div>`;
      },
      touche(k) {
        if (this.etat) return;
        if (eq.verrouJusqua > now()) { fermer(); return; }
        if (k === "eff") this.saisie = this.saisie.slice(0, -1);
        else if (k === "ok") { if (this.saisie.length === 4) this.valider(); return; }
        else if (this.saisie.length < 4) this.saisie += k;
        rendreModal();
      },
      valider() {
        if (this.etat) return;
        const r = saisirCode(this.i, this.saisie);
        if (r.type === "faux") {
          this.etat = "erreur"; rendreModal(); rendre();
          setTimeout(() => { if (modal === this) fermer(); }, 1400);
          return;
        }
        this.etat = "ok"; rendreModal();
        setTimeout(() => { if (modal !== this) return; this.resultat = r; this.onglet = "resultat"; rendreModal(); rendre(); }, 450);
      }
    };
    return m;
  }

  function fenetreAccusation(i) {
    const eq = P().equipes[i], c = couleur(eq.couleur);
    return {
      large: true,
      suspect: eq.accusation ? eq.accusation.suspect : null,
      methode: eq.accusation ? eq.accusation.methode : null,
      rendu() {
        return `<div class="entete"><span class="pastille" style="background:${c.hex}"></span><h2>${esc(eq.nom)} · accusation secrète</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
          <h3>Le coupable</h3><div class="grille" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${S.suspects.map(s => `<button class="carte choix ${this.suspect === s.n ? "choisi" : ""}" data-a="choixSuspect" data-n="${s.n}"><div class="num">Suspect n° ${s.n}</div><strong>${esc(s.nom)}</strong><div class="douce" style="font-size:15px">${esc(s.role)}</div></button>`).join("")}</div>
          <h3 class="mt">La méthode</h3><div class="grille g2">${S.methodes.map(m => `<button class="carte choix ${this.methode === m.id ? "choisi" : ""}" data-a="choixMethode" data-id="${m.id}"><strong>${esc(m.label)}</strong></button>`).join("")}</div>
          <div class="ligne mt"><button class="btn grand" data-a="validerAccusation" ${this.suspect && this.methode ? "" : "disabled"}>Valider en secret</button></div>`;
      },
      valider() { eq.accusation = { suspect: this.suspect, methode: this.methode, t: now() }; save(); son("ok"); fermer(); rendre(); toast("Accusation enregistrée. Chut !"); }
    };
  }

  function sectionAjout() {
    const act = actives(), libres = S.enigmes.filter(e => !act.some(x => x.id === e.id)).sort((x, y) => (y.pret ? 1 : 0) - (x.pret ? 1 : 0));
    if (!libres.length) return "";
    const lignes = libres.map(e => {
      const conflit = act.find(x => codeDe(x) === codeDe(e));
      return `<div class="ligne"><span style="flex:1"><strong>${esc(e.id)} · ${esc(e.nom)}</strong> <span class="douce">${esc(e.domaine)} · ${e.minutes} min${e.pret ? "" : " · matériel à préparer"}</span>${conflit ? `<br><span class="douce">Même code que ${esc(conflit.id)} : changez-le dans les Réglages pour l'ajouter.</span>` : ""}</span>
        <button class="btn petit ${conflit ? "contour" : "bleu"}" data-a="ajouterEnigme" data-id="${e.id}" ${conflit ? "disabled" : ""}>Ajouter</button></div>`;
    }).join("");
    return `<h3 class="mt">Ajouter une énigme en cours de partie</h3><p class="douce" style="margin:0 0 8px">Pour les équipes qui avancent vite : posez son matériel sur une table libre. Elle n'entre pas dans la rotation, les équipes y vont quand elles ont fini leur station.</p><div class="pile">${lignes}</div>`;
  }

  function fenetreAnimateur() {
    return {
      rendu() {
        const p = P();
        const enq = p.phase === "enquete", br = p.phase === "brief";
        const enPause = !!p.enquete.pauseDebut;
        const fiches = p.equipes.map((eq, i) => eq.fiches.length ? `<div class="ligne"><span class="couleur-pastille" style="background:${couleur(eq.couleur).hex}"></span><span style="flex:1">${esc(eq.nom)} · ${esc(nomsFiches(eq.fiches))} · ${eq.resolues.length} énigme(s)</span>
          <button class="btn petit ${eq.ficheRemise ? "contour" : "bleu"}" data-a="ficheRemise" data-i="${i}">${eq.ficheRemise ? "Remise ✓" : "Marquer remise"}</button></div>` : "").join("");
        return `<div class="entete"><h2>Animateur</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
          ${enq ? `<div class="ligne"><button class="btn" data-a="pauseEnquete">${enPause ? "Reprendre le chrono" : "Mettre en pause"}</button><button class="btn contour" data-a="bonus" data-d="5">+5 min</button><button class="btn contour" data-a="bonus" data-d="-5">−5 min</button></div>` : ""}
          ${!br ? `<h3 class="mt">Pages du manuel</h3><div class="pile">${fiches}</div>` : ""}
          ${enq ? sectionAjout() : ""}
          <h3 class="mt">Phase</h3><div class="ligne">
            ${enq && rotation() && !rotation().fini ? `<button class="btn" data-a="tourSuivant">Tour suivant maintenant</button>` : ""}
            ${enq ? `<button class="btn bleu" data-a="versAccusation">Fin de l'enquête → accusation</button>` : ""}
            ${p.phase === "accusation" ? `<button class="btn bleu" data-a="versFinale">Passer à la finale</button>` : ""}
            ${p.phase === "finale" ? `<button class="btn bleu" data-a="finaleOuvert">Aller à la révélation</button>` : ""}
            <button class="btn contour" data-a="aller" data-v="accueil">Accueil (la partie reste en mémoire)</button>
          </div>`;
      }
    };
  }

  function fenetreSuspects() {
    return { large: true, rendu() { return `<div class="entete"><h2>Les suspects</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>${cartesSuspects()}`; } };
  }

  /* ------------------------------------------------------------------ */
  /* Station circuit (E2, Makey Makey)                                   */
  /* ------------------------------------------------------------------ */
  /* Le Makey Makey se comporte comme un clavier : tant qu'un circuit est fermé entre une porte
     (touche Haut, Bas, Gauche ou Droite) et la bande MASSE (Earth), la touche reste enfoncée.
     Chaque case affiche son chiffre tant que son circuit est fermé. La touche Espace = zone interdite. */
  const stationFerme = {};          // touche -> true tant que le circuit est fermé
  let stationTest = {};             // cases allumées au doigt (mode test)
  let stationAlarmeT = null;
  function vueStation() {
    const e2 = enigme("E9");
    const cases = S.stationCircuit.map(p => {
      const on = stationFerme[p.touche] || stationTest[p.touche];
      return `<button class="porte-case ${on ? "on" : ""}" data-a="stationTest" data-touche="${p.touche}" data-porte="${p.touche}">
        <span class="porte-nom">${esc(p.porte)}</span><span class="porte-chiffre">${on ? esc(p.chiffre) : "?"}</span>
        <span class="porte-etat">${on ? "circuit fermé" : "circuit ouvert"}</span></button>`;
    }).join("");
    return `<header class="topbar" style="border-color:rgba(255,252,247,.15)"><div class="brand"><span class="etiquette" style="color:rgba(255,252,247,.7)">Station E9</span><span class="titre" style="color:#fff">${esc(e2 ? e2.nom : "Station circuit")}</span></div><div class="spacer"></div>
      <button class="btn contour petit" style="color:#fff;border-color:rgba(255,255,255,.6)" data-a="quitterStation">Quitter</button><button class="icon-btn" style="color:#fff;border-color:rgba(255,255,255,.6)" data-a="pleinecran" aria-label="Plein écran">⤢</button></header>
      <main class="station"><p style="font-size:22px;max-width:900px">Relie chaque porte à la bande MASSE avec un trait de crayon bien épais, sans toucher les zones rouges. Quand un circuit est fermé, le chiffre de sa porte s'affiche.</p>
      <div class="portes-cases">${cases}</div>
      <div id="stationAlarme" class="alarme cache">ALARME : ton trait touche une zone interdite !</div>
      <p style="opacity:.55;font-size:15px;max-width:900px">Animateur : touche une case pour la tester sans Makey Makey. Câblage : portes sur Haut, Bas, Gauche, Droite ; bande MASSE sur Earth ; zones interdites sur Espace.</p></main>`;
  }
  function stationKey(key, enfonce) {
    if (key === " " || key === "Spacebar") {
      if (enfonce) { son("err"); const a = $("#stationAlarme"); if (a) { a.classList.remove("cache"); clearTimeout(stationAlarmeT); stationAlarmeT = setTimeout(() => a.classList.add("cache"), 2500); } }
      return true;
    }
    const p = S.stationCircuit.find(x => x.touche === key);
    if (!p) return false;
    const avant = !!stationFerme[key];
    stationFerme[key] = enfonce;
    if (enfonce && !avant) son("ok");
    if (avant !== enfonce) rendre();
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Boîtier virtuel PIXEL-LOCK                                           */
  /* ------------------------------------------------------------------ */
  const FILS = { rouge: "#E30613", bleu: "#2f6fd6", vert: "#6AB87E", jaune: "#F5C400" };
  const BOUTONS = { bleu: "#2f6fd6", rouge: "#E30613", vert: "#6AB87E", blanc: "#F4F1EA" };
  const SIMON = ["rouge", "bleu", "vert", "jaune"];
  const MAP_VOYELLE = { rouge: "bleu", bleu: "jaune", vert: "vert", jaune: "rouge" };
  const MAP_SANS = { rouge: "jaune", bleu: "vert", vert: "rouge", jaune: "bleu" };
  const alea = n => Math.floor(Math.random() * n);
  const melange = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = alea(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function nouveauBoitier() {
    const L = "ABCDEFGHJKLMNPQRSTUVWXZ";
    const lettres = L[alea(L.length)] + L[alea(L.length)];
    const chiffres = String(alea(10)) + alea(10) + alea(10);
    return {
      lettres, chiffres,
      fils: melange(Object.keys(FILS)), debranche: null,
      bouton: alea(2) === 0 ? "blanc" : ["bleu", "rouge", "vert"][alea(3)],   // le blanc (le plus subtil) sort 1 fois sur 2
      sequence: [SIMON[alea(4)], SIMON[alea(4)], SIMON[alea(4)]], prog: 0,
      ok: { A: false, B: false, C: false, D: false },
      code: "", erreurs: 0, chrono: { debut: null, pauseDebut: null, pauseCumul: 0 }, ouvertA: null
    };
  }
  let B = lire(LS_BOITIER) || nouveauBoitier();
  const saveB = () => { if (!window.__razEnCours) ecrire(LS_BOITIER, B); };
  const voyelle = () => /[AEIOU]/.test(B.lettres);
  function filAttendu() {
    const f = B.fils, dernier = Number(B.chiffres[2]);
    if (f[0] === "rouge") return 3;
    const ib = f.indexOf("bleu"), iv = f.indexOf("vert");
    if (Math.abs(ib - iv) === 1) return ib;
    if (dernier % 2 === 0) return 1;
    return f.indexOf("jaune");
  }
  function boutonAttendu() {
    if (B.bouton === "bleu") return "bref";
    if (B.bouton === "rouge") return "long";
    if (B.bouton === "vert") return "double";
    return voyelle() ? "long" : "bref";
  }
  const sequenceAttendue = () => B.sequence.map(c => (voyelle() ? MAP_VOYELLE : MAP_SANS)[c]);
  const codeAttendu = () => String(S.solution.suspect) + B.chiffres.split("").reverse().join("");
  const resteBoitier = () => R().dureeFinale * 60000 - B.erreurs * PENALITE_FINALE_MS - ecoule(B.chrono);

  function erreurBoitier(msg) {
    B.erreurs++; saveB(); son("err");
    if (!B.chrono.debut) B.chrono.debut = now();
    toast(msg || "Erreur ! −30 secondes");
    document.querySelectorAll(".led").forEach(l => { l.classList.add("err"); setTimeout(() => l.classList.remove("err"), 600); });
    majEnteteBoitier();
  }
  function moduleOK(id) {
    B.ok[id] = true; saveB(); son("ok");
    if (!B.chrono.debut) B.chrono.debut = now();
    if (B.ok.A && B.ok.B && B.ok.C && B.ok.D) { B.ouvertA = now(); saveB(); son("fin"); }
    rendre();
  }
  function majEnteteBoitier() { const e = $("#bErreurs"); if (e) e.textContent = B.erreurs; }

  function vueBoitier() {
    if (B.ouvertA) {
      const t = fmt(B.ouvertA - B.chrono.debut - B.chrono.pauseCumul + B.erreurs * PENALITE_FINALE_MS);
      return `<main class="ouvert"><div class="panneau pile centre" style="background:var(--vert);color:var(--encre);max-width:900px;padding:56px">
        <span class="etiquette" style="color:var(--encre)">PIXEL-LOCK · système déverrouillé en ${t}</span><h1 style="color:var(--encre);font-size:56px">${esc(cachette())}</h1>
        <p style="font-size:20px">${pl(B.erreurs, "erreur")}. Bravo à toutes les équipes.</p>
        <div class="ligne" style="justify-content:center"><button class="btn bleu" data-a="boitierNouveau">Nouvelle combinaison</button><button class="btn contour" data-a="aller" data-v="accueil">Accueil</button></div></div></main>`;
    }
    const fils = B.fils.map((c, k) => `<button class="fil ${B.debranche === k ? "debranche" : ""}" data-a="fil" data-k="${k}" ${B.ok.A ? "disabled" : ""}><span>${k + 1}</span><span class="borne"></span><span class="cable" style="background:${FILS[c]}"></span><span class="borne"></span></button>`).join("");
    const simon = SIMON.map(c => `<button data-a="simon" data-c="${c}" data-simon="${c}" style="background:${FILS[c]};color:${FILS[c]}" ${B.ok.C ? "disabled" : ""}><span style="color:rgba(0,0,0,.55)">${c.toUpperCase()}</span></button>`).join("");
    const progC = sequenceAttendue().map((_, k) => `<span class="puce ${k < B.prog || B.ok.C ? "pleine" : ""}"></span>`).join("");
    const dFerme = !(B.ok.A && B.ok.B && B.ok.C);
    return `<div class="boitier-entete"><div class="brand"><span class="etiquette" style="color:rgba(255,252,247,.7)">Système de sécurité</span><span class="titre" style="color:#fff">PIXEL-LOCK</span></div>
        <div><div class="etiquette" style="color:rgba(255,252,247,.7)">N° de série</div><div class="afficheur">${B.lettres} ${B.chiffres}</div></div>
        <div><div class="etiquette" style="color:rgba(255,252,247,.7)">Temps restant</div><div class="chrono" id="chrono" style="color:#fff;font-size:44px">--:--</div></div>
        <div><div class="etiquette" style="color:rgba(255,252,247,.7)">Erreurs</div><div class="chrono" id="bErreurs" style="color:#fff;font-size:44px">${B.erreurs}</div></div>
        <div class="spacer" style="flex:1"></div>
        ${!B.chrono.debut ? `<button class="btn" data-a="boitierDemarrer">Démarrer</button>` : ""}
        <button class="btn contour petit" style="color:#fff;border-color:rgba(255,255,255,.6)" data-a="boitierMenu">Animateur</button>
      </div>
      <main class="boitier">
        <section class="module ${B.ok.A ? "resolu" : ""}"><h3><span class="led ${B.ok.A ? "ok" : ""}"></span>Module A · Les fils</h3><p style="margin:0;opacity:.75;font-size:15px">Touchez un fil pour le débrancher.</p><div class="fils">${fils}</div></section>
        <section class="module ${B.ok.B ? "resolu" : ""}"><h3><span class="led ${B.ok.B ? "ok" : ""}"></span>Module B · Le bouton</h3>
          <button class="gros-bouton" id="grosBouton" style="background:${BOUTONS[B.bouton]}" ${B.ok.B ? "disabled" : ""}>APPUYER</button>
          <div class="jauge"><div id="jaugeB"></div></div></section>
        <section class="module ${B.ok.C ? "resolu" : ""}"><h3><span class="led ${B.ok.C ? "ok" : ""}"></span>Module C · La séquence</h3>
          <div class="simon">${simon}</div><div class="ligne"><button class="btn contour petit" style="color:#fff;border-color:rgba(255,255,255,.6)" data-a="voirSequence" ${B.ok.C ? "disabled" : ""}>Voir la séquence</button><div class="puces" style="color:#fff">${progC}</div></div></section>
        <section class="module ${B.ok.D ? "resolu" : ""} ${dFerme ? "ferme" : ""}"><h3><span class="led ${B.ok.D ? "ok" : ""}"></span>Module D · Le code final</h3>
          <div class="afficheur" style="font-size:44px">${(B.code + "____").slice(0, 4).split("").join(" ")}</div>${paveHTML("boitier")}</section>
      </main>`;
  }

  /* Bouton du module B : appui bref, long (3 s) ou double */
  const APPUI_LONG_MS = 1500;   // appui long : jauge pleine (verte) + bip, environ 2 secondes en ressenti
  let bAppui = 0, bAttente = null, bJauge = null, bDernierBref = 0;
  function bDown() {
    if (B.ok.B || B.ouvertA) return;
    bAppui = now();
    const j = $("#jaugeB");
    clearInterval(bJauge);
    let bipe = false;
    bJauge = setInterval(() => {
      const d = now() - bAppui;
      if (j) { j.style.width = Math.min(100, d / (APPUI_LONG_MS / 100)) + "%"; j.style.background = d >= APPUI_LONG_MS ? "var(--vert)" : "var(--creme)"; }
      if (d >= APPUI_LONG_MS && !bipe) { bipe = true; son("tic"); try { navigator.vibrate && navigator.vibrate(60); } catch (e) {} }
    }, 40);
  }
  function bUp() {
    if (!bAppui) return;
    const d = now() - bAppui; bAppui = 0; clearInterval(bJauge);
    const j = $("#jaugeB"); if (j) j.style.width = "0";
    let geste;
    if (d < 700) {
      if (bAttente && now() - bDernierBref < 900) { clearTimeout(bAttente); bAttente = null; geste = "double"; }
      else { bDernierBref = now(); bAttente = setTimeout(() => { bAttente = null; evaluerBouton("bref"); }, 900); return; }
    } else if (d >= APPUI_LONG_MS && d < 8000) geste = "long";
    else geste = "invalide";
    evaluerBouton(geste);
  }
  function evaluerBouton(geste) {
    if (geste === boutonAttendu()) moduleOK("B");
    else erreurBoitier(geste === "invalide" ? "Appui ni bref ni long : −30 secondes" : "Mauvais geste : −30 secondes");
  }

  let enFlash = false;
  async function voirSequence() {
    if (enFlash) return; enFlash = true;
    for (const c of B.sequence) {
      const el = document.querySelector(`[data-simon="${c}"]`);
      if (el) el.classList.add("flash"); son("tic");
      await new Promise(r => setTimeout(r, 650));
      if (el) el.classList.remove("flash");
      await new Promise(r => setTimeout(r, 250));
    }
    enFlash = false;
  }

  function fenetreBoitierAnimateur() {
    return {
      rendu() {
        const f = B.fils[filAttendu()];
        return `<div class="entete"><h2>Boîtier · animateur</h2><button class="icon-btn" data-a="fermer" aria-label="Fermer">✕</button></div>
          <div class="carte pile"><div><strong>Module A :</strong> débrancher le fil n° ${filAttendu() + 1} (${f})</div>
          <div><strong>Module B :</strong> ${{ bref: "un appui bref", long: "maintenir jusqu'à la jauge pleine (2 s)", double: "deux appuis brefs" }[boutonAttendu()]} (bouton ${B.bouton})</div>
          <div><strong>Module C :</strong> ${sequenceAttendue().join(", ")} (séquence ${B.sequence.join(", ")}, ${voyelle() ? "avec" : "sans"} voyelle)</div>
          <div><strong>Module D :</strong> ${codeAttendu()}</div></div>
          <div class="champ mt"><label>Cachette de PIXEL affichée à l'ouverture (vide = texte par défaut)</label><input type="text" placeholder="${esc(S.cachette)}" value="${esc(R().cachette)}" data-set="txt" data-k="cachette"></div>
          <div class="ligne mt">${B.chrono.debut ? `<button class="btn" data-a="boitierPause">${B.chrono.pauseDebut ? "Reprendre le chrono" : "Mettre en pause"}</button>` : ""}<button class="btn bleu" data-a="boitierNouveau">Nouvelle combinaison</button><button class="btn contour" data-a="aller" data-v="accueil">Accueil</button></div>`;
      }
    };
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */
  const actions = {
    fermerAnnonce() { const el = $("#annonce"); if (el) el.classList.add("cache"); },
    oui() { const f = modal && modal.surOui; fermer(); if (f) f(); },
    voile(d, el, ev) { if (ev.target === el) fermer(); },
    fermer() { fermer(); },
    pleinecran() { pleinEcran(); },
    aller(d) { fermer(); aller(d.v); },
    reglages() { avecCode(() => aller("reglages")); },
    nouvelle() { avecCode(() => { if (P() && P().phase !== "revelation") demander("Une partie est en cours", "La lancer à nouveau effacera la partie en cours au moment du lancement.", "Continuer vers les réglages", () => aller("reglages")); else aller("reglages"); }); },
    lancerPartie() { if (!verifCodes()) return; nouvellePartie(); },
    razPartie() {
      demander("Effacer la partie et le boîtier ?", "La partie en cours (équipes, scores, indices) et l'état du boîtier virtuel sont effacés sur cette tablette. Les réglages (équipes, durées, codes, cachette) sont gardés.", "Continuer", () =>
        avecCode(() => { store.partie = null; save(); try { localStorage.removeItem("pixel-gm:boitier:" + S.id); } catch (e) {} recharger(); }, true));
    },
    razTout() {
      demander("Tout effacer sur cette tablette ?", "Partie, boîtier et réglages repartent de zéro, comme à la première installation : la cachette et les codes modifiés seront aussi effacés. Le code animateur redevient celui d'origine.", "Continuer", () =>
        avecCode(() => { try { Object.keys(localStorage).filter(k => k.startsWith("pixel-gm:")).forEach(k => localStorage.removeItem(k)); } catch (e) {} store.partie = null; recharger(true); }, true));
    },
    resetReglages() { demander("Revenir aux réglages d'origine ?", "Équipes, durées, énigmes cochées et codes reprennent leurs valeurs par défaut.", "Réinitialiser", () => { store.reglages = reglagesParDefaut(); save(); rendre(); }); },
    nbEquipes(d) { R().nbEquipes = Math.max(2, Math.min(6, R().nbEquipes + Number(d.d))); save(); rendre(); },
    animateur() { avecCode(() => ouvrir(fenetreAnimateur())); },
    dossierGeneral() { ouvrir(fenetreSuspects()); },
    lancerEnquete() {
      avecCode(() => { const p = P(); p.phase = "enquete"; p.enquete.debut = now(); p.tourVu = 1; save(); son("fin"); rendre(); if (rotation()) annoncerTour(1); });
    },
    bonusTuile(d) { const e = enigme(d.id); if (e) ouvrir(fenetreChoixEquipe(e)); },
    equipe(d) {
      const eq = P().equipes[Number(d.i)];
      if (eq.verrouJusqua > now()) { son("err"); return; }
      ouvrir(fenetreEquipe(Number(d.i)));
    },
    pave(d) {
      if (d.cible === "boitier") return toucheBoitier(d.k);
      if (modal && modal.touche) modal.touche(d.k);
    },
    onglet(d) { modal.onglet = d.o; modal.choix = null; modal.confirme = false; rendreModal(); },
    choixCoup(d) { modal.choix = d.id; modal.confirme = false; rendreModal(); },
    retourCoups() { modal.choix = null; modal.confirme = false; rendreModal(); },
    voirCoup() {
      const eq = P().equipes[modal.i];
      if (!modal.confirme) { modal.confirme = true; rendreModal(); return; }
      eq.coups[modal.choix] = Math.min(3, (eq.coups[modal.choix] || 0) + 1); modal.confirme = false; save(); rendreModal(); rendre();
    },
    pauseEnquete() { const t = P().enquete; if (t.pauseDebut) reprendre(t); else pause(t); save(); rendreModal(); rendre(); },
    bonus(d) { P().enquete.bonusMs = (P().enquete.bonusMs || 0) + Number(d.d) * 60000; P().finSonnee = false; save(); toast((Number(d.d) > 0 ? "+" : "−") + Math.abs(d.d) + " minutes"); rendre(); },
    ficheRemise(d) { const eq = P().equipes[Number(d.i)]; eq.ficheRemise = !eq.ficheRemise; save(); rendreModal(); rendre(); },
    versAccusation() { const p = P(); pause(p.enquete); p.phase = "accusation"; save(); fermer(); rendre(); },
    accuser(d) { ouvrir(fenetreAccusation(Number(d.i))); },
    choixSuspect(d) { modal.suspect = Number(d.n); rendreModal(); },
    choixMethode(d) { modal.methode = d.id; rendreModal(); },
    validerAccusation() { modal.valider(); },
    versFinale() {
      const p = P();
      const sans = p.equipes.filter(eq => !eq.accusation).length;
      const go = () => { p.phase = "finale"; save(); fermer(); rendre(); };
      if (sans) demander(pl(sans, "équipe") + " sans accusation", "Elles ne pourront plus accuser après. Passer quand même à la finale ?", "Passer à la finale", go);
      else go();
    },
    ajouterEnigme(d) {
      const e = enigme(d.id);
      if (!e) return;
      avecCode(() => demander(`Ajouter ${e.id} · ${e.nom} ?`, "Une annonce prévient les équipes. Son matériel doit être prêt sur une table libre. L'énigme reste dans la partie jusqu'à la fin.", "Ajouter l'énigme", () => {
        const p = P(); p.bonus = p.bonus || []; if (!p.bonus.includes(e.id)) p.bonus.push(e.id);
        p.toutResoluVu = false; save(); son("fin"); fermer(); rendre(); annoncerBonus(e);
      }));
    },
    tourSuivant() {
      const rot = rotation();
      if (!rot || rot.fini) return;
      if (P().tousFinisA) { avancerTour(); return; }
      avecCode(() => demander("Passer au tour suivant ?", `Le tour ${rot.tour} s'arrête maintenant (il restait ${fmt(rot.reste)}) et chaque équipe passe à la station suivante. Les tours suivants gardent leur durée.`, "Tourner maintenant", avancerTour));
    },
    finaleDemarrer() { P().finale.debut = now(); save(); son("fin"); rendre(); },
    finalePause() { const f = P().finale; if (f.pauseDebut) reprendre(f); else pause(f); save(); rendre(); },
    finaleErreur() { P().finale.penalites++; save(); son("err"); rendre(); },
    finaleOuvert() {
      const p = P();
      if (p.finale.debut && !p.finale.ouvertA) { reprendre(p.finale); p.finale.ouvertA = now(); }
      p.phase = "revelation"; p.etape = 0; save(); son("fin"); fermer(); rendre();
    },
    etape(d) { const p = P(); p.etape = Math.max(0, Math.min(4, (p.etape || 0) + Number(d.d))); save(); rendre(); },
    terminer() { avecCode(() => { store.partie = null; save(); aller("accueil"); }); },
    stationTest(d) { stationTest[d.touche] = !stationTest[d.touche]; if (stationTest[d.touche]) son("ok"); rendre(); },
    quitterStation() { avecCode(() => aller("accueil")); },
    fil(d) {
      if (B.ok.A) return;
      const k = Number(d.k);
      if (k === filAttendu()) { B.debranche = k; moduleOK("A"); }
      else { B.debranche = k; rendre(); setTimeout(() => { B.debranche = null; rendre(); }, 700); erreurBoitier("Mauvais fil : −30 secondes"); }
    },
    simon(d) {
      if (B.ok.C || enFlash) return;
      const att = sequenceAttendue();
      if (d.c === att[B.prog]) { B.prog++; son("tic"); if (B.prog >= att.length) moduleOK("C"); else { saveB(); rendre(); } }
      else { B.prog = 0; saveB(); erreurBoitier("Mauvaise couleur : la séquence repart de zéro, −30 secondes"); rendre(); }
    },
    voirSequence() { voirSequence(); },
    boitierDemarrer() { B.chrono.debut = now(); saveB(); son("fin"); rendre(); },
    boitierMenu() { avecCode(() => ouvrir(fenetreBoitierAnimateur())); },
    boitierPause() { if (B.chrono.pauseDebut) reprendre(B.chrono); else pause(B.chrono); saveB(); fermer(); rendre(); },
    boitierNouveau() { B = nouveauBoitier(); saveB(); fermer(); rendre(); toast("Nouvelle combinaison tirée"); }
  };

  function toucheBoitier(k) {
    if (!(B.ok.A && B.ok.B && B.ok.C) || B.ok.D) return;
    if (k === "eff") B.code = B.code.slice(0, -1);
    else if (k === "ok") {
      if (B.code === codeAttendu()) { moduleOK("D"); return; }
      B.code = ""; saveB(); erreurBoitier("Code refusé : −30 secondes"); rendre(); return;
    } else if (B.code.length < 4) { B.code += k; son("tic"); }
    saveB(); rendre();
  }

  function verifCodes() {
    const codes = actives().map(codeDe);
    if (codes.some(c => !/^\d{4}$/.test(c))) { toast("Chaque code doit avoir exactement 4 chiffres."); return false; }
    if (new Set(codes).size !== codes.length) { toast("Deux énigmes ont le même code : corrige-les."); return false; }
    if (actives().length < 1) { toast("Coche au moins une énigme."); return false; }
    return true;
  }

  document.addEventListener("click", ev => {
    const el = ev.target.closest("[data-a]");
    if (!el) return;
    const fn = actions[el.dataset.a];
    if (fn) fn(el.dataset, el, ev);
  });
  document.addEventListener("change", ev => {
    const el = ev.target; const t = el.dataset.set; if (!t) return;
    const r = R();
    if (t === "equipe") r.equipes[Number(el.dataset.i)].nom = el.value.trim() || ("Équipe " + couleur(r.equipes[Number(el.dataset.i)].couleur).nom);
    else if (t === "num") { const v = parseInt(el.value, 10); if (!isNaN(v)) r[el.dataset.k] = Math.max(Number(el.min || 0), Math.min(Number(el.max || 999), v)); }
    else if (t === "txt") r[el.dataset.k] = el.value.trim();
    else if (t === "code") { const v = el.value.replace(/\D/g, "").slice(0, 4); const e = enigme(el.dataset.id); if (v === e.code) delete r.codes[e.id]; else r.codes[e.id] = v; }
    else if (t === "active") { const id = el.dataset.id; r.actives = el.checked ? S.enigmes.filter(e => r.actives.includes(e.id) || e.id === id).map(e => e.id) : r.actives.filter(x => x !== id); }
    save();
    if (t === "active" || t === "num") rendre();
  });
  document.addEventListener("keyup", ev => { if (vue() === "station" && stationKey(ev.key, false)) ev.preventDefault(); });
  window.addEventListener("blur", () => { Object.keys(stationFerme).forEach(k => { stationFerme[k] = false; }); });
  document.addEventListener("pointerdown", ev => { if (ev.target.closest("#grosBouton")) { ev.preventDefault(); bDown(); } });
  document.addEventListener("pointerup", () => bUp());
  document.addEventListener("pointercancel", () => bUp());
  document.addEventListener("keydown", ev => {
    if (vue() === "station") { if (ev.repeat) { ev.preventDefault(); return; } if (stationKey(ev.key, true)) ev.preventDefault(); return; }
    if (ev.target.matches && ev.target.matches("input")) return;
    if (modal && modal.touche && /^[0-9]$/.test(ev.key)) { modal.touche(ev.key); ev.preventDefault(); }
    else if (modal && modal.touche && ev.key === "Backspace") modal.touche("eff");
    else if (modal && modal.touche && ev.key === "Enter") { modal.touche("ok"); ev.preventDefault(); }
    else if (modal && ev.key === "Escape") fermer();
  });

  /* ------------------------------------------------------------------ */
  /* Horloge                                                             */
  /* ------------------------------------------------------------------ */
  function tic() {
    const v = vue(), el = $("#chrono");
    if (v === "jeu" && P()) {
      const p = P();
      if (el && p.phase === "enquete") {
        const r = resteEnquete();
        el.textContent = fmt(Math.max(0, r));
        el.classList.toggle("alerte", r > 0 && r < 5 * 60000);
        el.classList.toggle("fini", r <= 0);
        if (r <= 0 && !p.finSonnee) { p.finSonnee = true; save(); son("alarme"); toast("Temps écoulé ! L'animateur passe à l'accusation."); }
        const rot = rotation(), zr = $("#rot");
        if (rot) {
          const fin = !rot.fini && r > 0 && !p.enquete.pauseDebut && tousFinis(rot);
          if (fin && !p.tousFinisA) { p.tousFinisA = now(); save(); son("ok"); toast("Toutes les équipes ont fini leur station : on tourne dans 20 secondes."); }
          if (!fin && p.tousFinisA) { p.tousFinisA = null; save(); }
          if (fin && now() - p.tousFinisA >= DELAI_TOUR_MS) { avancerTour(); return; }
          if (zr) {
            zr.textContent = rot.fini ? "Temps libre" : fin ? `Tous ont fini · on tourne dans ${Math.ceil((DELAI_TOUR_MS - (now() - p.tousFinisA)) / 1000)} s` : `Tour ${rot.tour}/${rot.nb} · ${fmt(rot.reste)}`;
            zr.classList.toggle("tous-finis", fin);
          }
          if (rot.fini && r > 0 && !p.toutResoluVu && p.equipes.every(eq => eq.resolues.length >= actives().length)) {
            p.toutResoluVu = true; save(); son("ok"); toast("Toutes les équipes ont résolu toutes les énigmes : vous pouvez passer à l'accusation (menu Animateur).");
          }
          const vu = p.tourVu || 1;
          if (rot.tour > vu && r > 0) {
            p.tourVu = rot.tour; save(); son("alarme");
            if (!rot.fini) annoncerTour(rot.tour); else toast("Fin des tours : finissez vos énigmes en cours.");
            rendre();
          }
        }
      }
      if (el && p.phase === "finale") {
        const r = p.finale.debut ? resteFinale() : R().dureeFinale * 60000;
        el.textContent = fmt(r);
        el.classList.toggle("fini", r <= 0);
      }
      if (p.phase === "enquete") {
        let relance = false;
        p.equipes.forEach((eq, i) => {
          const z = document.querySelector(`[data-reste="${i}"]`);
          if (z) { const r = eq.verrouJusqua - now(); if (r <= 0) relance = true; else z.textContent = fmt(r); }
        });
        if (relance) rendre();
      }
    } else if (v === "boitier" && el && !B.ouvertA) {
      const r = B.chrono.debut ? resteBoitier() : R().dureeFinale * 60000;
      el.textContent = r < 0 ? "Prolong." : fmt(r);
    }
  }
  setInterval(tic, 250);

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  rendre();
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    const avaitControleur = !!navigator.serviceWorker.controller;
    let recharge = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!avaitControleur || recharge) return;
      recharge = true; location.reload();   // nouvelle version installée : on recharge une fois
    });
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").then(reg => {
      reg.update();
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update(); });
    }).catch(() => {}));
  }
  window.__pixel = { store, actions, get B() { return B; }, filAttendu, boutonAttendu, sequenceAttendue, codeAttendu }; // pour les tests
})();
