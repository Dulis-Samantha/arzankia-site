/* ===== Monde commun (inventaire + jauge + sac) ===== */
(function () {
  // ---- CONFIG ----
  const IMG_BASE = '../images/';
  const CONFIG = {
    key: 'arz_energy_v1',
    max: 100,
    drainPerSecond: 0.10,    // points/s
    tickMs: 1000,
    questThresholdPct: 15,
    zeroRedirectUrl: '2.les_coulisses.html',

    // inventaire
    bagMax: 10,
    perItemMax: 2,
    infiniteAfterUses: 10,

    effects: {
      ptikitis_rubictus: { drainFactor: 0.90 },
      foret_champignon : { drainFactor: 0.92 },
      ames_plante      : { drainFactor: 0.88 },
      reserve_ptikitis : { drainFactor: 0.94 },
      eau_creature     : { drainFactor: 0.90 },
    },

    items: {
      ptikitis_rubictus: { name: 'Rubictus aux baies rouges', img: IMG_BASE + 'bouton/ing_ptikitis.webp' },
      foret_champignon : { name: 'Champignon bleu',          img: IMG_BASE + 'bouton/ing_foret.webp' },
      ames_plante      : { name: 'Olivette Brumis',          img: IMG_BASE + 'bouton/ing_ames.webp' },
      reserve_ptikitis : { name: 'Pousse rare (Réserve)',    img: IMG_BASE + 'bouton/ing_reserve_ptikitis.webp' },
      eau_creature     : { name: 'Essence des créatures de l’eau', img: IMG_BASE + 'bouton/ing_creature.webp' },
    },

    messages: {
      low: "Ton Arzanskân faiblit… utilise un ingrédient ou trouve-en un nouveau.",
      bagFull: "Ton sac est plein. Utilise d’abord un ingrédient.",
      perItemMax: "Tu possèdes déjà la quantité maximale de cet ingrédient.",
      added: "Ingrédient ajouté au sac.",
      infinite: "Bravo ! Tu es accordée à la magie des mondes : jauge infinie ✨",
      reset: "Tous les ingrédients ont été réinitialisés.",
      calm_on: "Mode tranquille activé (pas de décharge).",
      calm_off:"Mode tranquille désactivé.",
    }
  };

  // ---- STATE ----
  let state = loadState();
  let intervalId = null;

  // ---- DOM : jauge + sac existants dans le HUD ----
  const fill = document.querySelector('.fill');
  const pctTxt = document.querySelector('.percent');   // correspond à <span class="percent">
  const sacBtn  = document.getElementById('sacToggle') // ou: document.querySelector('.sac-box')


  // Ruban alerte (≤15 %)
  const ribbon = document.createElement('div');
  ribbon.className = 'quest-ribbon';
  ribbon.style.display = 'none';
  ribbon.textContent = CONFIG.messages.low;
  document.body.appendChild(ribbon);

  // Panneau du sac (créé dynamiquement)
  const panel = document.createElement('div');
  panel.id = 'sacPanel';
  panel.className = 'sac-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'sacTitle');
  panel.innerHTML = `
    <div class="sac-head">
      <strong id="sacTitle">Inventaire</strong>
      <button class="sac-close" aria-label="Fermer">×</button>
    </div>
    <div class="sac-body">
      <div class="bag-top">
        <button class="btn-mini" id="bagToggle"></button>
        <button class="btn-mini ghost" id="bagReset">Réinitialiser</button>
      </div>
      <ul id="bagList"></ul>
      <div class="bag-empty" id="bagEmpty">Ton sac est vide…</div>
    </div>
  `;
  document.body.appendChild(panel);

  const closeBtn = panel.querySelector('.sac-close');
  const bagToggle = panel.querySelector('#bagToggle');
  const bagReset  = panel.querySelector('#bagReset');
  const bagList   = panel.querySelector('#bagList');
  const bagEmpty  = panel.querySelector('#bagEmpty');

  // ---- INIT ----
  renderAll();
  if (!state.noPressure && !state.infinite) {
    if (state.energy > 0) start(); else redirectZero();
  }

  // Arrondi + affichage initial de la jauge
  function renderGauge() {
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    if (fill) fill.style.width = pct + '%';
    if (pctTxt) pctTxt.textContent = Math.round(pct) + '%';
    updateRibbon();
  }

  function updateRibbon() {
    const pct = clamp((state.energy / CONFIG.max) * 100, 0, 100);
    ribbon.style.display =
      (!state.noPressure && !state.infinite && pct <= CONFIG.questThresholdPct) ? 'block' : 'none';
  }

  function updateToggleLabel() {
    bagToggle.textContent = state.noPressure
      ? '▶️ Réactiver la jauge'
      : '🕊️ Mode tranquille (désactiver la jauge)';
  }

  function renderBag() {
    bagList.innerHTML = '';
    if (!state.bag.length) {
      bagEmpty.style.display = 'block';
      return;
    }
    bagEmpty.style.display = 'none';

    state.bag.forEach((entry, idx) => {
      const { id, qty, used } = entry;
      const meta = getMeta(id);
      const remaining = Math.max(qty - used, 0);

      const li = document.createElement('li');
      li.className = 'bag-li';
      li.innerHTML = `
        <div class="bag-item">
          ${meta.img ? `<img src="${meta.img}" alt="">` : ''}
          <div class="bag-label">
            <div class="bag-name">${meta.name} <span class="bag-qty">×${qty}</span></div>
            ${remaining>0 ? `<div class="bag-rem">restant : ${remaining}</div>` : `<div class="bag-used">épuisé</div>`}
          </div>
        </div>
        ${remaining>0 ? `<button type="button" class="bag-use" data-index="${idx}">Utiliser</button>` : ''}
      `;
      bagList.appendChild(li);
    });

    bagList.querySelectorAll('.bag-use').forEach(btn => {
      btn.addEventListener('click', () => {
        const index = Number(btn.getAttribute('data-index'));
        useItemAt(index);
      });
    });
  }

  function renderAll() {
    renderGauge();
    renderBag();
    document.body.classList.toggle('arz-infinite', !!state.infinite);
    document.body.classList.toggle('arz-no-pressure', !!state.noPressure);
    updateToggleLabel();
  }

  // ---- TICK ----
  let pageHidden = document.hidden;
  document.addEventListener('visibilitychange', () => { pageHidden = document.hidden; });

  function start(){ if (!intervalId) intervalId = setInterval(tick, CONFIG.tickMs); }
  function stop(){ if (intervalId) { clearInterval(intervalId); intervalId = null; } }

  function tick() {
    if (state.noPressure || state.infinite) { stop(); return; }
    if (pageHidden) return;

    state.energy = clamp(state.energy - state.drain, 0, CONFIG.max);
    if (state.energy <= 0) { saveState(); redirectZero(); return; }
    renderGauge(); saveState();
  }

  // ---- SAC : ouverture/fermeture ----
  if (sacBtn) {
    sacBtn.addEventListener('click', () => {
      const open = panel.getAttribute('data-open') === 'true';
      panel.setAttribute('data-open', open ? 'false' : 'true');
    });
  }
  closeBtn.addEventListener('click', () => panel.setAttribute('data-open','false'));
  document.addEventListener('click', (e) => {
    const clickedSac = sacBtn && sacBtn.contains(e.target);
    const clickedPanel = panel.contains(e.target);
    if (!clickedSac && !clickedPanel) panel.setAttribute('data-open','false');
  });

  // ---- Sac : actions ----
  bagReset.addEventListener('click', () => {
    if (!confirm('Réinitialiser tous les ingrédients ?')) return;
    state.bag = [];
    state.totalUses = 0;
    state.infinite = false;
    state.msgShown = false;
    state.drain = CONFIG.drainPerSecond;
    saveState(); renderAll();
    toast(CONFIG.messages.reset);
  });

  bagToggle.addEventListener('click', () => {
    state.noPressure = !state.noPressure;
    if (state.noPressure) {
      stop(); state.energy = CONFIG.max; toast(CONFIG.messages.calm_on);
    } else {
      if (!state.infinite && state.energy > 0) start();
      toast(CONFIG.messages.calm_off);
    }
    saveState(); renderAll();
  });

  // ---- Collecte d’ingrédients (boutons sur la page) ----
  initCollectibles();
  function initCollectibles(){
    document.querySelectorAll('.quest-ingredient').forEach(btn => {
      if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
      if (!btn.hasAttribute('role')) btn.setAttribute('role', 'button');
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); btn.click(); }
      });

      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (!id) return;

        const found = state.bag.find(e => e.id === id);
        if (found) {
          if (found.qty >= CONFIG.perItemMax) { toast(CONFIG.messages.perItemMax); return; }
          found.qty += 1;
          saveState(); renderBag(); toast(CONFIG.messages.added); return;
        }

        if (state.bag.length >= CONFIG.bagMax) { toast(CONFIG.messages.bagFull); return; }

        // nom/img surchargés éventuels depuis le HTML
        const name = btn.getAttribute('data-name');
        const img  = btn.getAttribute('data-img');
        if (name || img) CONFIG.items[id] = {
          name: name || (CONFIG.items[id]?.name || id),
          img : img  || (CONFIG.items[id]?.img  || '')
        };

        state.bag.push({ id, qty:1, used:0 });
        saveState(); renderBag(); toast(CONFIG.messages.added);
      });
    });
  }

  // ---- Utiliser un ingrédient ----
  function useItemAt(index){
    if (index < 0 || index >= state.bag.length) return;
    const entry = state.bag[index];
    if (entry.used >= entry.qty) return;

    applyEffect(entry.id);           // ralentit le drain
    entry.used += 1;                 // consomme 1
    state.energy = CONFIG.max;       // recharge

    state.totalUses += 1;            // progression infini
    if (state.totalUses >= CONFIG.infiniteAfterUses && !state.infinite){
      state.infinite = true;
      if (!state.msgShown){ state.msgShown = true; toast(CONFIG.messages.infinite, 4000); }
      stop();
    }

    saveState(); renderAll();
  }

  // ---- Utils ----
  function applyEffect(id){
    const eff = CONFIG.effects[id];
    if (!eff || !eff.drainFactor) return;
    state.drain = clamp(state.drain * eff.drainFactor, 0.02, 1.0);
  }
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function loadState(){
    const raw = localStorage.getItem(CONFIG.key);
    const def = {
      energy: CONFIG.max,
      bag: [],                  // [{id, qty, used}]
      totalUses: 0,
      drain: CONFIG.drainPerSecond,
      infinite: false,
      msgShown: false,
      noPressure: false
    };
    if (!raw) return def;
    try {
      const s = JSON.parse(raw);
      if (!Array.isArray(s.bag)) s.bag = [];
      s.bag = s.bag.map(e => {
        if (typeof e === 'string') return { id: e, qty: 1, used: 0 };
        if (typeof e === 'object' && !('qty' in e)) return { id: e.id, qty: 1, used: (e.used?1:0) };
        return e;
      });
      if (typeof s.totalUses !== 'number') s.totalUses = 0;
      if (typeof s.drain !== 'number') s.drain = CONFIG.drainPerSecond;
      if (typeof s.infinite !== 'boolean') s.infinite = false;
      if (typeof s.msgShown !== 'boolean') s.msgShown = false;
      if (typeof s.noPressure !== 'boolean') s.noPressure = false;
      if (typeof s.energy !== 'number') s.energy = CONFIG.max;
      return s;
    } catch { return def; }
  }
  function saveState(){ localStorage.setItem(CONFIG.key, JSON.stringify(state)); }

  function toast(text, ms=1800){
    const t = document.createElement('div');
    t.className = 'arz-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(()=> t.classList.add('show'));
    setTimeout(()=> { t.classList.remove('show'); setTimeout(()=> t.remove(), 250); }, ms);
  }

  // API debug pratique
  window.Arz = {
    get: ()=> ({...state}),
    setEnergy: (v)=>{ state.energy = clamp(v,0,CONFIG.max); saveState(); renderAll(); },
    add: (id)=>{ const f=state.bag.find(e=>e.id===id); if(f){ if(f.qty<CONFIG.perItemMax){f.qty++;} } else { state.bag.push({id,qty:1,used:0}); } saveState(); renderAll(); },
    use: (id)=>{ const i=state.bag.findIndex(e=>e.id===id); if(i>=0) useItemAt(i); },
    reset: ()=>{ state = { energy: CONFIG.max, bag: [], totalUses:0, drain: CONFIG.drainPerSecond, infinite:false, msgShown:false, noPressure:false }; saveState(); renderAll(); start(); },
    calm: (on)=>{ state.noPressure=!!on; saveState(); renderAll(); }
  };
})();
