// ==========================================================
// ⚡ Arzanskân — Jauge d’énergie + Sac magique
// ==========================================================
(function(){
  const ENERGY_KEY = 'arz_energy_v1';
  const BAG_KEY = 'arz_bag';
  const CALM_KEY = 'arz_calm';

  // --- Sélecteurs globaux
  const fill = document.getElementById('energyFill');
  const pct = document.getElementById('energyPct');
  const bagBtn = document.querySelector('.sac');
  const bagPanel = document.getElementById('bagPanel');
  const bagClose = document.querySelector('.sac-close');
  const bagList = document.getElementById('bagList');
  const bagEmpty = document.getElementById('bagEmpty');
  const btnReset = document.getElementById('btnReset');
  const btnCalm = document.getElementById('btnCalm');

  // --- Contexte
  const isMonde = window.location.pathname.includes('/monde/');
  const tickMs = 1000;
  const drainRate = 0.08;     // perte par seconde (≈5 pts/min)
  const rechargeRate = 0.20;  // recharge hors monde (≈12 pts/min)
  let timer = null;

  // --- Utilitaires
  const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));
  const getEnergy = () => Number(localStorage.getItem(ENERGY_KEY)) || 100;
  const setEnergy = (v) => localStorage.setItem(ENERGY_KEY, clamp(v).toFixed(1));
  const getCalm = () => localStorage.getItem(CALM_KEY) === 'true';
  const setCalm = (v) => localStorage.setItem(CALM_KEY, v ? 'true' : 'false');

  // ==========================================================
  // ⚡ JAUGE D'ÉNERGIE
  // ==========================================================
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

  function tick(){
    if (getCalm()) return; // mode tranquille
    let e = getEnergy();
    e += isMonde ? -drainRate : rechargeRate;
    e = clamp(e);
    setEnergy(e);
    animateGauge(e);
  }

  function start(){
    if (timer) clearInterval(timer);
    timer = setInterval(tick, tickMs);
  }

  // Initialisation
  const initial = getEnergy();
  animateGauge(initial);
  start();

  // ==========================================================
  // 🎒 SAC MAGIQUE
  // ==========================================================
  function loadBag(){
    const raw = localStorage.getItem(BAG_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  function saveBag(bag){
    localStorage.setItem(BAG_KEY, JSON.stringify(bag));
  }

  function renderBag(){
    const bag = loadBag();
    bagList.innerHTML = '';

    if (bag.length === 0){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    bag.forEach(item => {
      const li = document.createElement('li');
      li.className = 'bag-li';
      li.innerHTML = `
        <div class="bag-item">
          <img src="${item.img}" alt="${item.name}" />
          <div class="bag-name">${item.name} <span class="bag-qty">×${item.qty}</span></div>
        </div>`;
      bagList.appendChild(li);
    });
  }

  // --- Ouvrir / fermer le sac
  if (bagBtn && bagPanel){
    bagBtn.addEventListener('click', () => {
      const open = bagPanel.dataset.open === 'true';
      bagPanel.dataset.open = open ? 'false' : 'true';
      bagPanel.style.display = open ? 'none' : 'block';
      bagBtn.setAttribute('aria-expanded', !open);
      if (!open) renderBag();
    });
  }

  bagClose?.addEventListener('click', () => {
    bagPanel.dataset.open = 'false';
    bagPanel.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!bagPanel.contains(e.target) && !bagBtn.contains(e.target)) {
      bagPanel.dataset.open = 'false';
      bagPanel.style.display = 'none';
    }
  });

  // ==========================================================
  // 🍓 COLLECTE D'INGRÉDIENTS
  // ==========================================================
  document.querySelectorAll('.quest-ingredient').forEach(btn => {
    if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
    if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');

    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name || id;
      const img = btn.dataset.img || '';

      let bag = loadBag();
      const found = bag.find(i => i.id === id);
      if (found){
        if (found.qty >= 2){
          toast("Tu possèdes déjà la quantité maximale de cet ingrédient.");
          return;
        }
        found.qty += 1;
      } else {
        bag.push({ id, name, img, qty: 1 });
      }

      saveBag(bag);
      toast(`${name} ajouté à ton sac magique !`);
      renderBag();
    });
  });

  // ==========================================================
  // 🔄 RÉINITIALISATION & MODE TRANQUILLE
  // ==========================================================
  btnReset?.addEventListener('click', () => {
    if (confirm("Souhaites-tu vraiment vider ton sac et recharger la jauge ?")) {
      localStorage.removeItem(BAG_KEY);
      localStorage.removeItem(ENERGY_KEY);
      renderBag();
      animateGauge(100);
      setEnergy(100);
    }
  });

  btnCalm?.addEventListener('click', () => {
    const calm = !getCalm();
    setCalm(calm);
    toast(calm ? "🕊️ Mode tranquille activé (la jauge se fige)." : "⚡ Mode tranquille désactivé.");
  });

  // ==========================================================
  // 🔔 Toasts
  // ==========================================================
  function toast(txt, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.textContent = txt;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 250); }, ms);
  }

})();
