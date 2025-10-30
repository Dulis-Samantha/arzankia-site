// === UNIVERS VIVANT ===
(function(){
  const d = document;

  // --- Création poussière de fée
  d.addEventListener('DOMContentLoaded', ()=>{
    const dust = d.querySelector('.pixie-dust');
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

  // --- Animation de poussière
  const kf=document.createElement('style');
  kf.textContent=`@keyframes dustMove{0%{transform:translateY(0)}50%{transform:translateY(-20px)}100%{transform:translateY(0)}}`;
  document.head.appendChild(kf);

  // --- Positionner et animer les bulles
  d.addEventListener('DOMContentLoaded',()=>{
    const zone = d.querySelector('.bubble-zone');
    const bubbles = [...zone.querySelectorAll('.bubble')];
    const w = zone.clientWidth;
    const h = zone.clientHeight;

    bubbles.forEach((b,i)=>{
      const size = 80 + Math.random()*80; // taille 80–160 px
      const x = Math.random()*(w-size);
      const y = Math.random()*(h-size);
      b.style.width = size+'px';
      b.style.height = size+'px';
      b.style.left = x+'px';
      b.style.top  = y+'px';
      // vitesse & direction
      const dx = (Math.random()*0.4-0.2);
      const dy = (Math.random()*0.4-0.2);
      const speed = 0.2 + Math.random()*0.3;
      b.dataset.vx = dx*speed;
      b.dataset.vy = dy*speed;
    });

    function animate(){
      bubbles.forEach(b=>{
        let x = parseFloat(b.style.left);
        let y = parseFloat(b.style.top);
        let vx = parseFloat(b.dataset.vx);
        let vy = parseFloat(b.dataset.vy);
        const size = parseFloat(b.style.width);
        // rebond sur les bords
        if(x+vx<0 || x+size+vx>w) b.dataset.vx = vx = -vx;
        if(y+vy<0 || y+size+vy>h) b.dataset.vy = vy = -vy;
        b.style.left = (x+vx)+'px';
        b.style.top  = (y+vy)+'px';
      });
      requestAnimationFrame(animate);
    }
    animate();
  });

  // --- Effet secret Hégaïa
  d.addEventListener('click',e=>{
    const h = e.target.closest('.hegaia');
    if(!h) return;
    e.preventDefault();
    h.style.transform='scale(1.4)';
    h.style.opacity='1';
    setTimeout(()=>window.location.href=h.href,1000);
  });
})();
