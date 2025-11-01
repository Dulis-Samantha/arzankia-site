;(() => {
  /* =========================================================
   * ARZANKIA — FICHIER UNIQUE (Cœur + UI)
   *  - Sac + Jauge visibles sur TOUTES les pages
   *  - Recharge sur MONDE / EXTRAIT(S) / ENTREE
   *  - Décharge ailleurs (coulisses, héros, etc.)
   * ========================================================= */

  // Anti double-chargement
  if (window.ArzAllInOne) return;
  window.ArzAllInOne = true;

  /* -------------------------
   * Détection chemin + BASE
   * ------------------------- */
  const PATH = location.pathname.toLowerCase();
  const IS_MONDE    = PATH.includes('/monde/');
  const IS_EXTRACT  = PATH.includes('/extrait/') || PATH.includes('/extraits/');
  const IS_ENTREE   = PATH.includes('/entree/');
  const IS_CHARGE_PAGE = (IS_MONDE || IS_EXTRACT || IS_ENTREE); // ← Recharge ici
  const BASE = IS_CHARGE_PAGE ? '../' : (
    // si ta page est à la racine, adapte BASE au besoin
    (PATH.split('/').filter(Boolean).length > 1 ? '../' : '')
  );

  /* =========================
   * COEUR — CONFIG & STATE
   * ========================= */
  const CFG = {
    storageKey: 'arz_energy_v3',
    max: 100,
    tickMs: 1000,
    // Règle demandée :
    // - sur IS_CHARGE_PAGE → on RECHARGE
    // - ailleurs → on DÉCHARGE
    drainPerSecond: 0.10,      // ↓ en dehors des pages de charge
    rechargePerSecond: 0.10,   // ↑ sur pages de charge
    questThresholdPct: 15,
    // Zéro : on conserve l’événement, mais on ne redirige pas par défaut (car “coulisses” décharge)
    zeroRedirectUrl: BASE + '2.les_coulisses.html',
    autoRedirectOnZero: false
  };

  // État + helpers
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function loadState(){
    const def = { energy: CFG.max, bag: [], usesTotal: 0, mode: 'novice' };
    try{
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return def;
      const s = JSON.parse(raw);
      if (typeof s.energy !== 'number') s.energy = CFG.max;
      if (!Array.isArray(s.bag)) s.bag = [];
      if (typeof s.usesTotal !== 'number') s.usesTotal = 0;
      if (!s.mode) s.mode = 'novice';
      s.bag.forEach(e => { e.qty = clamp(e.qty||0, 0, 1); }); // per-item max 1
      return s;
    } catch { return def; }
  }

  function saveState(){ localStorage.setItem(CFG.storageKey, JSON.stringify(S)); }

  let S = loadState();
  let timer = null;
  let lockedZero = false;

  /* =========================
   * COEUR — ÉVÉNEMENTS
   * ========================= */
  function emit(name, detail){ document.dispatchEvent(new CustomEvent(name, { detail })); }
  function pushEnergy(){
    saveState();
    const pct = Math.round((S.energy / CFG.max) * 100);
    emit('arz:energy', { pct, energy: S.energy, isChargePage: IS_CHARGE_PAGE, mode: S.mode, cfg: CFG });
  }

  /* =========================
   * COEUR — API publique
   * ========================= */
  function setMode(mode){
    if (mode !== 'novice' && mode !== 'experimente') return;
    S.mode = mode; saveState();
    emit('arz:modechange', { mode });
    startIfNeeded();
  }
  function resetAll(){
    S = { energy: CFG.max, bag: [], usesTotal: 0, mode: 'novice' };
    lockedZero = false; saveState();
    emit('arz:reset', {}); startIfNeeded(); pushEnergy();
  }
  function setEnergy(v){
    S.energy = clamp(v, 0, CFG.max);
    lockedZero = (S.energy <= 0); saveState(); pushEnergy();
  }
  function get(){
    return { ...S, totalItems: totalItems(), isChargePage: IS_CHARGE_PAGE, cfg: { ...CFG } };
  }

  // Bag
  function addItem(id){
    if (!id) return false;
    let entry = S.bag.find(e => e.id === id);
    if (entry){
      if (entry.qty >= 1){ emit('arz:bag:perItemMax', { id }); return false; }
      entry.qty++;
    } else {
      S.bag.push({ id, qty: 1 });
    }
    saveState(); emit('arz:bagchange', { bag: JSON.parse(JSON.stringify(S.bag)) });
    return true;
  }
  function useItemById(id){
    const idx = S.bag.findIndex(e => e.id === id && e.qty > 0);
    if (idx === -1) return false; return useItemByIndex(idx);
  }
  function useItemByIndex(index){
    const entry = S.bag[index];
    if (!entry || entry.qty <= 0) return false;
    entry.qty--; if (entry.qty === 0) S.bag.splice(index, 1);
    S.energy = CFG.max; S.usesTotal++; saveState();
    emit('arz:item:used', { bag: JSON.parse(JSON.stringify(S.bag)) });
    pushEnergy(); return true;
  }
  function totalItems(){ return S.bag.reduce((n,e)=>n+e.qty,0); }

  // Boucle
  function startIfNeeded(){
    stop(); // anti-doublons

    if (S.mode === 'experimente'){
      S.energy = CFG.max; saveState(); pushEnergy();
      emit('arz:modechange', { mode: S.mode });
      return; // pas de timer
    }
    start();
  }
  function start(){
    if (timer) return;
    timer = setInterval(tick, CFG.tickMs);
    emit('arz:start', {});
  }
  function stop(){
    if (!timer) return;
    clearInterval(timer); timer = null;
    emit('arz:stop', {});
  }
  function tick(){
    if (document.hidden) return;
    if (S.mode === 'experimente'){ S.energy = CFG.max; pushEnergy(); return; }

    if (IS_CHARGE_PAGE){
      // RECHARGE demandée sur ces pages
      S.energy = clamp(S.energy + CFG.rechargePerSecond, 0, CFG.max);
    } else {
      // DÉCHARGE ailleurs
      S.energy = clamp(S.energy - CFG.drainPerSecond, 0, CFG.max);
      if (S.energy <= 0){
        pushEnergy();
        if (!lockedZero){
          lockedZero = true;
          emit('arz:zero', { redirect: CFG.autoRedirectOnZero, to: CFG.zeroRedirectUrl });
          if (CFG.autoRedirectOnZero){
            stop();
            setTimeout(()=>{ location.href = CFG.zeroRedirectUrl; }, 1500);
          }
        }
        saveState(); return;
      }
    }
    pushEnergy();
  }

  // Lifecycle
  document.addEventListener('visibilitychange', () => { if (!document.hidden) startIfNeeded(); });
  window.addEventListener('beforeunload', saveState);

  // Expose
  window.Arz = {
    // lecture/écriture
    get, setEnergy, resetAll, setMode,
    // boucle
    start: startIfNeeded, stop,
    // bag
    addItem, useItemById, useItemByIndex, totalItems,
    // utilitaires
    isChargePage: () => IS_CHARGE_PAGE
  };

  /* =========================
   * UI — Helpers
   * ========================= */
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const clampUI = (v,min,max)=>Math.max(min,Math.min(max,v));

  function toast(text, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.innerHTML = `<div class="bubble">${text}</div>`;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),220); }, ms);
  }

  /* =========================
   * UI — META des ingrédients (fallback)
   * ========================= */
  const BASE_IMG = BASE + 'images/bouton/';
  const ITEMS = {
    'ptikitis_rubictus'          : { name: "Rubictus aux baies rouges",          img: BASE_IMG + 'ing_ptikitis.webp' },
    'foret_champignon'           : { name: "Champignon azulé",                   img: BASE_IMG + 'ing_foret.webp' },
    'foret_champignon_2'         : { name: "Champignon azulé",                   img: BASE_IMG + 'ing_foret.webp' },
    'ames_plante'                : { name: "Olivette Brumis",                    img: BASE_IMG + 'ing_ames.webp' },
    'ames_plante_2'              : { name: "Olivette Brumis",                    img: BASE_IMG + 'ing_ames.webp' },
    'reserve_ptikitis'           : { name: "Pousse rare (Réserve)",              img: BASE_IMG + 'ing_reserve_ptikitis.webp' },
    'atlantide_meduse'           : { name: "Œufs de méduse",                     img: BASE_IMG + 'ing_atlantide.webp' },
    'creatures_essence_thermale' : { name: "Eau thermale",                       img: BASE_IMG + 'ing_creature.webp' },
    'larme_geant'                : { name: "Larme de géant",                     img: BASE_IMG + 'ing_geant.webp' },
    'hegaia_pierre'              : { name: "Pierre Luminescente",                img: BASE_IMG + 'ing_hegaia.webp' },
    'pans_poussiere'             : { name: "Poussière d’étoile",                 img: BASE_IMG + 'ing_pan.webp' },
    'remede_miracle'             : { name: "Remède miracle",                     img: BASE_IMG + 'ing_quacks.webp' },
    'cocktail_huitre'            : { name: "Cocktail d’huître",                  img: BASE_IMG + 'ing_sirenes.webp' },
    'arenyth_ingredient'         : { name: "Fleur Barbapapa",                    img: BASE_IMG + 'ing_arenyth.webp' },
    'yakkas_ecaille'             : { name: "Écaille de Dragon",                  img: BASE_IMG + 'ing_yakkas.webp' }
  };

  /* =========================
   * UI — Injection : Jauge + Overlay + Sac
   * ========================= */
  function ensureEnergyUI(){
    if ($('.energy-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'energy-wrap';
    wrap.innerHTML = `
      <div class="energy-icon">⚡</div>
      <div class="energy-label">Arzanskân</div>
      <div class="energy-bar"><div class="energy-fill" id="energyFill" style="width:0%"></div></div>
      <div class="energy-pct" id="energyPct">0%</div>
    `;
    document.body.appendChild(wrap);
  }

  function ensureLockOverlay(){
    if ($('#lockOverlay')) return;
    const o = document.createElement('div');
    o.id = 'lockOverlay';
    o.className = 'lock-overlay';
    o.style.display = 'none';
    document.body.appendChild(o);
  }

  function ensureBagUI(){
    if ($('.bag-wrap')) return;

    const bagWrap = document.createElement('div');
    bagWrap.className = 'bag-wrap';
    bagWrap.innerHTML = `
      <img src="${BASE}images/bouton/sac_magique.webp" alt="Sac magique"
           class="bag-icon" id="bagIcon" aria-haspopup="true" aria-expanded="false">
      <div class="bag-badge" id="bagBadge">0</div>
      <div class="bag-menu" id="bagMenu" role="menu" aria-label="Inventaire">
        <h3>Ton inventaire</h3>
        <ul id="bagList"></ul>
        <div class="bag-empty" id="bagEmpty">Ton sac est vide…</div>
        <button class="bag-toggle" id="bagToggle" aria-pressed="false" title="Mode tranquille">Mode tranquille</button>
      </div>
    `;
    document.body.appendChild(bagWrap);

    const bagIcon = $('#bagIcon', bagWrap);
    const bagMenu = $('#bagMenu', bagWrap);
    const bagList = $('#bagList', bagWrap);

    const focusBagList = () => {
      if (bagList && !bagList.hasAttribute('tabindex')) bagList.setAttribute('tabindex','0');
      bagList?.focus({ preventScroll: true });
    };

    bagIcon.addEventListener('click', () => {
      const show = !bagMenu.classList.contains('show');
      bagMenu.classList.toggle('show', show);
      bagIcon.setAttribute('aria-expanded', show ? 'true' : 'false');
      if (show) { renderBag(); focusBagList(); }
    });

    document.addEventListener('click', (e) => {
      if (!bagMenu.classList.contains('show')) return;
      if (!bagWrap.contains(e.target)) {
        bagMenu.classList.remove('show');
        bagIcon.setAttribute('aria-expanded','false');
      }
    });

    bagMenu.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bagMenu.classList.contains('show')) {
        bagMenu.classList.remove('show');
        bagIcon.setAttribute('aria-expanded','false');
      }
    });

    $('#bagToggle', bagWrap).addEventListener('click', () => {
      const { mode } = Arz.get();
      Arz.setMode(mode === 'novice' ? 'experimente' : 'novice');
    });
  }

  /* =========================
   * UI — Rendus
   * ========================= */
  function renderGaugeFromCore(detail){
    const elFill = $('#energyFill');
    const elPct  = $('#energyPct');
    if (!elFill || !elPct) return;

    let pct = 0;
    if (typeof detail.energy === 'number' && detail?.cfg?.max > 0){
      pct = Math.round((detail.energy / detail.cfg.max) * 100);
    } else if (typeof detail.pct === 'number'){
      pct = Math.round(detail.pct);
    }
    pct = clampUI(pct, 0, 100);

    elFill.style.width = pct + '%';
    elPct.textContent  = pct + '%';

    document.body.classList.toggle('arz-mode-experimente', detail.mode === 'experimente');
    document.body.classList.toggle('arz-mode-novice',     detail.mode === 'novice');
  }

  function renderBag(){
    const bag = Arz.get().bag || [];
    const bagBadge = $('#bagBadge');
    const bagList  = $('#bagList');
    const bagEmpty = $('#bagEmpty');

    if (bagBadge) bagBadge.textContent = String(bag.reduce((n,e)=>n+e.qty,0));
    if (!bagList || !bagEmpty) return;

    bagList.innerHTML = '';

    if (bag.length === 0){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    bag.forEach((entry, idx)=>{
      const li = document.createElement('li');

      const btn  = document.querySelector(`.quest-ingredient[data-id="${entry.id}"]`);
      const meta = ITEMS[entry.id] || {};
      const name = btn?.getAttribute('data-name') || meta.name || entry.id;
      const img  = btn?.getAttribute('data-img')  || meta.img  || (BASE_IMG + 'grimoire.webp');

      li.innerHTML = `
        <div class="bag-item">
          <img src="${img}" alt="">
          <div>
            <div class="bag-name">${name}</div>
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
        if (Arz.useItemByIndex(idx)) {
          toast('Énergie rechargée à 100% ⚡', 1400);
          renderBag();
        }
      });
    });

    const toggle = $('#bagToggle');
    if (toggle){
      const { mode } = Arz.get();
      const on = (mode === 'experimente');
      toggle.classList.toggle('on', on);
      toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
      toggle.textContent = on ? 'Revenir en mode Novice' : 'Activer le mode Voyageur expérimenté';
      toggle.title = on ? 'Énergie éternelle activée' : 'Basculer en énergie éternelle (brillance)';
    }
  }

  /* =========================
   * UI — Bind des ingrédients
   * ========================= */
  function bindIngredients(){
    $$('.quest-ingredient').forEach(btn=>{
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex','0');
      if (!btn.hasAttribute('role'))     btn.setAttribute('role','button');

      btn.addEventListener('keydown', (e)=>{
        if (e.key==='Enter'||e.key===' '){ e.preventDefault(); btn.click(); }
      });

      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const ok = Arz.addItem(id);
        if (ok){ toast('Ingrédient ajouté au sac.'); renderBag(); }
      });

      const imgEl = btn.querySelector('.ingredient-img');
      if (imgEl){
        const sizeDesk = parseFloat(btn.getAttribute('data-size') || '');
        const sizeMob  = parseFloat(btn.getAttribute('data-size-mobile') || '');
        const applyBaseSize = ()=>{
          const isMob = window.matchMedia('(max-width: 768px)').matches;
          const chosen = isMob ? (isNaN(sizeMob)?sizeDesk:sizeMob) : sizeDesk;
          if (!isNaN(chosen)) imgEl.style.width = chosen + 'px';
        };
        applyBaseSize();
        window.matchMedia('(max-width: 768px)').addEventListener('change', applyBaseSize);
      }

      if (window.matchMedia('(max-width: 768px)').matches){
        const b = btn.getAttribute('data-bottom-mobile');
        const l = btn.getAttribute('data-left-mobile');
        if (b) btn.style.bottom = b;
        if (l) btn.style.left   = l;
      }
    });
  }

  /* =========================
   * Bridge COEUR → UI
   * ========================= */
  function hookCoreEvents(){
    document.addEventListener('arz:energy',     e => renderGaugeFromCore(e.detail));
    document.addEventListener('arz:modechange', () => { renderBag(); });
    document.addEventListener('arz:bagchange',  () => { renderBag(); });
    document.addEventListener('arz:item:used',  () => { renderBag(); });

    document.addEventListener('arz:zero', (e)=>{
      const { redirect, to } = e.detail || {};
      const overlay = $('#lockOverlay');
      if (!overlay) return;
      overlay.style.display = 'grid';
      overlay.innerHTML = `
        <div class="lock-card">
          <div class="lock-title">⚡ Ton énergie est vide</div>
          <div class="lock-desc">
            ${redirect ? 'Redirection en cours…' : 'Change de page pour te recharger.'}
          </div>
        </div>
      `;
    });
  }

  /* =========================
   * Boot (une seule fois)
   * ========================= */
  function boot(){
    ensureEnergyUI();
    ensureLockOverlay();
    ensureBagUI();
    bindIngredients();
    hookCoreEvents();

    // 1er rendu immédiat (avant le 1er tick)
    pushEnergy();
    renderBag();

    // Démarre la boucle selon le mode/page
    startIfNeeded();
  }

  // Départ
  boot();

  // Expose global pour debug éventuel
  window.ArzAll = window.Arz;
})();
