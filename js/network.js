/* Network mesh background: drifting dots, thin lines between close dots, and a reaction to the mouse. */
(function () {
  var cv = document.getElementById('scgss-network');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d'), W = 0, H = 0, dpr = 1, dots = [], mouse = { x: -9999, y: -9999, on: false };
  var LINK = 130, MOUSE = 170, rgb = [11, 93, 69];
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function readColor() {
    var c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) rgb = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)];
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = Math.max(24, Math.min(110, Math.round(W * H / 17000)));
    while (dots.length < want) dots.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35, r: 1.2 + Math.random() * 1.4 });
    dots.length = want;
  }
  function frame() {
    ctx.clearRect(0, 0, W, H);
    var i, j, a, b, dx, dy, d, k;
    for (i = 0; i < dots.length; i++) {
      a = dots[i];
      if (!still) {
        a.x += a.vx; a.y += a.vy;
        if (a.x < -10) a.x = W + 10; else if (a.x > W + 10) a.x = -10;
        if (a.y < -10) a.y = H + 10; else if (a.y > H + 10) a.y = -10;
        if (mouse.on) {
          dx = a.x - mouse.x; dy = a.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
          if (d < MOUSE && d > 1) { k = (1 - d / MOUSE) * 0.6; a.x += dx / d * k; a.y += dy / d * k; }
        }
      }
    }
    ctx.lineWidth = 1;
    for (i = 0; i < dots.length; i++) {
      a = dots[i];
      for (j = i + 1; j < dots.length; j++) {
        b = dots[j]; dx = a.x - b.x; dy = a.y - b.y;
        if (dx > LINK || dx < -LINK || dy > LINK || dy < -LINK) continue;
        d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / LINK) * 0.22).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.on) {
        dx = a.x - mouse.x; dy = a.y - mouse.y; d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE) {
          ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / MOUSE) * 0.45).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(' + rgb + ',0.42)';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.2832); ctx.fill();
    }
  }
  var raf = 0;
  function loop() { frame(); raf = requestAnimationFrame(loop); }
  function start() { if (still) frame(); else if (!raf) loop(); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  window.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true; }, { passive: true });
  document.addEventListener('mouseleave', function () { mouse.on = false; });
  window.addEventListener('blur', function () { mouse.on = false; });
  window.addEventListener('resize', function () { size(); if (still) frame(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  if (window.MutationObserver) new MutationObserver(function () { readColor(); if (still) frame(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  readColor(); size(); start();
})();
