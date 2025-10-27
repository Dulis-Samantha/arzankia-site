/* ===== Base Monde (commun) =====
   - Jauge énergie persistée (localStorage)
   - Clic sac : +5% (démo)
   - Lightbox extract
*/

(function () {
  const KEY = 'arz_energy_v1';
  const fill = document.querySelector('.fill');
  const pctTxt = document.querySelector('.pct');
  const sacBtn = document.querySelector('.sac');
  const lb = document.getElementById('lightbox');
  const thumb = document.getElementById('extract');

  // --- Fonctions utilitaires ---
  function clamp01(v) {
    return Math.max(0, Math.min(100, v));
  }

  function getPct() {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) ? clamp01(v) : 60; // valeur de départ
  }

  function setPct(v) {
    const pct = clamp01(v);
    localStorage.setItem(KEY, String(pct));

    if (fill) fill.style.width = pct + '%';
    if (pctTxt) pctTxt.textContent = Math.round(pct) + '%';
  }

  // --- Initialisation ---
  setPct(getPct());

  // --- Pause du drain quand onglet inactif ---
  let pageHidden = document.hidden;
  document.addEventListener('visibilitychange', () => {
    pageHidden = document.hidden;
  });

  // --- Drain progressif ---
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;

    if (!pageHidden) {
      setPct(getPct() - 0.03 * dt); // ≈ -1.8 pts/min
    }
  }, 1000);

  // --- Recharge via clic sur le sac ---
  if (sacBtn) {
    sacBtn.addEventListener('click', () => {
      setPct(getPct() + 5);
    });
  }

  // --- Lightbox pour les extraits ---
  if (thumb && lb) {
    thumb.addEventListener('click', () => lb.setAttribute('data-open', 'true'));
    lb.addEventListener('click', () => lb.removeAttribute('data-open'));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') lb.removeAttribute('data-open');
    });
  }
})();
