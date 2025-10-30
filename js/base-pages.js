;(() => {
  // Active une classe "js" sur le body (pour styles conditionnels si besoin)
  document.documentElement.classList.add('js');

  /* ============ Respect du mouvement réduit ============ */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============ Smooth scroll pour ancres internes ============ */
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll:true });
  });

  /* ============ Révélation au scroll ============ */
  const toReveal = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && toReveal.length){
    const io = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if (entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: .12 });
    toReveal.forEach(el=>io.observe(el));
  } else {
    toReveal.forEach(el=>el.classList.add('in'));
  }

  /* ============ Typewriter (optionnel) ============ */
  const elType = document.getElementById('message-secret');
  if (elType && !prefersReduced){
    const text = elType.dataset.text || elType.textContent.trim();
    elType.textContent = '';
    let i=0;
    (function tick(){
      if (i < text.length){
        elType.textContent += text.charAt(i++);
        setTimeout(tick, 40);
      }
    })();
  }

  /* ============ Liens externes en _blank + noopener ============ */
  for (const a of document.querySelectorAll('a[href^="http"]')){
    a.setAttribute('target','_blank');
    a.setAttribute('rel','noopener');
  }

  /* ============ Petit helper Toast ============ */
  window.ArzToast = function(msg, ms=1800){
    const w = document.createElement('div');
    w.style.position='fixed'; w.style.inset='0'; w.style.display='grid';
    w.style.placeItems='center'; w.style.zIndex='9999';
    w.style.pointerEvents='none'; w.style.opacity='0'; w.style.transition='opacity .25s ease';
    w.innerHTML = `
      <div style="
        max-width:min(92vw,560px);
        text-align:center;
        background:rgba(10,0,20,.85);
        color:#fff8e6;
        border:1px solid rgba(255,214,116,.55);
        border-radius:14px;
        padding:.9rem 1.1rem;
        box-shadow:0 18px 40px rgba(0,0,0,.45), 0 0 22px rgba(255,214,116,.25);
        font-family:'Cinzel Decorative',serif;">
        ${msg}
      </div>`;
    document.body.appendChild(w);
    requestAnimationFrame(()=> w.style.opacity='1');
    setTimeout(()=>{ w.style.opacity='0'; setTimeout(()=> w.remove(),220); }, ms);
  };

  /* ============ (Optionnel) Hook avec le cœur ============ */
  // Si arz-core.js est chargé, on peut afficher un petit message à l’arrivée
  if (window.Arz && typeof Arz.get === 'function'){
    const st = Arz.get();
    if (st.energy < st.cfg.max){
      // Exemple : prévenir qu'on recharge ici
      // ArzToast('Repos bien mérité… Ton énergie se recharge 🔆');
    }
  }
})();
