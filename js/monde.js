// ===== Monde (commun) : jauge + sac =====
(() => {
  const KEY = 'arz_energy_v1';

  // DOM
  const fill = document.getElementById('energyFill');
  const pct  = document.getElementById('energyPct');
  const sacBtn   = document.querySelector('.sac');
  const bagPanel = document.getElementById('bagPanel');
  const bagClose = document.querySelector('.sac-close');
  const btnReset = document.getElementById('btnReset');
  const btnCalm  = document.getElementById('btnCalm');
  const bagEmpty = document.getElementById('bagEmpty');
  const bagList  = document.getElementById('bagList');

  // État
  let state = loadState();
  let timer = null;

  // Helpers
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function renderGauge(){
    const p = clamp((state.energy/100)*100, 0, 100);
    if (fill) fill.style.width = p + '%';
    if (pct)  pct.textContent = Math.round(p) + '%';
  }

  function start(){
    if (state.noPressure || state.infinite) return;
    if (timer) return;
    timer = setInterval(() => {
      if (document.hidden) return;
      state.energy = clamp(state.energy - state.drain, 0, 100);
      if (state.energy <= 0) { state.energy = 0; stop(); }
      renderGauge(); saveState();
    }, 1000);
  }
  function stop(){ clearInterval(timer); timer = null; }

  function saveState(){ localStorage.setItem(KEY, JSON.stringify(state)); }
  function loadState(){
    const raw = localStorage.getItem(KEY);
    if (!raw) return { energy:100, drain:0.10, noPressure:false, infinite:false };
    try{
      const s = JSON.parse(raw);
      if (typeof s.energy !== 'number') s.energy = 100;
      if (typeof s.drain  !== 'number') s.drain  = 0.10;
      if (typeof s.noPressure !== 'boolean') s.noPressure = false;
      if (typeof s.infinite   !== 'boolean') s.infinite   = false;
      return s;
    }catch{
      return { energy:100, drain:0.10, noPressure:false, infinite:false };
    }
  }

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

