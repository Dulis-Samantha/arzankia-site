/* ============================================================
   ARZANKIA — Système de quêtes
   - Boutons .quest-starter et .quest-receiver
   - Journal de quêtes (localStorage)
   - Récompenses : recharge + ralentissement du drain
   - Déblocage Test "Quel héros es-tu ?" (≥3 quêtes)
   - Spécialisation finale (symbole + mode infini)
   ============================================================ */

(function () {
  // ---- bootstrap : attendre Arz si besoin, sinon lancer direct
  function bootstrap() {
    if (!window.Arz) {
      console.warn('ArzCore non prêt — quete.js attend arz:start.');
      document.addEventListener('arz:start', initQuete, { once: true });
      return;
    }
    initQuete(); // Arz déjà prêt
  }

  // ---- tout le code Quêtes
  function initQuete() {
    if (window.ArzQuete) return;   // anti-double init (namespace Quêtes)
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

    // ---------- UI légère : overlay de dialogue ----------
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

document.dispatchEvent(new CustomEvent('arz:quest-started', {
  detail: {
    id,                      // ex: "quete_ptikitis"
    targetIngredient,        // ex: "foret_champignon"
    deliverTo                // ex: "zouppiame"
  }
}));

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

       document.dispatchEvent(new CustomEvent('arz:quest-item-delivered', {
  detail: { id: q.targetIngredient }
}));


      // ---- RÉCOMPENSES ----
      const meta = META.load();
      meta.questsCompleted = (meta.questsCompleted || 0) + 1;

      if (meta.questsCompleted >= 3 && !meta.testUnlocked) {
        meta.testUnlocked = true;
        say(`🪄 <b>Zouppiame</b> : Bravo, déjà <b>trois quêtes</b> accomplies !<br>
        Tu peux à présent passer ton <b>examen de passage</b> pour découvrir ta <b>spécialisation</b>.<br>
        Va trouver <b>Raphaël</b> pour commencer ton test !`);
      } else {
        say("🎉 Quête terminée ! Zouppiame te remercie. Ta jauge est rechargée et ton expérience augmente. ✨");
      }

      META.save(meta);

      // Recharge + recalcul du drain côté ArzCore
      document.dispatchEvent(new CustomEvent('arz:reward', {
        detail: { recharge:true, questsCompleted: meta.questsCompleted }
      }));

      return true;
    }

// ---------- Hooks UI (boutons & événements) ----------

// Donneur de quête (ex. Zouppikiti)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.quest-starter[data-quest-id]');
  if (!btn) return;
  startQuest({
    id:               btn.dataset.questId,
    title:            btn.dataset.questTitle || 'Quête',
    targetIngredient: btn.dataset.questTargetIngredient,
    targetName:       btn.dataset.questTargetName || 'Ingrédient',
    deliverTo:        btn.dataset.questDeliverTo
  });
});

// Marquer “gathered” quand l’ingrédient est collecté
document.addEventListener('arz:ingredient-collected', (ev) => {
  const { id, name } = ev.detail || {};
  const quests = load(LS_QUESTS, {});
  let changed = false;

  for (const qid in quests) {
    const q = quests[qid];
    if (q.status === 'active' && q.targetIngredient === id) {
      q.status = 'gathered';
      changed = true;

      // petit effet visuel sur le receveur (ex. Zouppiame)
      const rcv = document.querySelector(`.quest-receiver[data-quest-id="${qid}"]`);
      if (rcv) rcv.classList.add('pulse');

      say(`🧺 Parfait ! Tu as obtenu <b>${name || q.targetName}</b>.<br>
           Va maintenant voir <b>${q.deliverTo}</b> pour remettre l’ingrédient.`);
    }
  }
  if (changed) save(LS_QUESTS, quests);
});

// Receveur de quête (ex. Zouppiame)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.quest-receiver[data-quest-id]');
  if (!btn) return;
  const ok = ARZ_QUESTS.completeIfGathered(btn.dataset.questId, btn.dataset.receiver);
  if (ok) btn.classList.remove('pulse'); // retire l’animation si présent
});

    // ---------- API globale ----------
    window.ARZ_QUESTS = { startQuest, completeIfGathered };
    window.ARZ_META   = META;
  }

  // Lancer
  bootstrap();
})();

