;(function(){
  // ===== CONFIG =====
  const CONFIG = {
    key: 'arz_energy_v1',
    max: 100,
    drainPerSecond: 0.1,     // 1 point / 10s
    tickMs: 1000,
    questThresholdPct: 15,   // alerte/quète à <= 15%
    zeroRedirectUrl: '2.les_coulisses.html',
    bagMax: 5,
    bagIconSrc: 'sac_magique.webp', // <— mets ce nom de fichier (ou change-le ici)
    // Mapping par défaut (si les boutons n’ont pas data-name / data-img)
    items: {
      'ptikitis_rubictus': { name: 'Rubictus aux baies rouges', img: 'ing_ptikitis.webp' },
      'foret_champignon' : { name: 'Champignon bleu',          img: 'ing_foret.webp' },
      'ames_plante'      : { name: 'Olivette Brumis',          img: 'ing_ames.webp' },
      'reserve_ptikitis' : { name: 'Pousse rare (Réserve)',     img: 'ing_reserve_ptikitis.webp' },
      'eau_creature'     : { name: 'Essence des créatures de l’eau', img: 'ing_creature.webp' },
    },
    messages: {
      low: "Ton Arzanskân faiblit… utilise un ingrédient ou trouve-en un nouveau.",
      bagFull: "Ton sac est plein (5). Utilise un ingrédient avant d’en ramasser un autre.",
      added: "Ingrédient ajouté au sac.",
      already: "Cet ingrédient a déjà été acquis ou utilisé.",
      infinite: "Bravo ! Ton corps s’est accordé à la magie des mondes.\nTu n’as plus besoin de recharger ton Arzanskân."
    }
  };

  // ===== STATE =====
  let state = loadState();
  let intervalId = null;

  // ===== DOM refs jauge =====
  const elFill = document.getElementById('energyFill');
  const elPct  = document.getElementById('energyPct');
  const overlay= document.getElementById('lockOverlay');

  // ===== UI: ruban alerte (quête ≤15%) =====
  const ribbon = document.createElement('div');
  ribbon.className = 'quest-ribbon';
  ribbon.style.display = 'none';
  ribbon.textContent = CONFIG.messages.low;
  document.body.appendChild(ribbon);

  // ===== UI: sac + menu =====
  const bagWrap = document.createElement('div');
  bagWrap.className = 'bag-wrap';
  bagWrap.innerHTML = `
    <img src="${CONFIG.bagIconSrc}" alt="Sac magique" class="bag-icon" id="bagIcon" aria-haspopup="true" aria-expanded="false">
    <div class="bag-badge" id="bagBadge">0</div>
    <div class="bag-menu" id="bagMenu" role="menu" aria-label="Inventaire">
      <h3>Ton sac magique</h3>
      <ul id="bagList"></ul>
      <div class="bag-empty" id="bagEmpty">Ton sac est vide…</div>
    </div>
  `;
  document.body.appendChild(bagWrap);

  const bagIcon  = bagWrap.querySelector('#bagIcon');
  const bagMenu  = bagWrap.querySelector('#bagMenu');
  const bagList  = bagWrap.querySelector('#bagList');
  const bagBadge = bagWrap.querySelector('#bagBadge');
  const bagEmpty = bagWrap.querySelector('#bagEmpty');

  bagIcon.addEventListener('click', () => {
    const show = !bagMenu.classList.contains('show');
    bagMenu.classList.toggle('show', show);
    bagIcon.setAttribute('aria-expanded', show ? 'true' : 'false');
    renderBag();
  });
  document.addEventListener('click', (e) => {
    if(!bagWrap.contains(e.target)) {
      bagMenu.classList.remove('show');
      bagIcon.setAttribute('aria-expanded', 'false');
    }
  });

  // ===== INIT listeners: collecte d’ingrédients sur la page =====
  initCollectibles();

  // ====== TICK ======
  renderAll();
  if (state.infinite) {
    // pas de drain
  } else if (state.energy > 0) {
    start();
  } else {
    // si énergie déjà à 0 au chargement
    redirectZero();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.infinite) return;
    if (state.energy > 0 && !intervalId) start();
  });

  window.addEventListener('beforeunload', saveState);

  // ====== FUNCTIONS ======
  function start(){
    if(intervalId) return;
    intervalId = setInterval(tick, CONFIG.tickMs);
  }
  function stop(){
    if(!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
  }
  function tick(){
    if (state.infinite) { stop(); return; }
    if (document.hidden) return;
    state.energy = clamp(state.energy - CONFIG.drainPerSecond, 0, CONFIG.max);
    if (state.energy <= 0) {
      saveState();
      redirectZero();
      return;
    }
    renderGauge();
    saveState();
  }

  function renderAll(){
    renderGauge();
    renderBag();
    updateRibbon();
    updateInfiniteUI();
  }

  function renderGauge(){
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    if (elFill) elFill.style.width = pct + '%';
    if (elPct)  elPct.textContent = Math.round(pct) + '%';
    updateRibbon();
  }

  function updateRibbon(){
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    if (pct <= CONFIG.questThresholdPct && !state.infinite) {
      ribbon.style.display = 'block';
    } else {
      ribbon.style.display = 'none';
    }
  }

  function updateInfiniteUI(){
    // Ajoute une classe si tu veux styliser la jauge en "infini"
    document.body.classList.toggle('arz-infinite', !!state.infinite);
  }

  function redirectZero(){
    window.location.href = CONFIG.zeroRedirectUrl;
  }

  // ====== SAC ======
  function renderBag(){
    // badge
    bagBadge.textContent = String(state.bag.length);
    bagBadge.style.display = 'block'; // visible même si 0 (icône toujours visible)
    // contenu
    bagList.innerHTML = '';
    if(state.bag.length === 0){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    state.bag.forEach((it, idx) => {
      const meta = getMeta(it);
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="bag-item">
          <img src="${meta.img}" alt="" />
          <div class="bag-label">
            <div class="bag-name">${meta.name}</div>
            <div class="bag-id">${it}</div>
          </div>
        </div>
        <button type="button" class="bag-use" data-index="${idx}">Utiliser</button>
      `;
      bagList.appendChild(li);
    });

    bagList.querySelectorAll('.bag-use').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        useItemAt(index);
      });
    });
  }

  function useItemAt(index){
    if(index < 0 || index >= state.bag.length) return;
    const id = state.bag[index];
    // consommer
    state.bag.splice(index, 1);
    // marquer comme utilisé
    if (!state.used.includes(id)) state.used.push(id);
    // recharge à 100%
    state.energy = CONFIG.max;
    // check infini (3 IDs distincts utilisés)
    if (state.used.length >= 3 && !state.infinite){
      state.infinite = true;
      // message unique
      if (!state.msgShown){
        state.msgShown = true;
        toast(CONFIG.messages.infinite, 4500);
      }
      stop();
      updateInfiniteUI();
    }
    saveState();
    renderAll();
  }

  // ====== COLLECTIBLES ======
  function initCollectibles(){
    // tous les boutons/éléments cliquables d’ingrédients cachés
    document.querySelectorAll('.quest-ingredient').forEach(btn => {
      // accessibilité
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });

      btn.addEventListener('click', () => {
        const id   = btn.getAttribute('data-id');
        if(!id) return;
        // déjà utilisé ou déjà dans le sac ?
        if (state.used.includes(id) || state.bag.includes(id)){
          toast(CONFIG.messages.already);
          return;
        }
        if (state.bag.length >= CONFIG.bagMax){
          toast(CONFIG.messages.bagFull);
          return;
        }
        // OK → on ajoute au sac
        state.bag.push(id);
        saveState();
        renderBag();
        toast(CONFIG.messages.added);
      });
    });
  }

  // ====== HELPERS ======
  function getMeta(id){
    // essaie de trouver un bouton source pour data-name/data-img
    const source = document.querySelector(`.quest-ingredient[data-id="${id}"]`);
    const name = source?.getAttribute('data-name');
    const img  = source?.getAttribute('data-img');
    if (name || img) return {
      name: name || (CONFIG.items[id]?.name || id),
      img : img  || (CONFIG.items[id]?.img  || '')
    };
    return {
      name: CONFIG.items[id]?.name || id,
      img : CONFIG.items[id]?.img  || ''
    };
  }

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)) }

  function loadState(){
    const raw = localStorage.getItem(CONFIG.key);
    const def = { energy: CONFIG.max, bag: [], used: [], infinite: false, msgShown: false };
    if (!raw) return def;
    try {
      const s = JSON.parse(raw);
      // migration / valeurs par défaut
      if (!Array.isArray(s.bag)) s.bag = [];
      if (!Array.isArray(s.used)) s.used = [];
      if (typeof s.infinite !== 'boolean') s.infinite = false;
      if (typeof s.msgShown !== 'boolean') s.msgShown = false;
      if (typeof s.energy !== 'number') s.energy = CONFIG.max;
      return s;
    } catch {
      return def;
    }
  }
  function saveState(){ localStorage.setItem(CONFIG.key, JSON.stringify(state)) }

  // mini toast
  function toast(text, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(()=> t.classList.add('show'), 10);
    setTimeout(()=> {
      t.classList.remove('show');
      setTimeout(()=> t.remove(), 250);
    }, ms);
  }

  // (option) API dev dans la console
  window.Arz = {
    get: () => ({...state}),
    setEnergy: (v)=>{ state.energy = clamp(v,0,CONFIG.max); saveState(); renderAll(); },
    add: (id)=>{ if(state.bag.length<CONFIG.bagMax && !state.used.includes(id) && !state.bag.includes(id)){ state.bag.push(id); saveState(); renderAll(); } },
    use: (id)=>{ const i = state.bag.indexOf(id); if(i>=0) useItemAt(i); },
    reset: ()=>{ state = { energy: CONFIG.max, bag: [], used: [], infinite: false, msgShown:false }; saveState(); renderAll(); start(); }
  };
})();
