;(function(){
  const CONFIG = {
    key: 'arz_energy_v1',
    max: 100,
    drainPerSecond: 0.1,
    tickMs: 1000,
    rechargeOnCollect: 40,
    minBeforeSpawn: 800,
    requireVisibleTab: true
  };

  const elFill = document.getElementById('energyFill');
  const elPct  = document.getElementById('energyPct');
  const overlay= document.getElementById('lockOverlay');
  const play   = document.getElementById('playArea');
  const ingr   = document.getElementById('ingredient');
  const btnSpawn = document.getElementById('spawnBtn');
  const btnAccess= document.getElementById('accessBtn');

  let state = load();
  let ticking = false;
  let intervalId = null;

  function load(){
    const raw = localStorage.getItem(CONFIG.key);
    const def = { energy: CONFIG.max };
    try { return raw ? JSON.parse(raw) : def } catch { return def }
  }
  function save(){ localStorage.setItem(CONFIG.key, JSON.stringify(state)) }

  function clamp(n,min,max){ return Math.max(min, Math.min(max, n)) }

  function render(){
    const pct = clamp((state.energy/CONFIG.max)*100,0,100);
    elFill.style.width = pct + '%';
    elPct.textContent  = Math.round(pct) + '%';
    if(state.energy <= 0){ lock() } else { unlock() }
  }

  function tick(){
    if(CONFIG.requireVisibleTab && document.hidden) return;
    state.energy = clamp(state.energy - CONFIG.drainPerSecond, 0, CONFIG.max);
    render();
    save();
  }

  function start(){ if(intervalId) return; intervalId = setInterval(tick, CONFIG.tickMs); ticking = true }
  function stop(){ if(intervalId){ clearInterval(intervalId); intervalId=null; } ticking = false }

  function lock(){ overlay.style.display = 'grid'; stop() }
  function unlock(){ overlay.style.display = 'none'; if(!ticking) start() }

  function spawnIngredient(){
    ingr.style.display = 'block';
    const rect = play.getBoundingClientRect();
    const padX = 40, padY = 40;
    const x = Math.random() * (rect.width - padX*2) + padX;
    const y = Math.random() * (rect.height - padY*2) + padY;
    ingr.style.left = x + 'px';
    ingr.style.top  = y + 'px';
    clearTimeout(ingr._t);
    ingr._t = setTimeout(()=>{ ingr.style.display='none' }, 3000);
  }

  function collect(){
    ingr.style.display = 'none';
    state.energy = clamp(state.energy + CONFIG.rechargeOnCollect, 0, CONFIG.max);
    save();
    render();
  }

  function accessibleRecharge(){
    state.energy = clamp(state.energy + CONFIG.rechargeOnCollect, 0, CONFIG.max);
    save();
    render();
  }

  ingr.addEventListener('click', collect);
  btnSpawn.addEventListener('click', spawnIngredient);
  btnAccess.addEventListener('click', accessibleRecharge);

  document.addEventListener('visibilitychange', ()=>{
    if(!document.hidden && state.energy > 0) start();
  });

  window.addEventListener('beforeunload', save);

  window.EnergyGauge = {
    setEnergy(v){ state.energy = clamp(v,0,CONFIG.max); save(); render() },
    recharge(v=CONFIG.rechargeOnCollect){ state.energy = clamp(state.energy + v,0,CONFIG.max); save(); render() },
    reset(){ state.energy = CONFIG.max; save(); render() },
    get(){ return { ...state } },
    lock, unlock
  };

  render();
  if(state.energy > 0) start(); else lock();
})();

