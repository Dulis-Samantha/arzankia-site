;(() => {
  // Évite double chargement
  if (window.ArzCore) return;

  /* =========================
   * CONFIG (ne dépend PAS de l'UI)
   * ========================= */
  const BASE = (location.pathname.includes('/monde/') ||
                location.pathname.includes('/extraits/') ||
                location.pathname.includes('/entree/')) ? '../' : '';

  const CFG = {
    storageKey: 'arz_energy_v2',
    max: 100,
    tickMs: 1000,
    drainPerSecond: 0.10,     // ↓ en pages "monde"
    rechargePerSecond: 0.10,  // ↑ hors "monde"
    questThresholdPct: 15,    // utile pour un éventuel ruban côté UI
    zeroRedirectUrl: BASE + '2.les_coulisses.html',
    autoRedirectOnZero: true  // si true : redirige quand énergie = 0 (sur pages drain)
  };

  // --- Pages où la jauge se décharge ---
const isDrainPage = (() => {
  const p = location.pathname.toLowerCase();
  return (
    p.includes('3.les_mondes.html') ||
    p.includes('/monde/') ||
    p.includes('/extrait/') ||
    p.includes('/chanson_de_camidjo/') ||
    p.includes('/louboutartgif/') ||
    p.includes('/loup_bout_art/') ||
    p.includes('/entree/')
  );
})();

  // --- Pages où la jauge se décharge ---
const isDrainPage = (() => {
  const p = location.pathname.toLowerCase();
  return (
    p.includes('3.les_mondes.html') ||
    p.includes('/monde/') ||
    p.includes('/extrait/') ||
    p.includes('/chanson_de_camidjo/') ||
    p.includes('/louboutartgif/') ||
    p.includes('/loup_bout_art/') ||
    p.includes('/entree/')
  );
})();

// --- Modificateur de décharge lié aux quêtes ---
function _meta(){ try{ return JSON.parse(localStorage.getItem('arz_meta_v1'))||{} }catch{ return {} } }
function getDrainMultiplierFromQuests(){
  const m = _meta();
  if (m.specFinal) return 0;          // énergie infinie à la fin
  const q = m.questsCompleted||0;
  if(q>=10) return 0.45;
  if(q>=6)  return 0.60;
  if(q>=3)  return 0.75;              // après 3 quêtes : test débloqué
  if(q>=1)  return 0.90;
  return 1.00;
}
let DRAIN_MULT = getDrainMultiplierFromQuests();

// Récompense (appelée par quete.js à la fin d’une quête)
document.addEventListener('arz:reward', ()=>{
  DRAIN_MULT = getDrainMultiplierFromQuests();
  S.energy = CFG.max;            // recharge totale
  saveState && saveState();
  renderGauge && renderGauge();
});

// Spécialisation finale → énergie infinie
document.addEventListener('arz:spec-final', ()=>{
  DRAIN_MULT = 0;
  S.mode = 'experimente';        // si déjà géré chez toi
  S.energy = CFG.max;
  saveState && saveState();
  renderGauge && renderGauge();
});

  
  /* =========================
   * STATE + STORAGE
   * ========================= */
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  function loadState(){
    const def = {
      energy: CFG.max,
      bag: [],           // [{id, qty}]
      usesTotal: 0,
      mode: 'novice',    // 'novice' | 'experimente'
      infinite: false    // compat rétro
    };
    try{
      const raw = localStorage.getItem(CFG.storageKey);
      if (!raw) return def;
      const s = JSON.parse(raw);
      // gardes
      if (typeof s.energy !== 'number') s.energy = CFG.max;
      if (!Array.isArray(s.bag)) s.bag = [];
      if (typeof s.usesTotal !== 'number') s.usesTotal = 0;
      if (!s.mode) s.mode = 'novice';
      s.bag.forEach(e => { e.qty = clamp(e.qty||0, 0, 1); });
      return s;
    } catch { return def; }
  }

  function saveState(){
    localStorage.setItem(CFG.storageKey, JSON.stringify(S));
  }

  let S = loadState();
  let timer = null;
  let lockedZero = false;

  /* =========================
   * LOOP (indépendant de l’UI)
   * ========================= */
  function startIfNeeded(){
    stop(); // anti-doublons

    if (S.mode === 'experimente'){
      // énergie éternelle (pas de timer)
      S.energy = CFG.max;
      saveState();
      emit('arz:energy', { pct: 100, energy: S.energy });
      emit('arz:modechange', { mode: S.mode });
      return;
    }

    start(); // novice → toujours lancer le timer
  }

  function start(){
    if (timer) return;
    timer = setInterval(tick, CFG.tickMs);
    emit('arz:start', {});
  }

  function stop(){
    if (!timer) return;
    clearInterval(timer);
    timer = null;
    emit('arz:stop', {});
  }

 function tick() {
  if (document.hidden) return;

  // --- Mode expérience (énergie infinie)
  if (S.mode === 'experimente') {
    S.energy = CFG.max;
    pushEnergy();
    return;
  }

  // --- Décharge seulement sur les pages concernées
  if (isDrainPage) {
    // Ici, on applique le multiplicateur selon la progression des quêtes
    S.energy = Math.max(0, S.energy - (CFG.drainPerTick * DRAIN_MULT));
  }

  // --- Mise à jour de l'affichage et sauvegarde
  renderGauge && renderGauge();
  saveState && saveState();
}


      if (S.energy <= 0){
        pushEnergy();
        if (!lockedZero){
          lockedZero = true;
          emit('arz:zero', { redirect: CFG.autoRedirectOnZero, to: CFG.zeroRedirectUrl });
          if (CFG.autoRedirectOnZero){
            // redirection douce (pas d’overlay côté core)
            setTimeout(() => { location.href = CFG.zeroRedirectUrl; }, 3000);
          }
        }
        saveState();
        return;
      }
    } else {
      // recharge hors monde
      S.energy = clamp(S.energy + CFG.rechargePerSecond, 0, CFG.max);
    }

    pushEnergy();
  }

  function pushEnergy(){
    saveState();
    const pct = Math.round((S.energy / CFG.max) * 100);
    emit('arz:energy', { pct, energy: S.energy, isDrainPage, mode: S.mode });
  }

  /* =========================
   * BAG (logique minimale, sans UI)
   * ========================= */
  function addItem(id){
    // 1 seul exemplaire par item (cohérent avec perItemMax=1)
    let entry = S.bag.find(e => e.id === id);
    if (entry){
      if (entry.qty >= 1) {
        emit('arz:bag:perItemMax', { id });
        return false;
      }
      entry.qty++;
    } else {
      S.bag.push({ id, qty: 1 });
    }
    saveState();
    emit('arz:bagchange', { bag: clone(S.bag) });
    return true;
  }

  function useItemById(id){
    const idx = S.bag.findIndex(e => e.id === id && e.qty > 0);
    if (idx === -1) return false;
    return useItemByIndex(idx);
  }

  function useItemByIndex(index){
    const entry = S.bag[index];
    if (!entry || entry.qty <= 0) return false;

    entry.qty--;
    if (entry.qty === 0) S.bag.splice(index, 1);

    // Effet par défaut : recharge totale
    S.energy = CFG.max;
    S.usesTotal++;

    saveState();
    emit('arz:item:used', { bag: clone(S.bag) });
    pushEnergy();
    return true;
  }

  function totalItems(){
    return S.bag.reduce((n,e)=>n+e.qty,0);
  }

  /* =========================
   * MODE / API PUBLIQUE
   * ========================= */
  function setMode(mode){
    if (mode !== 'novice' && mode !== 'experimente') return;
    S.mode = mode;
    saveState();
    emit('arz:modechange', { mode });
    startIfNeeded();
  }

  function resetAll(){
    S = { energy: CFG.max, bag: [], usesTotal: 0, mode: 'novice', infinite: false };
    lockedZero = false;
    saveState();
    emit('arz:reset', {});
    startIfNeeded();
    pushEnergy();
  }

  function setEnergy(v){
    S.energy = clamp(v, 0, CFG.max);
    lockedZero = (S.energy <= 0);
    saveState();
    pushEnergy();
  }

  function get(){
    return {
      ...S,
      isDrainPage,
      totalItems: totalItems(),
      cfg: { ...CFG }
    };
  }

  /* =========================
   * EVENTS / LIFECYCLE
   * ========================= */
  function emit(name, detail){
    document.dispatchEvent(new CustomEvent(name, { detail }));
  }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startIfNeeded();
  });
  window.addEventListener('beforeunload', saveState);

  // Boot
  startIfNeeded();
  pushEnergy();

  // Expose l’API
  window.ArzCore = true;
  window.Arz = {
    // lecture/écriture
    get, setEnergy, resetAll, setMode,
    // boucle
    start: startIfNeeded, stop,
    // bag
    addItem, useItemById, useItemByIndex, totalItems,
    // utilitaires
    isDrainPage: () => isDrainPage
  };
})();
