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

  // Détecte si la page actuelle est "drainante" (monde / extrait / entrée / artistes…)
  const isDrainPage = (() => {
    const p = location.pathname;
    const inWorldsIndex = /\/3\.les_mondes\.html$/i.test(p) || p.endsWith('/3.les_mondes.html');
    const inMonde       = /\/monde\//i.test(p);
    const inExtraits    = /\/extraits?\//i.test(p);
    const inEntree      = /\/entree\/entree_[a-z0-9_-]+\.html$/i.test(p);
    const inArtFolder   = /\/artiste\//i.test(p);
    const inArtFiles    = /\/(5\.chanson_de_camidjo|5\.louboutartgif|5\.loup_bout_art)\.html$/i.test(p);
    return inWorldsIndex || inMonde || inExtraits || inEntree || inArtFolder || inArtFiles;
  })();

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

  function tick(){
    if (document.hidden) return;

    if (S.mode === 'experimente'){
      S.energy = CFG.max;
      pushEnergy();
      return;
    }

    if (isDrainPage){
      S.energy = clamp(S.energy - CFG.drainPerSecond, 0, CFG.max);
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
