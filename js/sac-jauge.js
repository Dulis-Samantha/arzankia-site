/* ============================================================
   ARZANKIA — UI Jauge + Sac (léger, sans stockage parallèle)
   Dépend d'ARZ CORE (window.Arz)
   - Jauge (#energyFill / #energyPct)
   - Sac (.bag-menu > .bag-list) + bouton .bag-toggle (si présent)
   - Consommables : effets partiels depuis ARZ_ITEMS
   ============================================================ */
(() => {
  if (window.ArzUI) return;
  window.ArzUI = true;

  // ---------- Helpers ----------
  const d = document;
  const $  = (sel, root=d) => root.querySelector(sel);
  const $$ = (sel, root=d) => [...root.querySelectorAll(sel)];

  function toast(msg, ms=1200){
    const el = d.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position:'fixed', left:'50%', bottom:'8%', transform:'translateX(-50%)',
      padding:'8px 14px', background:'rgba(0,0,0,.65)', color:'#fff',
      borderRadius:'12px', zIndex:9999, font:'14px/1.2 system-ui',
      backdropFilter:'blur(3px)'
    });
    d.body.appendChild(el);
    setTimeout(()=>el.remove(), ms);
  }

  // ---------- REGISTRE D’OBJETS ----------
  const ARZ_ITEMS = {
    // CONSOMMABLES
    'ptikitis_rubictus': { name:'Rubictus aux baies rouges', img:'../images/bouton/ing_ptikitis.webp', kind:'consumable', stack:true,  effect:{type:'recharge', value:'50%'} },
    'reserve_ptikitis' : { name:'Pousse rare (Réserve)',     img:'../images/bouton/ing_reserve_ptikitis.webp', kind:'consumable', stack:true,  effect:{type:'recharge', value:'100%'} },
    'eau_thermale'     : { name:'Eau thermale',              img:'../images/bouton/ing_eau_thermale.webp', kind:'consumable', stack:true,  effect:{type:'recharge', value:'30%'} },

    // OBJETS DE QUÊTE (non consommables)
    'foret_champignon' : { name:'Champignon azulé', img:'../images/bouton/ing_foret.png', kind:'quest', stack:false },

    // STOCK / CRAFT (non consommables)
    'ames_plante'      : { name:'Olivette Brumis', img:'../images/bouton/ing_ames.webp', kind:'stash', stack:true },
    'ames_plante_2'    : { name:'Olivette Brumis', img:'../images/bouton/ing_ames.webp', kind:'stash', stack:true },
    'eau_creature'     : { name:'Essence des créatures de l’eau', img:'../images/bouton/ing_creature.webp', kind:'stash', stack:true },
  };
  function getReg(id){ return ARZ_ITEMS[id] || { name:id, img:'', kind:'stash', stack:false }; }

  // ---------- Jauge ----------
  const fillEl = $('#energyFill');
  const pctEl  = $('#energyPct');

  function renderGaugeFromState(st){
    if (!fillEl && !pctEl) return;
    const max = st.cfg?.max ?? 100;
    const pct = Math.round((st.energy / max) * 100);
    if (fillEl) fillEl.style.width = pct + '%';
    if (pctEl)  pctEl.textContent = pct + '%';
  }

  // ---------- Sac (UI) ----------
  const bagMenu  = $('.bag-menu') || createBagMenu();
  const bagList  = $('.bag-list', bagMenu) || createBagList(bagMenu);
  const bagBadge = $('.bag-badge') || createBagBadge();

  function createBagMenu(){
    const wrap = d.createElement('div');
    wrap.className = 'bag-menu';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-hidden','true');
    wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="bag-header">
        <strong>Sac</strong>
        <button class="bag-close" type="button" aria-label="Fermer">✕</button>
      </div>
      <ul class="bag-list"></ul>
    `;
    d.body.appendChild(wrap);
    return wrap;
  }
  function createBagList(parent){
    const ul = d.createElement('ul');
    ul.className = 'bag-list';
    parent.appendChild(ul);
    return ul;
  }
  function createBagBadge(){
    const b = d.createElement('div');
    b.className = 'bag-badge';
    Object.assign(b.style, { position:'fixed', right:'10px', top:'10px', zIndex:10 });
    d.body.appendChild(b);
    return b;
  }
  function updateBadge(n){ bagBadge.textContent = n > 0 ? String(n) : ''; }

  function renderBag(){
    const st  = Arz.get();
    const bag = st.bag || [];
    bagList.innerHTML = '';

    bag.forEach((entry, idx) => {
      const reg = getReg(entry.id);
      const li  = d.createElement('li');
      li.className = 'bag-item';
      li.innerHTML = `
        <figure class="bag-fig">
          ${reg.img ? `<img src="${reg.img}" alt="${reg.name}">` : ''}
          <figcaption>
            <div class="bag-name">${reg.name}</div>
            <div class="bag-qty">x${entry.qty ?? 1}</div>
          </figcaption>
        </figure>
        <div class="bag-actions">
          ${reg.kind === 'consumable' ? `<button class="bag-use" data-index="${idx}">Utiliser</button>` : ''}
        </div>
      `;
      bagList.appendChild(li);
    });

    updateBadge(bag.reduce((n,e)=>n+(e.qty||1),0));

    // Bind "Utiliser"
    $$('.bag-use', bagList).forEach(btn => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.getAttribute('data-index'), 10);
        const stNow = Arz.get();
        const entry = stNow.bag[index];
        if (!entry) return;
        const reg = getReg(entry.id);
        if (reg.kind !== 'consumable') return;

        // 1) Consommer côté core (décrémente / supprime dans Arz)
        const ok = Arz.useItemByIndex(index);
        if (!ok) return;

        // 2) Appliquer l’effet PARTIEL si défini (sinon le core a déjà mis full)
        applyConsumableEffect(entry.id, reg);

        // 3) Re-rendu
        renderBag();
      });
    });
  }

  function applyConsumableEffect(id, reg){
    if (!reg?.effect) return;
    const st  = Arz.get();
    const max = st.cfg?.max ?? 100;
    let newEnergy = st.energy;

    if (reg.effect.type === 'recharge'){
      const v = reg.effect.value;
      if (typeof v === 'string' && v.endsWith('%')){
        const pct = Math.max(0, parseFloat(v) / 100);
        newEnergy = Math.min(max, st.energy + max * pct);
      } else {
        newEnergy = Math.min(max, st.energy + Number(v || 0));
      }
      Arz.setEnergy(newEnergy); // émet arz:energy
      toast('Énergie rechargée ⚡');
    }
  }

  // ---------- Ouverture / fermeture ----------
  const bagToggle = $('.bag-toggle');
  if (bagToggle) bagToggle.addEventListener('click', () => showBag(true));
  bagMenu.addEventListener('click', (ev) => {
    if (ev.target.closest('.bag-close')) showBag(false);
  });
  function showBag(show){
    bagMenu.style.display = show ? 'block' : 'none';
    bagMenu.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) renderBag();
  }

  // ---------- Branchements core ----------
  d.addEventListener('arz:energy',    (e) => renderGaugeFromState({ energy:e.detail.energy, cfg:e.detail.cfg }));
  d.addEventListener('arz:bagchange', () => renderBag());
  d.addEventListener('arz:item:used', () => renderBag());
  d.addEventListener('arz:reset',     () => { renderGaugeFromState(Arz.get()); renderBag(); });

  // ---------- (Optionnel) Ajout via .ing-btn ----------
  d.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.ing-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    const ok = Arz.addItem(id);
    const reg = getReg(id);
    toast(ok ? `${reg.name || id} ajouté(e) au sac 🎒` : 'Déjà au max pour cet ingrédient');
    if (ok) renderBag();
  });

  // ---------- Boot ----------
  renderGaugeFromState(Arz.get());
  updateBadge(Arz.get().bag.reduce((n,e)=>n+(e.qty||1),0));
})();
