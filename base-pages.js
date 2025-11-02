/* ============================================================
   ARZANKIA — JS commun (toutes pages)
   - Helpers DOM
   - Smooth scroll (respecte prefers-reduced-motion)
   - IntersectionObserver pour .reveal
   - Fix 100vh mobile (CSS var --vh)
   - Classe .js sur <html>
   - Espace global ARZ (outils simples)
   ============================================================ */

(function(){
  // ----- Helpers
  const d = document;
  const w = window;
  const $  = (sel, root=d) => root.querySelector(sel);
  const $$ = (sel, root=d) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const prefersReduced = () => w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ----- Expose un mini espace global utile partout
  w.ARZ = {
    $, $$, on,
    prefersReduced,
    setVar: (name, val) => d.documentElement.style.setProperty(name, val),
    onReady: (fn) => (d.readyState === "loading" ? d.addEventListener("DOMContentLoaded", fn) : fn())
  };

  // ----- Marqueur JS activé
  d.documentElement.classList.add("js");

  // ----- Smooth scroll pour ancres internes
  ARZ.onReady(() => {
    d.body.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if(!a) return;
      const id = a.getAttribute("href");
      if(id.length <= 1) return;
      const target = $(id);
      if(!target) return;

      // si motion réduite, on laisse le comportement par défaut
      if(prefersReduced()) return;

      e.preventDefault();
      const y = target.getBoundingClientRect().top + w.scrollY - 12; // petit offset
      w.scrollTo({ top:y, behavior:"smooth" });
      // focus accessible
      target.setAttribute("tabindex","-1");
      target.focus({ preventScroll:true });
      setTimeout(() => target.removeAttribute("tabindex"), 500);
    });
  });

  // ----- IntersectionObserver pour effets .reveal
  ARZ.onReady(() => {
    const items = $$(".reveal");
    if(!items.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add("reveal-in");
          io.unobserve(entry.target);
        }
      });
    }, { root:null, rootMargin:"0px 0px -10% 0px", threshold: 0.08 });

    items.forEach(el => io.observe(el));
  });

  // ----- Fix 100vh mobile (CSS var --vh)
  function setVH(){
    const vh = w.innerHeight * 0.01;
    ARZ.setVar("--vh", `${vh}px`);
  }
  setVH();
  on(w, "resize", () => { setVH(); });

  // ----- Utilitaire: data-smooth sur boutons/links (optionnel)
  ARZ.onReady(() => {
    d.body.addEventListener("click", (e) => {
      const trg = e.target.closest("[data-smooth]");
      if(!trg) return;
      const sel = trg.getAttribute("data-smooth");
      const el = $(sel);
      if(!el) return;
      if(prefersReduced()) return;
      e.preventDefault();
      const y = el.getBoundingClientRect().top + w.scrollY - 12;
      w.scrollTo({ top:y, behavior:"smooth" });
    });
  });

})();
