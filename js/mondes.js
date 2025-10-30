// ===== Page Mondes — scripts spécifiques =====

(function () {
  // Flottement léger des bulles
  const bubbles = document.querySelectorAll(".bubble");
  let t0 = performance.now();

  function floatStep(t) {
    const dt = (t - t0) / 1000;
    bubbles.forEach((b, i) => {
      const amp = 2 + (i % 5);         // amplitude
      const spd = 0.6 + (i % 3) * .15; // vitesse
      const y = Math.sin(dt * spd + i) * amp;
      b.style.transform = `translateY(${y}px)`;
    });
    requestAnimationFrame(floatStep);
  }
  requestAnimationFrame(floatStep);

  // Poussière de fée (opacité pulse)
  const dust = document.querySelector(".pixie-dust");
  if (dust) {
    let dir = 1, op = 0.15;
    setInterval(() => {
      op += dir * 0.02;
      if (op > 0.35 || op < 0.08) dir *= -1;
      dust.style.opacity = op.toFixed(2);
    }, 100);
  }
})();
