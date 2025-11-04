;(() => {

  // Masquer jauge/sac sur accueil et index
const HIDE_GAUGE = (() => {
  const p = location.pathname.toLowerCase();
  return (
    p.endsWith('/index.html') ||
    p === '/' ||
    p.endsWith('accueil.html') ||
    p.endsWith('1.accueil.html')
  );
})();

  // Empêche une double init
  if (window.ArzUIMonde) return;
  window.ArzUIMonde = true;

  // =====================
// ARZ — Registre items
// =====================
const ARZ_ITEMS = {
  // --- CONSOMMABLES (utilisables depuis le sac)
  'ptikitis_rubictus': { name:'Rubictus aux baies rouges', img:'../images/bouton/ing_ptikitis.webp', kind:'consumable', stack:true, effect:{type:'recharge', value:'50%'} },
  'reserve_ptikitis' : { name:'Pousse rare (Réserve)',     img:'../images/bouton/ing_reserve_ptikitis.webp', kind:'consumable', stack:true, effect:{type:'recharge', value:'100%'} },
  'eau_thermale'     : { name:'Eau thermale',              img:'../images/bouton/ing_eau_thermale.webp', kind:'consumable', stack:true, effect:{type:'recharge', value:'30%'} },
  'larme_gant'     : { name:'Larme de géant',              img:'../images/bouton/ing_geant.webp', kind:'consumable', stack:true, effect:{type:'recharge', value:'30%'} },

  // --- OBJETS DE QUÊTE (non consommables)
  'foret_champignon' : { name:'Champignon azulé', img:'../images/bouton/ing_foret.png', kind:'quest', stack:false },

  // --- STOCK / CRAFT (non consommables, serviront au labo d’Amandine)
  // === AMES ===
'ames_plante'      : { name:'Olivette Brumis', img:'../images/bouton/ing_ames.webp', kind:'stash', stack:true },

// === FORÊT ===
'foret_fleur'      : { name:'Pétale de forêt enchantée', img:'../images/bouton/ing_foret.webp', kind:'stash', stack:true },


// === PANS ===
'pans_poudre'      : { name:'Poudre de nuage', img:'../images/bouton/ing_pans.webp', kind:'stash', stack:true },


// === ATLANTIDE ===
'atlantide_perle'  : { name:'Perle d’Atlantide', img:'../images/bouton/ing_atlantide.webp', kind:'stash', stack:true },

// === SIRÈNES ===
'sirene_ecume'     : { name:'Écume des sirènes', img:'../images/bouton/ing_sirene.webp', kind:'stash', stack:true },

// === ARENYTH ===
'arenyth_barbabichon': { name:'Barbabichon', img:'../images/bouton/ing_arenyth.webp', kind:'stash', stack:true },

// === CITÉS D’OR ===
'cite_argile'       : { name:'Argile de roche sableuse', img:'../images/bouton/bouton_cite.webp', kind:'stash', stack:true },
'cite_cactus'       : { name:'Cactus des sables', img:'../images/bouton/ing_cite.webp', kind:'quest', stack:true },

// === FÉES ===
'fee_pollen'        : { name:'Pollen archidale', img:'../images/bouton/ing_fee.webp', kind:'stash', stack:true },

// === SIRÈNES — BOUTON SPÉCIAL ===
'sirene_essence'    : { name:'Essence chantante des Sirènes', img:'../images/bouton/bouton_sirene.webp', kind:'quest', stack:true },


  // ...ajoute ici les autres ingrédients au fur et à mesure
};

// helpers
const getReg = id => ARZ_ITEMS[id] || { name:id, img:'', kind:'stash', stack:true }; // par défaut: stock
const isConsumable = id => getReg(id).kind === 'consumable';
const isQuest      = id => getReg(id).kind === 'quest';
const isStash      = id => getReg(id).kind === 'stash';

  // ====== Sac : lecture / écriture / ajout / retrait ======
Arz.getBag = function () {
  try { return JSON.parse(localStorage.getItem('arz_bag_v1')) || []; }
  catch { return []; }
};

Arz.saveBag = function (b) {
  localStorage.setItem('arz_bag_v1', JSON.stringify(b));
};

Arz.addItem = function (id) {
  const reg = getReg(id);
  const bag = Arz.getBag();
  const idx = bag.findIndex(it => it.id === id);

  if (idx >= 0 && reg.stack) {
    bag[idx].qty = (bag[idx].qty || 1) + 1;
  } else if (idx === -1) {
    bag.push({ id, qty: 1, kind: reg.kind });
  } else {
    // non-empilable déjà présent → on ignore
    return false;
  }
  Arz.saveBag(bag);
  // Notifie l’UI existante
  document.dispatchEvent(new CustomEvent('arz:bagchange'));
  return true;
};

Arz.getItemByIndex = idx => Arz.getBag()[idx];

Arz.removeOne = function (id) {
  const bag = Arz.getBag();
  const i = bag.findIndex(it => it.id === id);
  if (i < 0) return false;
  if ((bag[i].qty || 1) > 1) bag[i].qty--; else bag.splice(i, 1);
  Arz.saveBag(bag);
  document.dispatchEvent(new CustomEvent('arz:bagchange'));
  return true;
};



  /* -------------------------
   * Utils
   * ------------------------- */
const P = location.pathname;
const BASE = (P.includes('/monde/') ||
              P.includes('/extrait/') || P.includes('/extraits/') ||
              P.includes('/entree/')) ? '../' : '';


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
  'arenyth_ingredient'         : { name: "Fleur Barbapapa",                    img: BASE_IMG + 'ing_arenyth.webp' },
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

  // Sélecteurs internes (il FAUT ces lignes)
  const bagIcon = $('#bagIcon', bagWrap);
  const bagMenu = $('#bagMenu', bagWrap);
  const bagList = $('#bagList', bagWrap);

  // Focus helper pour la zone scrollable
  const focusBagList = () => {
    if (bagList && !bagList.hasAttribute('tabindex')) bagList.setAttribute('tabindex','0');
    bagList?.focus({ preventScroll: true });
  };

  // Ouvrir / fermer sur clic icône
  bagIcon.addEventListener('click', () => {
    const show = !bagMenu.classList.contains('show');
    bagMenu.classList.toggle('show', show);
    bagIcon.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) { renderBag(); focusBagList(); }
  });

  // Fermer si clic en dehors
  document.addEventListener('click', (e) => {
    if (!bagMenu.classList.contains('show')) return;
    if (!bagWrap.contains(e.target)) {
      bagMenu.classList.remove('show');
      bagIcon.setAttribute('aria-expanded','false');
    }
  });

  // Ne pas fermer quand on clique dans le menu
  bagMenu.addEventListener('click', (e) => e.stopPropagation());

  // Fermer avec Échap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && bagMenu.classList.contains('show')) {
      bagMenu.classList.remove('show');
      bagIcon.setAttribute('aria-expanded','false');
    }
  });

  // Toggle mode (novice ↔ expérimenté) inchangé
  $('#bagToggle', bagWrap).addEventListener('click', () => {
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
    pct = Math.round(detail.pct);
  }
  pct = clamp(pct, 0, 100);

  elFill.style.width = pct + '%';
  elPct.textContent  = pct + '%';

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

 function renderBag() {
  const bag = Arz.getBag();
  const bagBadge = $('#bagBadge');
  const bagList  = $('#bagList');
  const bagEmpty = $('#bagEmpty');

  if (bagBadge) bagBadge.textContent = String(bag.reduce((n, e) => n + e.qty, 0));
  if (!bagList || !bagEmpty) return;

  if (bag.length === 0) {
    bagList.innerHTML = '';
    bagEmpty.style.display = 'block';
    return;
  }
  bagEmpty.style.display = 'none';

  // 3 groupes
  const groups = { consumable: [], stash: [], quest: [] };
  for (const it of bag) (groups[it.kind] || groups.stash).push(it);

  const mkItem = (it, idx) => {
    const reg = getReg(it.id);
    const qty = it.qty || 1;
    const usable = (it.kind === 'consumable');
    return `
      <li class="bag-item" data-index="${idx}">
        <img src="${reg.img || (BASE + 'images/bouton/grimoire.webp')}" alt="" class="bag-thumb">
        <div class="bag-info">
          <div class="bag-name">${reg.name || it.id}</div>
          <div class="bag-qty">×${qty}</div>
        </div>
        ${usable ? `<button class="bag-use" data-index="${idx}" title="Utiliser">Utiliser</button>` : ``}
      </li>
    `;
  };

  const flat = [];
  const pushGroup = (title, arr) => {
    if (!arr.length) return '';
    const start = flat.length;
    flat.push(...arr);
    const items = arr.map((it, i) => mkItem(it, start + i)).join('');
    return `<h4 class="bag-section">${title}</h4><ul class="bag-list">${items}</ul>`;
  };

  bagList.innerHTML =
    pushGroup('À consommer', groups.consumable) +
    pushGroup('À stocker',   groups.stash) +
    pushGroup('Ingrédients de quête', groups.quest);

  // Binder les "Utiliser" (consommables seulement)
  $$('.bag-use', bagList).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      const entry = Arz.getItemByIndex(idx);
      const reg   = entry && getReg(entry.id);
      if (!entry || !reg || reg.kind !== 'consumable') return;

      applyConsumableEffect(entry.id, reg);
      Arz.removeOne(entry.id);
      renderBag();
    });
  });

  const toggle = $('#bagToggle');
  if (toggle) {
    const { mode } = Arz.get();
    const on = (mode === 'experimente');
    toggle.classList.toggle('on', on);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.textContent = on ? 'Revenir en mode Novice' : 'Activer le mode Voyageur expérimenté';
  }
}
  function applyConsumableEffect(id, reg) {
  if (!reg?.effect) return;

  if (reg.effect.type === 'recharge') {
    const v = reg.effect.value;
    if (typeof v === 'string' && v.endsWith('%')) {
      const pct = parseFloat(v) / 100;
      S.energy = Math.min(CFG.max, S.energy + CFG.max * pct);
    } else {
      S.energy = Math.min(CFG.max, S.energy + Number(v || 0));
    }
    renderGauge && renderGauge();
    saveState && saveState();
    toast('Énergie rechargée ⚡', 1200);
  }
}


  function bindIngredients(){
    $$('.quest-ingredient').forEach(btn=>{
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex','0');
      if (!btn.hasAttribute('role'))     btn.setAttribute('role','button');
      btn.addEventListener('keydown', (e)=>{
        if (e.key==='Enter'||e.key===' '){ e.preventDefault(); btn.click(); }
      });

     btn.addEventListener('click', () => {
  const id = btn.getAttribute('data-id');
  if (!id) return;

  const ok = Arz.addItem(id);
  if (ok) {
    toast('Ingrédient ajouté au sac.');
    renderBag();

    // 🔽 Ici : avertit qu'un ingrédient a été récolté
    document.dispatchEvent(new CustomEvent('arz:ingredient-collected', {
      detail: {
        id: id,
        name: btn.getAttribute('data-name') || 'Ingrédient'
      }
    }));
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
function boot() {
  if (!HIDE_GAUGE) {
    ensureEnergyUI();
    ensureRibbon();
    ensureLockOverlay();
    ensureBagUI();
  }

  bindIngredients();
  hookCoreEvents();

document.addEventListener('arz:quest-item-delivered', (ev) => {
  const id = ev.detail?.id;
  if (!id) return;
  Arz.removeOne(id);
  renderBag();
});


  // --- 1er rendu (déplacé ici) ---
  const st = Arz.get();
  renderGaugeFromCore({
    pct: Math.round((st.energy / st.cfg.max) * 100),
    energy: st.energy,
    mode: st.mode,
    isDrainPage: Arz.isDrainPage(),
    cfg: st.cfg
  });
  renderBag();
}

whenCoreReady(boot);

})();
