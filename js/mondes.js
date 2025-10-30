// Animation libre des bulles + poussière
(function(){
  const d=document;
  const bubbles=[...d.querySelectorAll('.bubble:not(.hegaia)')];
  const hegaia=d.querySelector('.hegaia');

  // --- Animation de poussière
  d.addEventListener('DOMContentLoaded', ()=>{
    const dust=d.querySelector('.pixie-dust');
    if(!dust) return;
    for(let i=0;i<25;i++){
      const p=d.createElement('span');
      p.style.position='absolute';
      p.style.left=Math.random()*100+'%';
      p.style.top=Math.random()*100+'%';
      p.style.width=p.style.height=(Math.random()*3+2)+'px';
      p.style.background='rgba(255,255,255,.8)';
      p.style.borderRadius='50%';
      p.style.animation=`dustMove ${6+Math.random()*8}s linear ${Math.random()*-8}s infinite`;
      dust.appendChild(p);
    }
  });

  // --- Flottement aléatoire des bulles
  bubbles.forEach(b=>{
    const x0=parseFloat(getComputedStyle(b).left)||0;
    const y0=parseFloat(getComputedStyle(b).top)||0;
    let offsetX=(Math.random()*40)-20;
    let offsetY=(Math.random()*30)-15;
    let angle=Math.random()*Math.PI*2;
    function move(){
      angle+=0.01+(Math.random()*0.01);
      const dx=Math.sin(angle)*offsetX;
      const dy=Math.cos(angle)*offsetY;
      b.style.transform=`translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(move);
    }
    move();
  });

  // ----- Dérive aléatoire des bulles (CSS variables)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.page-mondes .bubble').forEach((b, i) => {
    // amplitudes aléatoires
    const rx = (8 + Math.random() * 20).toFixed(1) + 'px';
    const ry = (6 + Math.random() * 16).toFixed(1) + 'px';
    // durées et décalage aléatoires
    const dur = (8 + Math.random() * 8).toFixed(1) + 's';
    const delay = (-Math.random() * 10).toFixed(1) + 's';

    b.style.setProperty('--rx', rx);
    b.style.setProperty('--ry', ry);
    b.style.setProperty('--dur', dur);
    b.style.animationDelay = delay;
  });
});


  // Hégaïa clic (effet secret optionnel)
  hegaia?.addEventListener('click',e=>{
    e.preventDefault();
    hegaia.style.transition='transform 0.5s ease, opacity 0.5s ease';
    hegaia.style.transform='scale(1.3)';
    hegaia.style.opacity='1';
    setTimeout(()=>window.location.href=hegaia.href,800);
  });
})();

// --- Animation keyframes pour la poussière
const st=document.createElement('style');
st.textContent=`@keyframes dustMove{0%{transform:translateY(0) scale(1);}50%{transform:translateY(-20px) scale(0.8);}100%{transform:translateY(0) scale(1);}}`;
document.head.appendChild(st);
