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
    bagIconSrc: 'sac_magique.webp',
    // libellés par défaut si data-name / data-img ne sont pas fournis sur le bouton
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
    redirectZero();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.infinite) return;
    if (state.energy > 0 && !intervalId) start();
  });

  window.addEventListener('beforeunload', saveState);

  // ====== LOOP / RENDER ======
  function start(){ if(!intervalId) intervalId = setInterval(tick, CONFIG.tickMs); }
  function stop(){ if(intervalId){ clearInterval(intervalId); intervalId=null; } }

  function tick(){
    if (state.infinite) { stop(); return; }
    if (document.hidden) return;
    state.energy = clamp(state.energy - CONFIG.drainPerSecond, 0, CONFIG.max);
    if (state.energy <= 0) { saveState(); redirectZero(); return; }
    renderGauge(); saveState();
  }

  function renderAll(){ renderGauge(); renderBag(); updateRibbon(); updateInfiniteUI(); }

  function renderGauge(){
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    if (elFill) elFill.style.width = pct + '%';
    if (elPct)  elPct.textContent = Math.round(pct) + '%';
    updateRibbon();
  }

  function updateRibbon(){
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    ribbon.style.display = (pct <= CONFIG.questThresholdPct && !state.infinite) ? 'block' : 'none';
  }

  function updateInfiniteUI(){ document.body.classList.toggle('arz-infinite', !!state.infinite); }

  function redirectZero(){ window.location.href = CONFIG.zeroRedirectUrl; }

  // ====== SAC ======
  function renderBag(){
    bagBadge.textContent = String(state.bag.length);
    bagBadge.style.display = 'block';

    bagList.innerHTML = '';
    if(state.bag.length === 0){ bagEmpty.style.display = 'block'; return; }
    bagEmpty.style.display = 'none';

    state.bag.forEach((entry, idx) => {
      const id   = getId(entry);
      const used = isUsed(entry);
      const meta = getMeta(id);

      const li = document.createElement('li');
      li.innerHTML = `
        <div class="bag-item">
          <img src="${meta.img}" alt="" />
          <div class="bag-label">
            <div class="bag-name">${meta.name}</div>
          </div>
        </div>
        ${ used
            ? `<div class="bag-used" aria-label="Ingrédient déjà utilisé">✓ Utilisé</div>`
            : `<button type="button" class="bag-use" data-index="${idx}">Utiliser</button>` }
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

    const entry = state.bag[index];
    const id = getId(entry);

    // 1) marquer comme utilisé (ne plus retirer l’objet du sac)
    if (typeof entry === 'string') {
      state.bag[index] = { id, used: true };
    } else {
      entry.used = true;
    }

    // 2) recharge à 100 %
    state.energy = CONFIG.max;

    // 3) journaliser l’utilisation pour le mode infini
    if (!state.used.includes(id)) state.used.push(id);

    // 4) passage en infini après 3 différents
    if (state.used.length >= 3 && !state.infinite){
      state.infinite = true;
      if (!state.msgShown){
        state.msgShown = true;
        toast(CONFIG.messages.infinite, 4500);
      }
      stop(); updateInfiniteUI();
    }

    saveState(); renderAll();
  }

  // ====== COLLECTIBLES ======
  function initCollectibles(){
    document.querySelectorAll('.quest-ingredient').forEach(btn => {
      // accessibilité
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });

      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if(!id) return;

        // déjà dans le sac ou déjà utilisé ?
        const inBag = state.bag.some(e => getId(e) === id);
        if (state.used.includes(id) || inBag){
          toast(CONFIG.messages.already);
          return;
        }
        if (state.bag.length >= CONFIG.bagMax){
          toast(CONFIG.messages.bagFull);
          return;
        }

        // ajout comme entrée {id, used:false}
        state.bag.push(toEntry(id));
        saveState(); renderBag();
        toast(CONFIG.messages.added);
      });
    });
  }

  // ====== HELPERS ======
  function getMeta(id){
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

  // nouvelles petites aides
  function getId(entry){ return (typeof entry === 'string') ? entry : entry.id }
  function isUsed(entry){ return (typeof entry === 'object') && entry.used === true }
  function toEntry(id){ return { id, used:false } }

  function loadState(){
    const raw = localStorage.getItem(CONFIG.key);
    const def = { energy: CONFIG.max, bag: [], used: [], infinite: false, msgShown: false };
    if (!raw) return def;
    try {
      const s = JSON.parse(raw);
      // migrations + défauts
      if (!Array.isArray(s.bag)) s.bag = [];
      // convertir anciennes entrées "string" en objets {id, used:false}
      s.bag = s.bag.map(e => (typeof e === 'string') ? toEntry(e) : e);
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
    add: (id)=>{
      const exists = state.bag.some(e => getId(e) === id);
      if(state.bag.length<CONFIG.bagMax && !state.used.includes(id) && !exists){
        state.bag.push(toEntry(id)); saveState(); renderAll();
      }
    },
    use: (id)=>{ const i = state.bag.findIndex(e => getId(e) === id); if(i>=0) useItemAt(i); },
    reset: ()=>{ state = { energy: CONFIG.max, bag: [], used: [], infinite: false, msgShown:false }; saveState(); renderAll(); start(); }
  };
})();
