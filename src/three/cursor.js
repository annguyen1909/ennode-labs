// cursor.js
// Lightweight two-layer cursor extracted from legacy script.
// Exposes: initCursor() and disposeCursor() on window
(function () {
  let outerRef = null;
  let innerRef = null;
  let raf = 0;

  const pointer = {
    x: 0, y: 0,
    ox: -9999, oy: -9999,
    ix: -9999, iy: -9999,
  };

  function createCursor() {
    if (typeof window === 'undefined') return false;
    const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    const isFine = window.matchMedia ? window.matchMedia("(pointer: fine)").matches : true;
    const isWide = typeof window.innerWidth === 'number' ? window.innerWidth >= 640 : true;
    const shouldEnable = !isTouch && isFine && isWide;
    if (!shouldEnable) return false;

    outerRef = document.createElement('div');
    outerRef.className = 'global-cursor';
    outerRef.setAttribute('aria-hidden', 'true');
    outerRef.style.transform = 'translate3d(-50%, -50%, 0)';
    outerRef.style.willChange = 'transform';
    document.body.appendChild(outerRef);

    innerRef = document.createElement('div');
    innerRef.className = 'global-cursor-inner';
    innerRef.setAttribute('aria-hidden', 'true');
    innerRef.style.transform = 'translate3d(-50%, -50%, 0)';
    innerRef.style.willChange = 'transform';
    document.body.appendChild(innerRef);

    // Hide native cursor
    document.documentElement.style.cursor = 'none';

    function onMove(e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      // try to spawn a particle if available
      try {
        if (window.spawnParticle) window.spawnParticle(e.clientX, e.clientY, e.movementX || 0, e.movementY || 0);
      } catch (err) {}
    }

    window.addEventListener('mousemove', onMove, { passive: true });

    const outerEase = 0.125;
    const innerEase = 0.1625;

    function loop() {
      const p = pointer;
      if (p.ox === -9999) { p.ox = p.x; p.oy = p.y; p.ix = p.x; p.iy = p.y; }
      p.ox += (p.x - p.ox) * outerEase;
      p.oy += (p.y - p.oy) * outerEase;
      p.ix += (p.ox - p.ix) * innerEase;
      p.iy += (p.oy - p.iy) * innerEase;

      if (outerRef) outerRef.style.transform = `translate3d(${p.ox}px, ${p.oy}px, 0) translate(-50%, -50%)`;
      if (innerRef) innerRef.style.transform = `translate3d(${p.ix}px, ${p.iy}px, 0) translate(-50%, -50%)`;

      // publish simple cursor state for particle system / other consumers
      window.cursor = { x: p.ox, y: p.oy };

      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);

    // return dispose function
    return function dispose() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      try { document.documentElement.style.cursor = ''; } catch (e) {}
      if (outerRef && outerRef.parentNode) outerRef.parentNode.removeChild(outerRef);
      if (innerRef && innerRef.parentNode) innerRef.parentNode.removeChild(innerRef);
      outerRef = null; innerRef = null;
    };
  }

  function initCursor() {
    try {
      const disposer = createCursor();
      window.disposeCursor = disposer || function () {};
      return !!disposer;
    } catch (e) { return false; }
  }

  window.initCursor = initCursor;
})();
