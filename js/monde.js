/* ==========================================================
   Arzankân — Jauge + Sac + Récolte d’ingrédients (version corrigée)
   ========================================================== */
(function () {
  // ---------- Constantes ----------
  const ENERGY_KEY = 'arz_energy_v1';
  const BAG_KEY    = 'arz_bag';

  // Détection du contexte (monde ou non)
  const isMonde = /\/monde\//.test(location.pathname);

  // ---------- Sélecteurs ----------
  const elFill   = document.getElementById('energyFill');
  const elPct    = document.getElementById('energyPct');
  const bagPanel = document.getElementById('bagPanel');
  const bagBtn   = document.querySelector('.sac');
  const bagClose = document.querySelector('.sac-close');
  const bagList  = document.getElementById('bagList');
  const bagEmpty = document.getElementById('bagEmpty');
  const btnReset = document.getElementById('btnReset');
  const btnCalm  = document.getElementById('btnCalm');

  // ---------- Timers ----------
  let energyTimer = null;
  let animTimer   = null;

  // ---------- Utils ----------
  const clamp = (v, min=0, max=100) => Math.max(min, Math.min(max, v));
  const getEnergy = () => clamp(parseFloat(localStorage.getItem(ENERGY_KEY)) || 100);
  const setEnergy = v => localStorage.setItem(ENERGY_KEY, clamp(v).toFixed(1));

  const loadBag = () => {
    try { return JSON.parse(localStorage.getItem(BAG_KEY)) || []; }
    catch { return []; }
  };
  const saveBag = bag => localStorage.setItem(BAG_KEY, JSON.stringify(bag));

  function toast(text, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 250); }, ms);
  }

  // ---------- Jauge ----------
  const TICK_MS = 1000;
  const DRAIN_PER_S = 0.08;
  const RECHARGE_PER_S = 0.20;

  function animateGaugeTo(target){
    if (!elFill || !elPct) return;
    const start = parseFloat(elFill.style.width) || 0;
    const diff  = target - start;
    const steps = 24;
    let i = 0;
    clearInterval(animTimer);
    animTimer = setInterval(()=>{
      i++;
      const p = start + (diff * i) / steps;
      elFill.style.width = p + '%';
      elPct.textContent  = Math.round(p) + '%';
      if (i >= steps) clearInterval(animTimer);
    }, 25);
  }

  function tickEnergy(){
    let e = getEnergy();
    const calm = localStorage.getItem('arz_calm') === 'true';
    if (calm) return;
    e += isMonde ? -DRAIN_PER_S : RECHARGE_PER_S;
    e = clamp(e);
    setEnergy(e);
    animateGaugeTo(e);
  }

  function startEnergy(){
    if (energyTimer) return;
    animateGaugeTo(getEnergy());
    energyTimer = setInterval(tickEnergy, TICK_MS);
  }
  function stopEnergy(){
    clearInterval(energyTimer);
    energyTimer = null;
  }

  // ---------- Sac ----------
  function renderBag(){
    if (!bagList || !bagEmpty) return;
    const bag = loadBag();
    bagList.innerHTML = '';
    if (!bag.length){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';
    bag.forEach(item=>{
      const li = document.createElement('li');
      li.className = 'bag-li';
      li.innerHTML = `
        <div class="bag-item">
          <img src="${item.img || ''}" alt="${item.name || item.id}">
          <div class="bag-name">${item.name || item.id} <span class="bag-qty">×${item.qty || 1}</span></div>
        </div>`;
      bagList.appendChild(li);
    });
  }

  function openBag(open){
    if (!bagPanel) return;
    bagPanel.dataset.open = open ? 'true':'false';
    bagPanel.style.display = open ? 'block':'none';
    bagBtn?.setAttribute('aria-expanded', open ? 'true':'false');
    if (open) renderBag();
  }

  function isBagOpen(){
    return bagPanel?.dataset.open === 'true' || bagPanel?.style.display === 'block';
  }

  // ---------- Événements sac ----------
  bagBtn?.addEventListener('click', ()=>{
    const open = !isBagOpen();
    openBag(open);
    if (open) renderBag();
  });
  bagClose?.addEventListener('click', ()=> openBag(false));

  document.addEventListener('click', (e)=>{
    if (!bagPanel || !bagBtn) return;
    const t = e.target;
    if (t.closest('.quest-ingredient')) return; // on ignore la récolte
    if (!bagPanel.contains(t) && !bagBtn.contains(t)) openBag(false);
  });

  btnReset?.addEventListener('click', ()=>{
    if (confirm('Vider le sac et recharger la jauge ?')){
      localStorage.removeItem(BAG_KEY);
      setEnergy(100);
      renderBag();
      animateGaugeTo(100);
      toast('Sac vidé et jauge rechargée.');
    }
  });

  function updateCalmLabel(){
    if (!btnCalm) return;
    const calm = localStorage.getItem('arz_calm') === 'true';
    btnCalm.textContent = calm ? '▶️ Réactiver la jauge' : '🕊️ Mode tranquille (désactiver la jauge)';
  }
  btnCalm?.addEventListener('click', ()=>{
    const calm = localStorage.getItem('arz_calm') === 'true';
    localStorage.setItem('arz_calm', (!calm).toString());
    updateCalmLabel();
    toast(!calm ? 'Mode tranquille activé.' : 'Mode tranquille désactivé.');
  });
  updateCalmLabel();

  // ---------- Récolte d’ingrédients ----------
  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('.quest-ingredient');
    if (!btn) return;

    const id   = btn.dataset.id   || 'item';
    const name = btn.dataset.name || id;
    const img  = btn.dataset.img  || '';

    let bag = loadBag();
    const found = bag.find(i => i.id === id);

    if (found){
      if ((found.qty || 1) >= 2){
        toast('Tu possèdes déjà la quantité maximale de cet ingrédient.');
        return;
      }
      found.qty = (found.qty || 1) + 1;
    } else {
      bag.push({ id, name, img, qty: 1 });
    }

   saveBag(bag);
renderBag();
openBag(true);   // ← ouvre le sac après la récolte
toast(`${name} ajouté à ton sac magique !`);

  });

  // ---------- Boot ----------
  animateGaugeTo(getEnergy());
  startEnergy();

  document.addEventListener('visibilitychange', ()=>{
    if (!document.hidden && !energyTimer) startEnergy();
  });

  // Debug helper
  window.Arz = {
    bag: ()=> loadBag(),
    energy: ()=> getEnergy(),
    setEnergy: v => { setEnergy(v); animateGaugeTo(v); },
    resetBag: ()=> { localStorage.removeItem(BAG_KEY); renderBag(); }
  };
})();