// === GARDES DE COLLECTE (unicité + quête obligatoire) ========================

// Utilitaires inventaire (tentative d’API Arz, sinon fallback localStorage)
const BAG_LS_KEY = 'arz_bag_v2'; // adapte si ton projet utilise un autre nom

function bagLoad() {
  // 1) API Arz si dispo
  if (window.Arz && Arz.bag && typeof Arz.bag.list === 'function') {
    try { return Arz.bag.list(); } catch(_) {}
  }
  // 2) Fallback localStorage (format libre: [{id,name,...}])
  try { return JSON.parse(localStorage.getItem(BAG_LS_KEY)) || []; } catch { return []; }
}
function bagHas(id) {
  // 1) API Arz si dispo
  if (window.Arz && Arz.bag && typeof Arz.bag.has === 'function') {
    try { return !!Arz.bag.has(id); } catch(_) {}
  }
  // 2) Fallback LS
  return bagLoad().some(it => it.id === id);
}

// Quête active pour un ingrédient ?
function questActiveFor(ingId) {
  const qs = (typeof load === 'function') ? load('arz_quests_v1', {}) : {};
  return Object.values(qs).some(q => q && q.status === 'active' && q.targetIngredient === ingId);
}
// Quête déjà marquée "gathered" (on ne doit plus recollecter) ?
function questAlreadyGathered(ingId) {
  const qs = (typeof load === 'function') ? load('arz_quests_v1', {}) : {};
  return Object.values(qs).some(q => q && q.status === 'gathered' && q.targetIngredient === ingId);
}

// Visuel verrouillé/déverrouillé selon état des quêtes
function updateCollectibilityHints() {
  document.querySelectorAll('.ing-btn.ingredient[data-id]').forEach(btn => {
    const id = btn.dataset.id;
    const questOnly = btn.classList.contains('quest-only') || btn.dataset.questOnly === '1';
    const allowed = !questOnly || questActiveFor(id);
    btn.classList.toggle('locked', !allowed);
    if (!allowed) {
      btn.title = 'Commence la quête liée pour pouvoir ramasser cet ingrédient';
    } else {
      btn.removeAttribute('title');
    }
  });
}

// Bloque la collecte AVANT que ton handler principal ne s’exécute
// (useCapture=true pour passer en priorité)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.ing-btn.ingredient[data-id]');
  if (!btn) return;

  const id   = btn.dataset.id;
  const name = btn.dataset.name || 'Ingrédient';
  const questOnly = btn.classList.contains('quest-only') || btn.dataset.questOnly === '1';

  // 1) Interdit si l’ingrédient est "de quête" et qu’aucune quête active ne le demande
  if (questOnly && !questActiveFor(id)) {
    e.preventDefault(); e.stopPropagation();
    say(`⛔ <b>${name}</b> ne peut être ramassé que lorsque la quête correspondante est <b>en cours</b>.`);
    return;
  }

  // 2) Interdit si déjà dans le sac (unicité)
  if (bagHas(id)) {
    e.preventDefault(); e.stopPropagation();
    say(`👜 Tu as déjà <b>${name}</b> dans ton sac. Un seul exemplaire est autorisé.`);
    return;
  }

  // 3) Par sécurité, évite la double collecte si la quête l’a déjà marqué "gathered"
  if (questAlreadyGathered(id)) {
    e.preventDefault(); e.stopPropagation();
    say(`✅ La quête liée à <b>${name}</b> est déjà validée côté collecte.`);
    return;
  }

}, true); // <-- capture

// Mets à jour les indices visuels aux grands moments
document.addEventListener('DOMContentLoaded', updateCollectibilityHints);
document.addEventListener('arz:start', updateCollectibilityHints, { once:true });

// Après démarrage d’une quête -> réévalue l’état visuel
const _startQuestRef = (window.ARZ_QUESTS && window.ARZ_QUESTS.startQuest) || null;
if (_startQuestRef) {
  window.ARZ_QUESTS.startQuest = function(cfg){
    const r = _startQuestRef(cfg);
    try { updateCollectibilityHints(); } catch(_){}
    return r;
  };
}
// Après passage à "gathered"/"done" -> réévalue aussi
document.addEventListener('arz:ingredient-collected', updateCollectibilityHints);

