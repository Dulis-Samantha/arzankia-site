/* ============================================================
   ARZANKIA — Système de quêtes
   - Boutons .quest-starter et .quest-receiver
   - Journal de quêtes (localStorage)
   - Récompenses : recharge + ralentissement du drain
   - Déblocage Test "Quel héros es-tu ?" (≥3 quêtes)
   - Spécialisation finale (symbole + mode infini)
   ============================================================ */
// --- Sécurité : attendre ArzCore avant d'exécuter quete.js
if (!window.Arz) {
  console.warn('ArzCore ou UI non chargés avant quete.js — attente du démarrage.');
  document.addEventListener('arz:start', () => {
    console.info('ArzCore détecté, initialisation de quete.js');
    if (typeof initQuete === 'function') initQuete();  // ta fonction d’init
  }, { once:true });
  throw new Error('Stop: ArzCore pas encore chargé');
}

(() => {
  if (!window.Arz || !window.ARZ_QUESTS) {
    console.warn("⚠️ ArzCore ou UI non chargés avant quete.js");
  }
})();

(() => {
  if (window.ArzQuete) return; // anti-double init
  window.ArzQuete = true;

  // ---------- Storage utils ----------
  const LS_QUESTS = 'arz_quests_v1';
  const LS_META   = 'arz_meta_v1';

  const load = (k, fallback) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---------- META (xp, test, spec) ----------
  const META = {
    load(){ return load(LS_META, { questsCompleted:0, testUnlocked:false, spec:null, specFinal:false }); },
    save(m){ save(LS_META, m); },
    setSpec(spec){
      const m = this.load(); m.spec = spec; this.save(m);
      document.dispatchEvent(new CustomEvent('arz:spec-changed',{detail:{spec}}));
    },
    finalizeSpec(spec){
      const m = this.load(); m.spec = spec; m.specFinal = true; this.save(m);
      document.dispatchEvent(new CustomEvent('arz:spec-final',{detail:{spec}}));
    }
  };

  // ---------- UI: overlay de dialogue ----------
  function say(html){
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.55)',
      display:'grid', placeItems:'center', zIndex:'9999'
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      maxWidth:'min(560px,92vw)', background:'rgba(25,18,40,.96)', color:'#ffeec0',
      borderRadius:'18px', padding:'16px 18px', fontFamily:'Georgia, serif',
      boxShadow:'0 16px 40px rgba(0,0,0,.4)', lineHeight:'1.5'
    });
    box.innerHTML = `<div>${html}</div>
      <div style="text-align:right;margin-top:10px">
        <button style="background:#ffe39c;border:none;border-radius:12px;padding:8px 14px;cursor:pointer">OK</button>
      </div>`;
    wrap.appendChild(box);
    wrap.addEventListener('click', e => { if(e.target===wrap) wrap.remove(); });
    box.querySelector('button').addEventListener('click', ()=>wrap.remove());
    document.body.appendChild(wrap);
  }

  // ---------- Quêtes ----------
  function startQuest({id, title, targetIngredient, targetName, deliverTo}){
    const quests = load(LS_QUESTS, {});
    const q = quests[id];
    if(q?.status === 'done'){ say("✅ Cette quête est déjà terminée."); return; }
    if(q?.status === 'active' || q?.status === 'gathered'){ say("🧭 Quête déjà en cours."); return; }

    quests[id] = { id, title, status:'active', targetIngredient, targetName, deliverTo };
    save(LS_QUESTS, quests);

    say(`👋 <b>Zouppikiti</b> : Salut Raphaël ! On a besoin de toi.<br>
      Peux-tu aller dans la <b>Forêt</b> récupérer un <b>${targetName}</b> ?
      Puis rapporte-le à <b>Zouppiame</b> dans le <b>Monde des Âmes</b>. ✨`);
  }

  function completeIfGathered(questId, deliverToSlug){
    const quests = load(LS_QUESTS, {});
    const q = quests[questId];
    if(!q){ say("🤔 Aucune quête correspondante."); return false; }
    if(q.status !== 'gathered'){ say("Il te manque encore l’ingrédient demandé."); return false; }
    if(q.deliverTo !== deliverToSlug){ say("Ce n’est pas le bon destinataire."); return false; }

    q.status = 'done';
    save(LS_QUESTS, quests);

    // ---- RÉCOMPENSES ----
    const meta = META.load();
    meta.questsCompleted = (meta.questsCompleted || 0) + 1;

    // Palier 3 → déverrouille le test + dialogue spécial
    if (meta.questsCompleted >= 3 && !meta.testUnlocked) {
      meta.testUnlocked = true;
      say(`🪄 <b>Zouppiame</b> : Bravo, déjà <b>trois quêtes</b> accomplies !<br>
      Tu peux à présent passer ton <b>examen de passage</b> pour découvrir ta <b>spécialisation</b>.<br>
      Va trouver <b>Raphaël</b> pour commencer ton test !`);
    } else {
      say("🎉 Quête terminée ! Zouppiame te remercie. Ta jauge est rechargée et ton expérience augmente. ✨");
    }

    META.save(meta);

    // Recharge la jauge + recalcul du drain (vu par arz-core.js)
    document.dispatchEvent(new CustomEvent('arz:reward', {
      detail: { recharge:true, questsCompleted: meta.questsCompleted }
    }));

    return true;
  }

  // ---------- Hooks UI ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.quest-starter[data-quest-id]');
    if(!btn) return;
    startQuest({
      id:               btn.dataset.questId,
      title:            btn.dataset.questTitle || 'Quête',
      targetIngredient: btn.dataset.questTargetIngredient,
      targetName:       btn.dataset.questTargetName || 'Ingrédient',
      deliverTo:        btn.dataset.questDeliverTo
    });
  });

  document.addEventListener('arz:ingredient-collected', (ev) => {
    const { id, name } = ev.detail || {};
    const quests = load(LS_QUESTS, {});
    let changed = false;

    for (const qid in quests) {
      const q = quests[qid];
      if (q.status === 'active' && q.targetIngredient === id) {
        q.status = 'gathered';
        changed = true;

        // Effet visuel sur le receveur
        const rcv = document.querySelector(`.quest-receiver[data-quest-id="${qid}"]`);
        if (rcv) rcv.classList.add('pulse');

        say(`🧺 Parfait ! Tu as obtenu <b>${name || q.targetName}</b>.<br>
             Va maintenant voir <b>Zouppiame</b> dans le <b>Monde des Âmes</b>.`);
      }
    }

    if (changed) save(LS_QUESTS, quests);
  });

  // ---------- API globale ----------
  window.ARZ_QUESTS = { startQuest, completeIfGathered };
  window.ARZ_META   = META;
})();
