/* Living Lab: pause/resume SVG motion. No audio, timers, libraries or tracking. */
(function () {
  'use strict';
  const root = document.documentElement;
  const toggle = document.querySelector('[data-lab-motion-toggle]');
  if (!toggle) return;

  const label = toggle.querySelector('[data-motion-label]');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');

  let paused = false;
  try { paused = localStorage.getItem('livingLabMotion') === 'paused'; } catch (_) {}
  if (preference.matches) paused = true;

  function syncMotion() {
    root.classList.toggle('lab-motion-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? 'Play decorative animations' : 'Pause decorative animations');
    if (label) label.textContent = paused ? 'Play motion' : 'Pause motion';
  }

  toggle.addEventListener('click', function () {
    if (preference.matches) return;
    paused = !paused;
    try { localStorage.setItem('livingLabMotion', paused ? 'paused' : 'playing'); } catch (_) {}
    syncMotion();
  });

  document.addEventListener('visibilitychange', function () {
    root.classList.toggle('lab-motion-idle', document.hidden);
  });
  function syncReducedMotion() {
    if (preference.matches) paused = true;
    syncMotion();
  }
  if (typeof preference.addEventListener === 'function') {
    preference.addEventListener('change', syncReducedMotion);
  } else if (typeof preference.addListener === 'function') {
    preference.addListener(syncReducedMotion);
  }
  syncMotion();
})();
