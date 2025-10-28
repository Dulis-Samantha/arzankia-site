;(() => {
  /* =========================
   * CONFIG
   * ========================= */
  const CFG = {
    storageKey: 'arz_energy_v2',
    max: 100,
    tickMs: 1000,
    drainPerSecond: 0.10,         // 1 pt / 10 s
    questThresholdPct: 15,        // bandeau d’alerte
    zeroRedirectUrl: '../2.les_coulisses.html',

    bagSlots: 5,                  // emplacements
    perItemMax: 2,                // quantité max par ingrédient
    infiniteAfterUses: 10,        // mode infini après N utilisations

    bagIconSrc: '../images/bouton/sac_magique.webp',

    items: {
      'ptikitis_rubictus': { name: 'Rubictus aux baies rouges', img: 'ing_ptikitis.webp' },
      'foret_champignon' : { name: 'Champignon azulé',        img: 'ing_foret.webp' },
      'ames_plante'      : { name: 'Olivette Brumis',         img: 'ing_ames.webp' },
      'reserve_ptikitis' : { name: 'Pousse rare (Réserve)',   img: 'ing_reserve_ptikitis.webp' },
      'eau_creature'     : { name: 'Essence des créatures de l’eau', img: 'ing_creature.webp' },
    },

    messages: {
      low: "Ton Arzanskân faiblit… utilise un ingrédient ou pars en quête.",
      bagFull: "Ton sac est plein (5). Utilise un ingrédient avant d’en ramasser un autre.",
      added: "Ingrédient ajouté au sac.",
      perItemMax: "Tu as déjà la quantité maximale de cet ingrédient.",
      used: "Énergie rechargée à 100%.",
      infinite: "Bravo ! Ton corps s’accorde à la magie des mondes : ton Arzanskân n’a plus besoin d’être rechargé.",
    }
  };

  /* =========================
   * STATE
   * ========================= */
  let S = loadState();
  let timer = null;

  /* =========================
   * DOM de la jauge
   * ========================= */
  const elFill = document.getElementById('energyFill');
  const elPct  = document.getElementById('energyPct');
  const overlay= document.getElementById('lockOverlay');

  // Ruban alerte
  const ribbon = document.createElement('div');
  ribbon.className = 'quest-ribbon';
  ribbon.textContent = CFG.messages.low;
  document.body.appendChild(ribbon);

  /* =========================
   * SAC — injection HTML
   * ========================= */
  const bagWrap = document.createElement('div');
  bagWrap.className = 'bag-wrap';
  bagWrap.innerHTML = `
    <img src="${CFG.bagIconSrc}" alt="Sac magique" class="bag-icon" id="bagIcon" aria-haspopup="true" aria-expanded="false">
    <div class="bag-badge" id="bagBadge">0</div>
    <div class="bag-menu" id="bagMenu" role="menu" aria-label="Inventaire">
      <h3>Ton inventaire</h3>
      <ul id="bagList"></ul>
      <div class="bag-empty" id="bagEmpty">Ton sac est vide…</div>
      <button class="bag-toggle" id="bagToggle" aria-pressed="false" title="Mode tranquille">Mode tranquille</button>
    </div>
  `;
  document.body.appendChild(bagWrap);

  // Raccourcis DOM
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const bagIcon   = $('#bagIcon',  bagWrap);
  const bagBadge  = $('#bagBadge', bagWrap);
  const bagMenu   = $('#bagMenu',  bagWrap);
  const bagList   = $('#bagList',  bagWrap);
  const bagEmpty  = $('#bagEmpty', bagWrap);
  const bagToggle = $('#bagToggle', bagWrap);    // ← bouton "Mode tranquille"

  /* =========================
   * OUVERTURE / FERMETURE DU SAC
   * ========================= */
  bagIcon.addEventListener('click', () => {
    const show = !bagMenu.classList.contains('show');
    bagMenu.classList.toggle('show', show);
    bagIcon.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) renderBag();
  });
  document.addEventListener('click', (e) => {
    if (!bagWrap.contains(e.target)) {
      bagMenu.classList.remove('show');
      bagIcon.setAttribute('aria-expanded', 'false');
    }
  });

  // Toggle "Mode tranquille" (attaché UNE fois)
  bagToggle.onclick = () => {
    S.chill = !S.chill;
    saveState();
    renderAll();
    startIfNeeded();
  };

  /* =========================
   * INIT
   * ========================= */
  initCollectibles();
  renderAll();
  startIfNeeded();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startIfNeeded();
  });
  window.addEventListener('beforeunload', saveState);

  /* =========================
   * LOOP / RENDER
   * ========================= */
  function startIfNeeded(){
    if (S.infinite || S.chill) return stop();
    if (S.energy > 0) start(); else redirectZero();
  }
  function start(){
    if (timer) return;
    timer = setInterval(tick, CFG.tickMs);
  }
  function stop(){
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }
  function tick(){
    if (document.hidden || S.infinite || S.chill) return;
    S.energy = clamp(S.energy - CFG.drainPerSecond, 0, CFG.max);
    if (S.energy <= 0){ saveState(); return redirectZero(); }
    renderGauge(); saveState();
  }

  function renderAll(){
    renderGauge();
    renderBag();
    updateRibbon();
    document.body.classList.toggle('arz-infinite', !!S.infinite);
  }
  function renderGauge(){
    const pct = Math.round((S.energy / CFG.max) * 100);
    if (elFill) elFill.style.width = pct + '%';
    if (elPct)  elPct.textContent = pct + '%';
    updateRibbon();
  }
  function updateRibbon(){
    const pct = (S.energy / CFG.max) * 100;
    ribbon.style.display = (!S.infinite && !S.chill && pct <= CFG.questThresholdPct) ? 'block' : 'none';
  }
 function redirectZero(){
  if (lockShown) return;  // évite les appels multiples
  lockShown = true;
  stop();                 // arrête le timer d'énergie

  if (overlay){
    overlay.style.display = 'grid';
    overlay.innerHTML = `
      <div class="lock-card">
        <div class="lock-title">⚡ Ton énergie est vide</div>
        <div class="lock-desc">Tu vas être redirigé vers les Coulisses d’Arzankia…</div>
      </div>
    `;
  }

  // Redirection douce après 3 secondes
  setTimeout(() => {
    window.location.href = CFG.zeroRedirectUrl;
  }, 3000);
}


  /* =========================
   * BAG
   * ========================= */
  function renderBag(){
    // badge
    bagBadge.textContent = String(totalItems());

    // état visuel + libellé du toggle
    if (S.chill) {
      bagToggle.classList.add('on');
      bagToggle.setAttribute('aria-pressed', 'true');
      bagToggle.textContent = 'Désactiver le mode tranquille';
      bagToggle.title = 'Clique pour désactiver';
    } else {
      bagToggle.classList.remove('on');
      bagToggle.setAttribute('aria-pressed', 'false');
      bagToggle.textContent = 'Activer le mode tranquille';
      bagToggle.title = 'Clique pour activer';
    }

    // contenu des items
    bagList.innerHTML = '';
    if (S.bag.length === 0){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    S.bag.forEach((entry, idx) => {
      const meta = metaOf(entry.id);
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="bag-item">
          <img src="${meta.img}" alt="">
          <div>
            <div class="bag-name">${meta.name}</div>
            <div class="bag-rem">Il t’en reste <strong>${entry.qty}</strong></div>
          </div>
        </div>
        <button type="button" class="bag-use" data-index="${idx}" ${entry.qty<=0?'disabled':''}>Utiliser</button>
      `;
      bagList.appendChild(li);
    });

    $$('.bag-use', bagList).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const idx = parseInt(btn.getAttribute('data-index'),10);
        useItem(idx);
      });
    });
  }

  function useItem(index){
    const entry = S.bag[index]; if (!entry || entry.qty<=0) return;

    // consommer
    entry.qty--;
    if (entry.qty === 0){
      // retire l’emplacement s’il est vide
      S.bag.splice(index,1);
    }

    // effet : recharge
    S.energy = CFG.max;
    S.usesTotal++;
    toast(CFG.messages.used);

    // passage en “infini”
    if (!S.infinite && S.usesTotal >= CFG.infiniteAfterUses){
      S.infinite = true;
      toast(CFG.messages.infinite, 4200);
      stop();
    }

    saveState(); renderAll();
  }

  function totalItems(){
    return S.bag.reduce((n,e)=>n+e.qty,0);
  }

  /* =========================
   * COLLECT + ZOOM + POSITION MOBILE
   * ========================= */
  function initCollectibles(){
    $$('.quest-ingredient').forEach(btn=>{
      // accessibilité
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      if (!btn.hasAttribute('role')) btn.setAttribute('role','button');
      btn.addEventListener('keydown', (e) => {
        if (e.key==='Enter' || e.key===' ') { e.preventDefault(); btn.click(); }
      });

      // --- collecte au clic ---
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        if (!id) return;

        // trouve ou crée l’entrée
        let entry = S.bag.find(e=>e.id===id);
        if (entry){
          if (entry.qty >= CFG.perItemMax){
            toast(CFG.messages.perItemMax);
            return;
          }
          entry.qty++;
        } else {
          if (S.bag.length >= CFG.bagSlots){
            toast(CFG.messages.bagFull);
            return;
          }
          entry = { id, qty: 1 };
          S.bag.push(entry);
        }

        saveState(); renderBag(); toast(CFG.messages.added);
      });

      // --- zoom réglable (desktop / mobile) ---
      const imgEl = btn.querySelector('.ingredient-img');
      if (imgEl) {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;

        const zoomPct        = parseFloat(btn.getAttribute('data-zoom') || '130');
        const zoomMobilePct  = parseFloat(btn.getAttribute('data-zoom-mobile') || zoomPct);
        const zoomScale      = Math.max(1, (isMobile ? zoomMobilePct : zoomPct) / 100);

        // Transition douce (au cas où pas en CSS)
        imgEl.style.transition = imgEl.style.transition || 'transform 0.3s ease';

        // Survol (desktop)
        imgEl.addEventListener('mouseenter', () => {
          if (!isMobile) imgEl.style.transform = `scale(${zoomScale})`;
        });
        imgEl.addEventListener('mouseleave', () => {
          if (!isMobile) imgEl.style.transform = '';
        });

        // Pulse au clic / touch
        const pulse = () => {
          imgEl.style.transform = `scale(${zoomScale})`;
          setTimeout(() => { imgEl.style.transform = ''; }, 220);
        };
        imgEl.addEventListener('mousedown', pulse);
        imgEl.addEventListener('touchstart', pulse, { passive: true });
      }

      // --- position mobile via data-* ---
      if (window.matchMedia('(max-width: 768px)').matches) {
        const bottomMob = btn.getAttribute('data-bottom-mobile');
        const leftMob   = btn.getAttribute('data-left-mobile');
        if (bottomMob) btn.style.bottom = bottomMob;
        if (leftMob)   btn.style.left   = leftMob;
      }
    });
  }

  /* =========================
   * HELPERS
   * ========================= */
  function metaOf(id){
    const btn = document.querySelector(`.quest-ingredient[data-id="${id}"]`);
    const name = btn?.getAttribute('data-name');
    const img  = btn?.getAttribute('data-img');
    return {
      name: name || CFG.items[id]?.name || id,
      img : img  || CFG.items[id]?.img  || ''
    };
  }

  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function loadState(){
    const def = { energy: CFG.max, bag: [], usesTotal: 0, chill: false, infinite:false };
    try{
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return def;
      const s = JSON.parse(raw);
      if (!Array.isArray(s.bag)) s.bag = [];
      if (typeof s.energy !== 'number') s.energy = CFG.max;
      if (typeof s.usesTotal !== 'number') s.usesTotal = 0;
      if (typeof s.chill !== 'boolean') s.chill = false;
      if (typeof s.infinite !== 'boolean') s.infinite = false;
      s.bag.forEach(e=>{ e.qty = clamp(e.qty||0,0,CFG.perItemMax); });
      if (s.bag.length > CFG.bagSlots) s.bag = s.bag.slice(0, CFG.bagSlots);
      return s;
    } catch { return def; }
  }

  function saveState(){
    localStorage.setItem(CFG.storageKey, JSON.stringify(S));
  }

  function toast(text, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast'; t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=> t.remove(), 220); }, ms);
  }

// Petite API console (pratique pour tester)
window.Arz = {
  get: () => ({ ...S }),
  resetAll: () => {
    S = { energy: CFG.max, bag: [], usesTotal: 0, chill: false, infinite: false };
    saveState();
    renderAll();
    startIfNeeded();
  },
  setEnergy: v => {
    S.energy = clamp(v, 0, CFG.max);
    saveState();
    renderAll();
  }
};

// --- Bouton magique "Recharger énergie" ---
document.getElementById('refillBtn')?.addEventListener('click', () => {
  S.energy = CFG.max;
  saveState();
  renderAll();
  startIfNeeded();
  alert('Énergie rechargée à 100% ⚡');
});
})();
