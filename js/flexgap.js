/* Les vieux Chrome (avant la version 84) ignorent « gap » dans les flexbox : les blocs se collent.
   Si c'est le cas, on remplace l'écart par des marges, après chaque affichage. */
(function () {
  var t = document.createElement("div");
  t.style.cssText = "display:flex;flex-direction:column;row-gap:1px;position:absolute;visibility:hidden";
  t.appendChild(document.createElement("div")); t.appendChild(document.createElement("div"));
  document.documentElement.appendChild(t);
  var ok = t.scrollHeight === 1 && location.search.indexOf("testgap") < 0; t.remove();
  if (ok) return;
  document.documentElement.classList.add("sans-flexgap");
  function corriger(racine) {
    var els = (racine || document).querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i], cs = getComputedStyle(el);
      if (cs.display !== "flex" && cs.display !== "inline-flex") continue;
      var rg = parseFloat(cs.rowGap) || 0, cg = parseFloat(cs.columnGap) || 0;
      if (!rg && !cg) continue;
      var col = cs.flexDirection.indexOf("column") === 0, wrap = cs.flexWrap !== "nowrap";
      var enfants = Array.prototype.filter.call(el.children, function (c) { var d = getComputedStyle(c); return d.display !== "none" && d.position !== "absolute" && d.position !== "fixed"; });
      enfants.forEach(function (c, k) {
        if (c.dataset.fg === "1") return; c.dataset.fg = "1";
        if (col) { if (k > 0) c.style.marginTop = rg + "px"; }
        else { if (k > 0) c.style.marginLeft = cg + "px"; if (wrap) c.style.marginBottom = rg + "px"; }
      });
    }
  }
  var attente = null;
  new MutationObserver(function () { clearTimeout(attente); attente = setTimeout(function () { corriger(); }, 30); })
    .observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", function () { corriger(); });
})();
