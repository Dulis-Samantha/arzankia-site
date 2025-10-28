// ===== Monde (commun) : jauge + sac =====
(function(){
  const KEY = 'arz_energy_v1';
  const fill = document.getElementById('energyFill');
  const pct = document.getElementById('energyPct');

  // Détection du contexte
  const isMonde = window.location.pathname.includes('/monde/');
  const tickMs = 1000;
  const drainRate = 0.08;   // perte par seconde dans un monde (~5 pts / min)
  const rechargeRate = 0.20; // gain par seconde hors monde (~12 pts / min)

  // Utilitaires
  const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));
  const getEnergy = () => Number(localStorage.getItem(KEY)) || 100;
  const setEnergy = (v) => localStorage.setItem(KEY, clamp(v).toFixed(1));

  // Animation fluide de la jauge
  function animateGauge(target){
    const current = parseFloat(fill.style.width) || 0;
    const diff = target - current;
    const steps = 25;
    let step = 0;
    clearInterval(fill.anim);
    fill.anim = setInterval(()=>{
      step++;
      const p = current + (diff * step) / steps;
      fill.style.width = p + '%';
      pct.textContent = Math.round(p) + '%';
      if(step>=steps) clearInterval(fill.anim);
    }, 30);
  }

  // Boucle de vie
  function tick(){
    let e = getEnergy();
    e += isMonde ? -drainRate : rechargeRate;
    e = clamp(e);
    setEnergy(e);
    animateGauge(e);
  }

  // Initialisation
  const initial = getEnergy();
  animateGauge(initial);
  setInterval(tick, tickMs);
})();

  // Sac : ouvrir/fermer
  function openBag(open){
    bagPanel.setAttribute('data-open', open ? 'true' : 'false');
    sacBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  sacBtn?.addEventListener('click', () => openBag(bagPanel.getAttribute('data-open') !== 'true'));
  bagClose?.addEventListener('click', () => openBag(false));
  document.addEventListener('click', (e) => {
    if (!bagPanel.contains(e.target) && !sacBtn.contains(e.target)) openBag(false);
  });

  // Sac : actions
  btnReset?.addEventListener('click', () => {
    state.energy = 100;
    state.noPressure = false;
    state.infinite = false;
    toast('Ingrédients réinitialisés. Jauge rechargée.');
    saveState(); renderGauge(); start();
  });
  function updateCalmLabel(){
    btnCalm.textContent = state.noPressure ? '▶️ Réactiver la jauge' : '🕊️ Mode tranquille (désactiver la jauge)';
  }
  btnCalm?.addEventListener('click', () => {
    state.noPressure = !state.noPressure;
    if (state.noPressure){ stop(); state.energy = 100; toast('Mode tranquille activé.'); }
    else { toast('Mode tranquille désactivé.'); start(); }
    saveState(); renderGauge(); updateCalmLabel();
  });
  updateCalmLabel();

  // (Placeholder) État du sac : ici on laisse vide
  if (bagEmpty) bagEmpty.style.display = 'block';
  if (bagList)  bagList.innerHTML = '';

  // Toast mini
  function toast(txt, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast'; t.textContent = txt;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 250); }, ms);
  }

  // Boot
  renderGauge();
  if (!state.noPressure && !state.infinite) start();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (!state.noPressure && !state.infinite && !timer) start();
  });

  // API debug (optionnel)
  window.Arz = {
    get: ()=>({...state}),
    setEnergy:(v)=>{ state.energy = clamp(v,0,100); saveState(); renderGauge(); },
    calm:(on)=>{ state.noPressure=!!on; saveState(); updateCalmLabel(); on?stop():start(); }
  };
})();

// --- Collecte d'ingrédients ---
document.querySelectorAll('.quest-ingredient').forEach(btn => {
  if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
  if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
  
  btn.addEventListener('click', () => {
    const id = btn.dataset.id;
    const name = btn.dataset.name || id;
    const img = btn.dataset.img || '';

    // charger ou créer sac
    const raw = localStorage.getItem('arz_bag');
    let bag = raw ? JSON.parse(raw) : [];

    const found = bag.find(item => item.id === id);
    if (found) {
      if (found.qty >= 2) {
        toast('Tu possèdes déjà la quantité maximale de cet ingrédient.');
        return;
      }
      found.qty += 1;
      toast('Ingrédient ajouté au sac.');
    } else {
      bag.push({ id, name, img, qty: 1 });
      toast('Ingrédient ajouté au sac.');
    }

    localStorage.setItem('arz_bag', JSON.stringify(bag));
    renderBagList();
  });
});

// --- Rendu du sac ---
function renderBagList(){
  const raw = localStorage.getItem('arz_bag');
  const bag = raw ? JSON.parse(raw) : [];
  const list = document.getElementById('bagList');
  const empty = document.getElementById('bagEmpty');
  list.innerHTML = '';

  if (bag.length === 0){
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  bag.forEach(item => {
    const li = document.createElement('li');
    li.className = 'bag-li';
    li.innerHTML = `
      <div class="bag-item">
        <img src="${item.img}" alt="${item.name}" />
        <div class="bag-name">${item.name} <span class="bag-qty">×${item.qty}</span></div>
      </div>`;
    list.appendChild(li);
  });
}

// affiche le contenu à l’ouverture du sac
document.querySelector('.sac')?.addEventListener('click', renderBagList);

