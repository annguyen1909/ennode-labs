// particles.js
// Screen-space cursor particle trail extracted from the legacy script.
// Exposes global functions: initParticleSystem(), spawnParticle(x,y,vx,vy), updateAndRenderParticles(dt), resizeParticleCanvas()
(function () {
  // Use IIFE to avoid leaking locals; attach public API to window
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let particleCanvas = null;
  let pc = null;
  let particlePool = [];
  let activeParticles = [];
  const MAX_PARTICLES = 160;

  function resizeParticleCanvas() {
    if (!particleCanvas || !pc) return;
    particleCanvas.width = Math.floor(window.innerWidth * DPR);
    particleCanvas.height = Math.floor(window.innerHeight * DPR);
    particleCanvas.style.width = `${window.innerWidth}px`;
    particleCanvas.style.height = `${window.innerHeight}px`;
    pc.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function spawnParticle(x, y, vx = 0, vy = 0) {
    if (!pc) return;
    let p = particlePool.pop();
    if (!p) p = {};
    p.x = x; p.y = y;
    p.vx = (vx * 0.6) + (Math.random() - 0.5) * 0.3;
    p.vy = (vy * 0.6) + (Math.random() - 0.5) * 0.3;
    p.life = 0;
    p.ttl = 800 + Math.random() * 600;
    p.size = 2 + Math.random() * 3;
    p.alpha = 1;
    activeParticles.push(p);
    if (activeParticles.length > MAX_PARTICLES) particlePool.push(activeParticles.shift());
  }

  function initParticleSystem() {
    particleCanvas = document.getElementById('cursor-particles');
    pc = particleCanvas && particleCanvas.getContext ? particleCanvas.getContext('2d') : null;
    window.spawnParticle = spawnParticle;
    window.updateAndRenderParticles = updateAndRenderParticles;
    window.resizeParticleCanvas = resizeParticleCanvas;

    if (!particleCanvas || !pc) return;
    window.addEventListener('resize', resizeParticleCanvas);
    resizeParticleCanvas();
  }

  // Auto-init immediately so globals are ready for script.js which runs after
  try { initParticleSystem(); } catch (e) { /* ignore in weird envs */ }

  // Expose an init function in case consumer wants to re-init
  window.initParticleSystem = initParticleSystem;
})();
