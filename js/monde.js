;(() => {

  /* =========================
   * CONFIG
   * ========================= */

  // ➜ Ajout d’une ligne pour adapter automatiquement les chemins
 const BASE = (location.pathname.includes('/monde/') ||
              location.pathname.includes('/extraits/') ||
              location.pathname.includes('/entree/')) ? '../' : '';


  const CFG = {
    storageKey: 'arz_energy_v2',
    max: 100,
    tickMs: 1000,
    drainPerSecond: 0.10,         // 1 pt / 10 s
    rechargePerSecond: 0.10,      // 1 pt / 10 s (hors Mondes)
    questThresholdPct: 15,        // bandeau d’alerte

    // ➜ Chemins dynamiques
    zeroRedirectUrl: BASE + '2.les_coulisses.html',
    bagIconSrc:      BASE + 'images/bouton/sac_magique.webp',
    grimoireIconSrc: BASE + 'images/bouton/grimoire_test.webp',



    bagSlots: 20,
    perItemMax: 1,

    items: {
      'ptikitis_rubictus': { 
        name: 'Rubictus aux baies rouges', 
        img: BASE + 'images/bouton/ing_ptikitis.png' 
      },
      'foret_champignon': { 
        name: 'Champignon azulé', 
        img: BASE + 'images/bouton/ing_foret.png' 
      },
      'ames_plante': { 
        name: 'Olivette Brumis', 
        img: BASE + 'images/bouton/ing_ames.webp' 
      },
      'reserve_ptikitis': { 
       name: 'Réserve de Raphaël', 
       img: BASE + 'images/bouton/ing_reserve_ptikitis.webp',
  },
      'creatures_essence_thermale': {
        name: 'Essence d’Eau Thermale',
        img: BASE + 'images/bouton/ing_creature.webp'
      },
      'atlantide_meduse': { 
        name: 'Œufs de méduse', 
        img: BASE + 'images/bouton/ing_atlantide.png' 
      },
    },

    messages: {
      low: "Ton Arzanskân faiblit… utilise un ingrédient ou pars en quête.",
      bagFull: "Ton sac est plein (5). Utilise un ingrédient avant d’en ramasser un autre.",
      added: "Ingrédient ajouté au sac.",
      perItemMax: "Tu as déjà ramassé cet ingrédient. Utilise-le pour pouvoir en ramasser un autre !",
      used: "Énergie rechargée à 100%.",
      infinite: "Bravo ! Ton corps s’accorde à la magie des mondes : ton Arzanskân n’a plus besoin d’être rechargé.",
    }
  };

const isDrainPage = (() => {
  const p = location.pathname;

  // 1) Index des mondes
  const inWorldsIndex = /\/3\.les_mondes\.html$/i.test(p) || p.endsWith('/3.les_mondes.html');

  // 2) Vrais mondes (quêtes)
  const inMonde = /\/monde\//i.test(p);

  // 3) Extraits des mondes
  const inExtraits = /\/extraits?\//i.test(p);

  // 4) Entrées de monde (fichiers entrée_*.html)
  const inEntreeMonde = /\/entree\/entree_[a-z0-9_-]+\.html$/i.test(p);

  // 5) Monde Artiste :
  //    - soit dans un dossier /artiste/
  //    - soit ces fichiers à la racine :
  //      5.chanson_de_camidjo.html, 5.louboutartgif.html, 5.loup_bout_art.html
  const inArtisteFolder = /\/artiste\//i.test(p);
  const inArtisteFiles  = /\/(5\.chanson_de_camidjo|5\.louboutartgif|5\.loup_bout_art)\.html$/i.test(p);

  return inWorldsIndex || inMonde || inExtraits || inEntreeMonde || inArtisteFolder || inArtisteFiles;
})();


  // — Normalise les IDs "doublons" (ex: foret_champignon_2 → foret_champignon)
const ID_BASE = (id) => id.replace(/_\d+$/, '');

// — Récupère les métadonnées en priorisant l'ID exact puis l'ID de base
const getMeta = (id) => CFG.items[id] || CFG.items[ID_BASE(id)] || null;


  /* =========================
   * STATE
   * ========================= */
  let S = loadState();

// Si le mode n’existe pas encore (ancien système chill/infinite)
if (!S.mode) {
  S.mode = 'novice'; // par défaut
}

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

/* === Icône Grimoire à côté du sac === */
const grimoireWrap = document.createElement('div');
grimoireWrap.className = 'grimoire-wrap';
grimoireWrap.innerHTML = `
  <img src="${CFG.grimoireIconSrc}" alt="Grimoire d’Arzankia"
       class="grimoire-icon" id="grimoireIcon"
       tabindex="0" aria-label="Ouvrir le Grimoire">
`;
document.body.appendChild(grimoireWrap);

// Lien vers ta modale existante
const grimoireIcon = document.getElementById('grimoireIcon');
const modalGrimoire = document.getElementById('modalGrimoire');
const inputG = document.getElementById('pwdGrimoire');

function openGrimoireModal(){
  modalGrimoire?.classList.add('open');
  setTimeout(()=>inputG?.focus(),100);
}

grimoireIcon?.addEventListener('click', openGrimoireModal);
grimoireIcon?.addEventListener('keydown', e=>{
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openGrimoireModal(); }
});

/* Bonus : révéler les ingrédients cachés pendant 6s */
function hintHidden(){
  const btns = document.querySelectorAll('.quest-ingredient');
  btns.forEach(b => b.classList.add('reveal-hint'));
  setTimeout(()=>btns.forEach(b => b.classList.remove('reveal-hint')), 6000);
}
grimoireIcon?.addEventListener('click', hintHidden);



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
  // Si on est en Novice → on passe en Expérimenté
  // Si on est en Expérimenté → on revient en Novice
  S.mode = (S.mode === 'novice') ? 'experimente' : 'novice';
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
  // Toujours stopper avant de redémarrer (évite les doublons)
  stop();

  // Mode Voyageur expérimenté → énergie éternelle
  if (S.mode === 'experimente') {
    S.energy = CFG.max;
    renderGauge();
    saveState();
    return; // pas de timer en mode éternel
  }

  // Mode Novice
  start(); // relance le timer à chaque fois
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
  if (document.hidden) return;

  // Mode Voyageur expérimenté → énergie éternelle
  if (S.mode === 'experimente') {
    S.energy = CFG.max;
    renderGauge();
    saveState();
    return;
  }

  // Mode Novice
  if (isDrainPage) {
    // En Monde → la jauge descend lentement
    S.energy = clamp(S.energy - CFG.drainPerSecond, 0, CFG.max);
    if (S.energy <= 0){
      saveState();
      return redirectZero(); // redirection si énergie vide
    }
  } else {
    // Hors Monde (Accueil, Coulisses, Héros, Autrice, Grimoire) → la jauge remonte
    S.energy = clamp(S.energy + CFG.rechargePerSecond, 0, CFG.max);
  }

  renderGauge();
  saveState();
}

