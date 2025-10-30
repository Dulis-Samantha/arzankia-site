// ===== Page Mondes — scripts spécifiques =====
(function(){
  const d=document, w=window;

  // Poussière de fée
  document.addEventListener('DOMContentLoaded', ()=>{
    const dust = d.querySelector('.pixie-dust');
    if(!dust) return;
    const COUNT = 24;
    for(let i=0;i<COUNT;i++){
      const s = d.createElement('span');
      const x = Math.random()*96 + 2;
      const y = Math.random()*70 + 10;
      const dur = 9 + Math.random()*6;
      const delay = -Math.random()*14;
      const size = 2 + Math.random()*4;
      Object.assign(s.style, {
        left: x+'%', top: y+'%', width: size+'px', height: size+'px',
        animationDuration: dur+'s', animationDelay: delay+'s'
      });
      dust.appendChild(s);
    }
  });

  // Flottement doux
  const bubbles = Array.from(document.querySelectorAll('.bubble'));
  let t0 = performance.now();
  function floatStep(t){
    const dt = (t - t0) / 1000;
    bubbles.forEach((b, i) => {
      const amp = 2 + (i % 5);
      const spd = 0.6 + (i % 3) * .15;
      const y = Math.sin(dt * spd + i) * amp;
      b.style.transform = `translateY(${y}px)`;
    });
    requestAnimationFrame(floatStep);
  }
  requestAnimationFrame(floatStep);

  // Secret Hégaïa (optionnel)
  document.addEventListener('click', (e)=>{
    const a = e.target.closest('a[data-secret="hegaia"]');
    if(!a) return;
    e.preventDefault();
    // petit délai dramatique, puis on va sur la page
    setTimeout(()=>{ window.location.href = a.getAttribute('href'); }, 1200);
  });

})();
