;(function(){
  // ===== CONFIG =====
  const CONFIG = {
    key: 'arz_energy_v1',
    max: 100,

    // drain par défaut (points / seconde)
    drainPerSecond: 0.10,
    tickMs: 1000,

    questThresholdPct: 15,
    zeroRedirectUrl: '2.les_coulisses.html',

    // inventaire
    bagMax: 10,          // taille totale du sac
    perItemMax: 2,       // exemplaires max par ingrédient
    bagIconSrc: 'sac_magique.webp',

    // nombre d'utilisations pour passer en "infini"
    infiniteAfterUses: 10,  // <<< tu peux mettre 10, 12, etc.

    // Effets par ingrédient : facteur appliqué au drain courant quand on l’utilise
    // (ex: 0.9 = 10% plus lent ; 1.0 = inchangé ; 0.8 = 20% plus lent)
    effects: {
      ptikitis_rubictus: { drainFactor: 0.90 },
      foret_champignon : { drainFactor: 0.92 },
      ames_plante      : { drainFactor: 0.88 },
      reserve_ptikitis : { drainFactor: 0.94 },
      eau_creature     : { drainFactor: 0.90 },
    },

    // Noms / images par défaut (si data-… non fournis dans le HTML)
    items: {
      'ptikitis_rubictus': { name: 'Rubictus aux baies rouges', img: 'ing_ptikitis.webp' },
      'foret_champignon' : { name: 'Champignon bleu',          img: 'ing_foret.webp' },
      'ames_plante'      : { name: 'Olivette Brumis',          img: 'ing_ames.webp' },
      'reserve_ptikitis' : { name: 'Pousse rare (Réserve)',     img: 'ing_reserve_ptikitis.webp' },
      'eau_creature'     : { name: 'Essence des créatures de l’eau', img: 'ing_creature.webp' },
    },

    messages: {
      low: "Ton Arzanskân faiblit… utilise un ingrédient ou trouve-en un nouveau.",
      bagFull: "Ton sac est plein. Utilise d’abord un ingrédient.",
      perItemMax: "Tu possèdes déjà la quantité maximale de cet ingrédient.",
      added: "Ingrédient ajouté au sac.",
      already: "Cet ingrédient est déjà dans le sac ou a été utilisé.",
      infinite: "Bravo ! Ton corps s’est accordé à la magie des mondes.\nTu n’as plus besoin de recharger ton Arzanskân.",
      reset: "Tous les ingrédients ont été réinitialisés.",
      calm_on: "Mode tranquille activé (pas de décharge).",
      calm_off:"Mode tranquille désactivé."
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
      <button class="bag-reset" id="bagReset">🔄 Réinitialiser les ingrédients</button>
      <button class="bag-toggle" id="bagToggle"></button>
    </div>
  `;
  document.body.appendChild(bagWrap);

  const bagIcon  = bagWrap.querySelector('#bagIcon');
  const bagMenu  = bagWrap.querySelector('#bagMenu');
  const bagList  = bagWrap.querySelector('#bagList');
  const bagBadge = bagWrap.querySelector('#bagBadge');
  const bagEmpty = bagWrap.querySelector('#bagEmpty');
  const bagReset = bagWrap.querySelector('#bagReset');
  const bagToggle= bagWrap.querySelector('#bagToggle');

  // ouvrir/fermer le sac
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

  // reset inventaire
  bagReset.addEventListener('click', () => {
    if (confirm("Souhaites-tu vraiment réinitialiser tous les ingrédients ?")) {
      state.bag = [];
      state.totalUses = 0;
      state.infinite = false;
      state.msgShown = false;
      saveState(); renderAll();
      toast(CONFIG.messages.reset);
    }
  });

  // toggle mode tranquille
  updateToggleLabel();
  bagToggle.addEventListener('click', () => {
    state.noPressure = !state.noPressure;
    if (state.noPressure){
      stop(); state.energy = CONFIG.max;
      toast(CONFIG.messages.calm_on);
    } else {
      if (!state.infinite && state.energy > 0) start();
      toast(CONFIG.messages.calm_off);
    }
    saveState(); renderAll(); updateToggleLabel();
  });

  // ===== INIT listeners: collecte d’ingrédients =====
  initCollectibles();

  // ====== BOOT ======
  renderAll();
  if (!state.noPressure && !state.infinite){
    if (state.energy > 0) start();
    else redirectZero();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (state.noPressure || state.infinite) return;
    if (state.energy > 0 && !intervalId) start();
  });

  window.addEventListener('beforeunload', saveState);

  // ====== LOOP / RENDER ======
  function start(){ if(!intervalId) intervalId = setInterval(tick, CONFIG.tickMs); }
  function stop(){ if(intervalId){ clearInterval(intervalId); intervalId=null; } }

  function tick(){
    if (state.noPressure || state.infinite) { stop(); return; }
    if (document.hidden) return;
    state.energy = clamp(state.energy - state.drain, 0, CONFIG.max);
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
    ribbon.style.display =
      (!state.noPressure && !state.infinite && pct <= CONFIG.questThresholdPct)
      ? 'block' : 'none';
  }

  function updateInfiniteUI(){
    document.body.classList.toggle('arz-infinite', !!state.infinite);
    document.body.classList.toggle('arz-no-pressure', !!state.noPressure);
  }

  function redirectZero(){ window.location.href = CONFIG.zeroRedirectUrl; }

  function updateToggleLabel(){
    bagToggle.textContent = state.noPressure
      ? '▶️ Réactiver la jauge'
      : '🕊️ Mode tranquille (désactiver la jauge)';
  }

  // ====== SAC ======
  function renderBag(){
    // badge
    bagBadge.textContent = String(totalQty(state.bag));
    bagBadge.style.display = 'block';

    // liste
    bagList.innerHTML = '';
    if(state.bag.length === 0){
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    state.bag.forEach((entry, idx) => {
      const { id, qty, used } = entry;
      const meta = getMeta(id);
      const remaining = Math.max(qty - used, 0);

      const li = document.createElement('li');
      li.innerHTML = `
        <div class="bag-item">
          <img src="${meta.img}" alt="">
          <div class="bag-label">
            <div class="bag-name">${meta.name} <span class="bag-qty">×${qty}</span></div>
            ${remaining>0 ? `<div class="bag-rem">restant : ${remaining}</div>` : ''}
          </div>
        </div>
        ${
          remaining>0
            ? `<button type="button" class="bag-use" data-index="${idx}">Utiliser</button>`
            : `<div class="bag-used" aria-label="Ingrédient épuisé">✓ Utilisé</div>`
        }
      `;
      bagList.appendChild(li);
    });

    // actions
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
    if (entry.used >= entry.qty) return; // déjà épuisé

    // 1) appliquer l’effet de l’ingrédient (vitesse)
    applyEffect(entry.id);

    // 2) consommer une unité
    entry.used += 1;

    // 3) recharge à 100 %
    state.energy = CONFIG.max;

    // 4) progression vers "infini"
    state.totalUses += 1;
    if (state.totalUses >= CONFIG.infiniteAfterUses && !state.infinite){
      state.infinite = true;
      if (!state.msgShown){
        state.msgShown = true;
        toast(CONFIG.messages.infinite, 4500);
      }
      stop();
    }

    saveState(); renderAll();
  }

  // ====== COLLECTIBLES ======
  function initCollectibles(){
    document.querySelectorAll('.quest-ingredient').forEach(btn => {
      // a11y
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });

      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if(!id) return;

        // déjà dans le sac ? incrémente jusqu'au perItemMax
        const found = state.bag.find(e => e.id === id);
        if (found){
          if (found.qty >= CONFIG.perItemMax){ toast(CONFIG.messages.perItemMax); return; }
          found.qty += 1;
          saveState(); renderBag(); toast(CONFIG.messages.added); return;
        }

        // sac plein ?
        if (state.bag.length >= CONFIG.bagMax){ toast(CONFIG.messages.bagFull); return; }

        // nouvelle entrée
        state.bag.push({ id, qty:1, used:0 });
        saveState(); renderBag(); toast(CONFIG.messages.added);
      });
    });
  }

  // ====== HELPERS ======
  function applyEffect(id){
    const eff = CONFIG.effects[id];
    if (!eff || !eff.drainFactor) return;
    // on multiplie le drain courant par le facteur, en bornant pour éviter des valeurs trop faibles
    state.drain = clamp(state.drain * eff.drainFactor, 0.02, 1.0);
  }

  function totalQty(arr){ return arr.reduce((s, e)=> s + (e.qty||0), 0); }

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

  function loadState(){
    const raw = localStorage.getItem(CONFIG.key);
    const def = {
      energy: CONFIG.max,
      bag: [],                  // [{id, qty, used}]
      totalUses: 0,             // utilisations cumulées pour l’infini
      drain: CONFIG.drainPerSecond,
      infinite: false,
      msgShown: false,
      noPressure: false
    };
    if (!raw) return def;
    try {
      const s = JSON.parse(raw);

      // migrations
      if (!Array.isArray(s.bag)) s.bag = [];
      // anciennes versions : string ou objet {id, used:true/false}
      s.bag = s.bag.map(e => {
        if (typeof e === 'string') return { id:e, qty:1, used:0 };
        if (typeof e === 'object' && !('qty' in e)) return { id:e.id, qty:1, used:(e.used?1:0) };
        return e;
      });

      if (typeof s.totalUses !== 'number') s.totalUses = 0;
      if (typeof s.drain !== 'number') s.drain = CONFIG.drainPerSecond;
      if (typeof s.infinite !== 'boolean') s.infinite = false;
      if (typeof s.msgShown !== 'boolean') s.msgShown = false;
      if (typeof s.noPressure !== 'boolean') s.noPressure = false;
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

  // API debug
  window.Arz = {
    get: () => ({...state}),
    setEnergy: (v)=>{ state.energy = clamp(v,0,CONFIG.max); saveState(); renderAll(); },
    add: (id)=>{ const f=state.bag.find(e=>e.id===id); if(f){ if(f.qty<CONFIG.perItemMax){f.qty++;} } else { state.bag.push({id,qty:1,used:0}); } saveState(); renderAll(); },
    use: (id)=>{ const i=state.bag.findIndex(e=>e.id===id); if(i>=0) useItemAt(i); },
    reset: ()=>{ state = { energy: CONFIG.max, bag: [], totalUses:0, drain: CONFIG.drainPerSecond, infinite:false, msgShown:false, noPressure:false }; saveState(); renderAll(); start(); },
    calm: (on)=>{ state.noPressure=!!on; saveState(); renderAll(); }
  };
})();