function renderAll(){
  renderGauge();
  renderBag();
  updateRibbon();

  // Ajoute la classe de mode sur le body (utile pour la brillance)
  document.body.classList.toggle('arz-mode-experimente', S.mode === 'experimente');
  document.body.classList.toggle('arz-mode-novice', S.mode === 'novice');
}

function updateRibbon(){
  const pct = (S.energy / CFG.max) * 100;
  // Le ruban n’apparaît que si on est en mode Novice et dans un Monde
  const show = (S.mode === 'novice') && isDrainPage && (pct <= CFG.questThresholdPct);
  ribbon.style.display = show ? 'block' : 'none';
}

function renderGauge(){
  const pct = Math.round((S.energy / CFG.max) * 100);
  if (elFill) elFill.style.width = pct + '%';
  if (elPct)  elPct.textContent = pct + '%';
  updateRibbon();
}

function redirectZero(){
  if (lockShown) return;  // évite les appels multiples
  lockShown = true;
  stop(); // arrête le timer d'énergie

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

   
 // état visuel + libellé du toggle (nouveaux modes)
if (S.mode === 'experimente') {
  bagToggle.classList.add('on');
  bagToggle.setAttribute('aria-pressed', 'true');
  bagToggle.textContent = 'Revenir en mode Novice';
  bagToggle.title = 'Énergie éternelle activée';
} else {
  bagToggle.classList.remove('on');
  bagToggle.setAttribute('aria-pressed', 'false');
  bagToggle.textContent = 'Activer le mode Voyageur expérimenté';
  bagToggle.title = 'Basculer en énergie éternelle (brillance)';
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
 * COLLECT + SIZE + POSITION MOBILE
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
        if (entry.qty >= CFG.perItemMax){ toast(CFG.messages.perItemMax); return; }
        entry.qty++;
      } else {
        if (S.bag.length >= CFG.bagSlots){ toast(CFG.messages.bagFull); return; }
        entry = { id, qty: 1 };
        S.bag.push(entry);
      }

      saveState(); renderBag(); toast(CFG.messages.added);
    });

    // --- TAILLE PAR MONDE (PC / mobile) ---
    const imgEl = btn.querySelector('.ingredient-img');
    if (imgEl) {
      const sizeDesk = parseFloat(btn.getAttribute('data-size') || '');
      const sizeMob  = parseFloat(btn.getAttribute('data-size-mobile') || '');

      const applyBaseSize = () => {
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const chosen = isMobile ? (isNaN(sizeMob) ? sizeDesk : sizeMob) : sizeDesk;
        if (!isNaN(chosen)) imgEl.style.width = chosen + 'px';
      };
      applyBaseSize();
      window.matchMedia('(max-width: 768px)').addEventListener('change', applyBaseSize);

      // (Aucun pulse au clic/au touch : supprimé)
      // (Tu peux aussi retirer complètement data-zoom / data-zoom-mobile de l’HTML)
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
  const nameAttr = btn?.getAttribute('data-name');
  const imgAttr  = btn?.getAttribute('data-img');

  const meta = getMeta(id);  // ← tentera l'ID exact, puis l'ID "de base"

  return {
    // Priorité : HTML (data-name / data-img) > CFG.items > fallback id / vide
    name: nameAttr || meta?.name || id,
    img : imgAttr  || meta?.img  || ''
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
  t.className = 'arz-toast';
  t.innerHTML = `<div class="bubble">${text}</div>`;  // ← bulle interne
  document.body.appendChild(t);

  requestAnimationFrame(()=> t.classList.add('show'));
  setTimeout(()=>{
    t.classList.remove('show');
    setTimeout(()=> t.remove(), 220);
  }, ms);
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
