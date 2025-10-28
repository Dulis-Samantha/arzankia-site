/* ==========================================================
   Arzankân — Jauge + Sac + Récolte d’ingrédients (monde.js)
   ========================================================== */
(function () {
  // ---------- Constantes ----------
  const ENERGY_KEY = 'arz_energy_v1';
  const BAG_KEY    = 'arz_bag';

  // Détection contexte
  const isMonde = /\/monde\//.test(location.pathname);

  // Jauge
  const elFill = document.getElementById('energyFill');
  const elPct  = document.getElementById('energyPct');

  // Sac (panneau)
  const bagPanel = document.getElementById('bagPanel');
  const bagBtn   = document.querySelector('.sac');
  const bagClose = document.querySelector('.sac-close');
  const bagList  = document.getElementById('bagList');
  const bagEmpty = document.getElementById('bagEmpty');
  const btnReset = document.getElementById('btnReset');
  const btnCalm  = document.getElementById('btnCalm');

  // Timers
  let energyTimer = null;
  let animTimer   = null;

  // ---------- Utils ----------
  const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));

  function getEnergy() {
    const raw = localStorage.getItem(ENERGY_KEY);
    return raw == null ? 100 : clamp(parseFloat(raw) || 0);
  }
  function setEnergy(v) {
    localStorage.setItem(ENERGY_KEY, clamp(v).toFixed(1));
  }

  function loadBag() {
    try {
      const raw = localStorage.getItem(BAG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveBag(bag) {
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
  }

  function toast(text, ms=1800) {
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 250);
    }, ms);
  }

  // ---------- Jauge ----------
  const TICK_MS        = 1000;
  const DRAIN_PER_S    = 0.08;  // ~5 pts/min
  const RECHARGE_PER_S = 0.20;  // ~12 pts/min

  function animateGaugeTo(targetPct) {
    if (!elFill || !elPct) return;
    const start = parseFloat(elFill.style.width) || 0;
    const diff  = targetPct - start;
    const steps = 24;
    let i = 0;
    clearInterval(animTimer);
    animTimer = setInterval(() => {
      i++;
      const p = start + (diff * i) / steps;
      elFill.style.width = p + '%';
      elPct.textContent  = Math.round(p) + '%';
      if (i >= steps) clearInterval(animTimer);
    }, 25);
  }

  function tickEnergy() {
    let e = getEnergy();
    const calm = localStorage.getItem('arz_calm') === 'true';
    if (!calm) {
      e += isMonde ? -DRAIN_PER_S : RECHARGE_PER_S;
      e = clamp(e);
      setEnergy(e);
      animateGaugeTo(e);
    }
  }

  function startEnergy() {
    if (energyTimer) return;
    animateGaugeTo(getEnergy());
    energyTimer = setInterval(tickEnergy, TICK_MS);
  }
  function stopEnergy() {
    clearInterval(energyTimer);
    energyTimer = null;
  }

  // ---------- Sac : rendu + ouverture ----------
  function renderBag() {
    if (!bagList || !bagEmpty) return;
    const bag = loadBag();
    bagList.innerHTML = '';
    if (!bag.length) {
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';
    for (const item of bag) {
      const li = document.createElement('li');
      li.className = 'bag-li';
      li.innerHTML = `
        <div class="bag-item">
          <img src="${item.img || ''}" alt="${item.name || item.id || ''}">
          <div class="bag-name">${item.name || item.id} <span class="bag-qty">×${item.qty || 1}</span></div>
        </div>`;
      bagList.appendChild(li);
    }
  }

  function openBag(open) {
    if (!bagPanel) return;
    bagPanel.dataset.open = open ? 'true' : 'false';
    bagPanel.style.display = open ? 'block' : 'none';
    bagBtn?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) renderBag();
  }
// ---------- Sac : ouverture / fermeture ----------
function isBagOpen() {
  return bagPanel?.dataset.open === 'true' || bagPanel?.style.display === 'block';
}
bagBtn?.addEventListener('click', () => {
  const open = !isBagOpen();
  openBag(open);
  if (open) renderBag();         // s'assure de l'affichage à chaque ouverture
});
bagClose?.addEventListener('click', () => openBag(false));

// Fermer si clic hors panneau (sans bloquer la récolte)
document.addEventListener('click', (e) => {
  if (!bagPanel || !bagBtn) return;
  const t = e.target;
  // on ignore les clics sur les ingrédients
  if (t.closest('.quest-ingredient')) return;
  if (!bagPanel.contains(t) && !bagBtn.contains(t)) openBag(false);
});


  // Réinitialiser
  btnReset?.addEventListener('click', () => {
    if (confirm('Vider le sac et recharger la jauge ?')) {
      localStorage.removeItem(BAG_KEY);
      setEnergy(100);
      renderBag();
      animateGaugeTo(100);
      toast('Sac vidé. Jauge rechargée.');
    }
  });

  // Mode tranquille
  function updateCalmLabel() {
    if (!btnCalm) return;
    const calm = localStorage.getItem('arz_calm') === 'true';
    btnCalm.textContent = calm ? '▶️ Réactiver la jauge' : '🕊️ Mode tranquille (désactiver la jauge)';
  }
  btnCalm?.addEventListener('click', () => {
    const calm = localStorage.getItem('arz_calm') === 'true';
    localStorage.setItem('arz_calm', (!calm).toString());
    updateCalmLabel();
    toast(!calm ? 'Mode tranquille activé.' : 'Mode tranquille désactivé.');
  });
  updateCalmLabel();

// ---------- Récolte d’ingrédients (délégation) ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.quest-ingredient');
  if (!btn) return;

  const id   = btn.dataset.id   || 'item';
  const name = btn.dataset.name || id;
  const img  = btn.dataset.img  || '';

  console.log('[CLICK] quest-ingredient', { id, name, img });

  let bag = loadBag();
  const found = bag.find(i => i.id === id);

  if (found) {
    if ((found.qty || 1) >= 2) {
      toast('Tu possèdes déjà la quantité maximale de cet ingrédient.');
      return;
    }
    found.qty = (found.qty || 1) + 1;
  } else {
    bag.push({ id, name, img, qty: 1 });
  }

  saveBag(bag);
  toast(`${name} ajouté à ton sac magique !`);

  // Force le rafraîchissement immédiatement, sac ouvert ou non
  renderBag();

  // Pour diagnostic express dans la console
  console.log('[arz_bag]', bag);
});

  // ---------- Boot ----------
  animateGaugeTo(getEnergy());
  startEnergy();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!energyTimer) startEnergy();
  });

  // Debug helper
  window.Arz = {
    bag: () => loadBag(),
    energy: () => getEnergy(),
    setEnergy: (v) => { setEnergy(v); animateGaugeTo(v); },
    resetBag: () => { localStorage.removeItem(BAG_KEY); renderBag(); },
  };
})();



