;(() => {
  // Empêche une double init
  if (window.ArzUIMonde) return;
  window.ArzUIMonde = true;

  /* -------------------------
   * Utils
   * ------------------------- */
  const BASE = (location.pathname.includes('/monde/') ||
                location.pathname.includes('/extraits/') ||
                location.pathname.includes('/entree/')) ? '../' : '';

  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

  const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));

  function toast(text, ms=1800){
    // Nécessite la CSS .arz-toast/.bubble déjà dans tes styles
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.innerHTML = `<div class="bubble">${text}</div>`;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),220); }, ms);
  }
  // Base images selon l'emplacement de la page
const BASE_IMG = BASE + 'images/bouton/';

// Fallback des métadonnées des ingrédients (utile quand la page n’a pas de .quest-ingredient)
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
  'yakkas_ecaille'             : { name: "Écaille de Dragon",                  img: BASE_IMG + 'ing_yakkas.webp' }
};


  /* -------------------------
   * Attendre le cœur (Arz)
   * ------------------------- */
  function whenCoreReady(cb){
    if (window.Arz && typeof window.Arz.get === 'function') return cb();
    const it = setInterval(()=>{
      if (window.Arz && typeof window.Arz.get === 'function'){
        clearInterval(it); cb();
      }
    }, 30);
    setTimeout(()=>clearInterval(it), 6000);
  }

  /* -------------------------
   * Injection UI (jauge + sac)
   * ------------------------- */
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

 function ensureRibbon(){
  // Le ruban d’avertissement est désactivé sur cette version,
  // car l’explication est désormais directement affichée sur la page Monde.
  return;
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
      <img src="${BASE}images/bouton/sac_magique.webp" alt="Sac magique" class="bag-icon" id="bagIcon" aria-haspopup="true" aria-expanded="false">
      <div class="bag-badge" id="bagBadge">0</div>
      <div class="bag-menu" id="bagMenu" role="menu" aria-label="Inventaire">
        <h3>Ton inventaire</h3>
        <ul id="bagList"></ul>
        <div class="bag-empty" id="bagEmpty">Ton sac est vide…</div>
        <button class="bag-toggle" id="bagToggle" aria-pressed="false" title="Mode tranquille">Mode tranquille</button>
      </div>
    `;
    document.body.appendChild(bagWrap);

    // Interactions du sac
    const bagIcon   = $('#bagIcon',  bagWrap);
    const bagMenu   = $('#bagMenu',  bagWrap);
    bagIcon.addEventListener('click', ()=>{
      const show = !bagMenu.classList.contains('show');
      bagMenu.classList.toggle('show', show);
      bagIcon.setAttribute('aria-expanded', show ? 'true' : 'false');
      if (show) renderBag(); // affichage à l’ouverture
    });
    document.addEventListener('click', (e)=>{
      if (!bagWrap.contains(e.target)){
        bagMenu.classList.remove('show');
        bagIcon.setAttribute('aria-expanded','false');
      }
    });

    // Toggle mode (novice ↔ expérimenté)
    $('#bagToggle').addEventListener('click', ()=>{
      const { mode } = Arz.get();
      Arz.setMode(mode === 'novice' ? 'experimente' : 'novice');
    });
  }

  /* -------------------------
   * Rendu UI (écoute événements du cœur)
   * ------------------------- */
 function renderGaugeFromCore(detail){
  const elFill = $('#energyFill');
  const elPct  = $('#energyPct');
  if (!elFill || !elPct) return;

  let pct = 0;

  if (typeof detail.energy === 'number' && detail?.cfg && typeof detail.cfg.max === 'number' && detail.cfg.max > 0){
    pct = Math.round( (detail.energy / detail.cfg.max) * 100 );
  } else if (typeof detail.pct === 'number'){
    // Si le cœur fournit déjà un pourcentage
    pct = Math.round(detail.pct);
  }

  pct = clamp(pct, 0, 100);
  elFill.style.width = pct + '%';
  elPct.textContent  = pct + '%';
}

    // Ruban (novice + drain + sous seuil)
    const ribbon = $('.quest-ribbon');
    if (ribbon){
      const threshold = (Arz.get().cfg.questThresholdPct ?? 15);
      const show = (detail.mode === 'novice') && detail.isDrainPage && (pct <= threshold);
      ribbon.style.display = show ? 'block' : 'none';
    }

    // Classe de mode pour effets visuels (brillance)
    document.body.classList.toggle('arz-mode-experimente', detail.mode === 'experimente');
    document.body.classList.toggle('arz-mode-novice', detail.mode === 'novice');
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
      // Le nom et l'image peuvent venir d’attributs data-* de l’HTML de l’ingrédient
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

    // État du bouton de mode
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

  function bindIngredients(){
    $$('.quest-ingredient').forEach(btn=>{
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex','0');
      if (!btn.hasAttribute('role'))     btn.setAttribute('role','button');
      btn.addEventListener('keydown', (e)=>{
        if (e.key==='Enter'||e.key===' '){ e.preventDefault(); btn.click(); }
      });

      // Collecte → passe par le cœur
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const ok = Arz.addItem(id);
        if (ok){
          toast('Ingrédient ajouté au sac.');
          renderBag();
        }
      });

      // Taille responsive via data-size / data-size-mobile
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

      // Position mobile via data-bottom-mobile / data-left-mobile
      if (window.matchMedia('(max-width: 768px)').matches){
        const b = btn.getAttribute('data-bottom-mobile');
        const l = btn.getAttribute('data-left-mobile');
        if (b) btn.style.bottom = b;
        if (l) btn.style.left   = l;
      }
    });
  }

  /* -------------------------
   * Hooks des événements du cœur
   * ------------------------- */
  function hookCoreEvents(){
    document.addEventListener('arz:energy',      e => renderGaugeFromCore(e.detail));
    document.addEventListener('arz:modechange',  () => { renderBag(); });
    document.addEventListener('arz:bagchange',   () => { renderBag(); });
    document.addEventListener('arz:item:used',   () => { renderBag(); });

    // Optionnel : mini-overlay quand energie = 0 avant redirection
    document.addEventListener('arz:zero', (e)=>{
      const { redirect, to } = e.detail || {};
      const overlay = $('#lockOverlay');
      if (!overlay) return;
      overlay.style.display = 'grid';
      overlay.innerHTML = `
        <div class="lock-card">
          <div class="lock-title">⚡ Ton énergie est vide</div>
          <div class="lock-desc">${redirect ? 'Tu vas être redirigé vers les Coulisses d’Arzankia…' : 'Reviens hors des Mondes pour te recharger.'}</div>
        </div>
      `;
    });
  }

  /* -------------------------
   * Boot UI
   * ------------------------- */
  function boot(){
    ensureEnergyUI();
    ensureRibbon();
    ensureLockOverlay();
    ensureBagUI();
    bindIngredients();
    hookCoreEvents();

    // 1er rendu depuis l’état courant
    const st = Arz.get();
    renderGaugeFromCore({
      pct: Math.round((st.energy / st.cfg.max)*100),
      energy: st.energy,
      mode: st.mode,
      isDrainPage: Arz.isDrainPage(),
      cfg: st.cfg
    });
    renderBag();
  }

  whenCoreReady(boot);
})();
