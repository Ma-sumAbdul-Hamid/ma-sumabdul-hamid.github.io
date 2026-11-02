/* A small, self-contained wandering controller for the homepage microrobot.
   Curved Catmull–Rom legs are generated as it goes (no repeating lap).
   Arc-length lookup keeps the swimming speed steady through each curve.
   Decorative only: reduced-motion, pause, tab visibility and offscreen checks
   suspend the controller; without JS the existing CSS animation remains. */
(function () {
  'use strict';

  const root = document.documentElement;
  const pond = document.querySelector('.hero-living .lab-hero-art');
  const swimmer = pond && pond.querySelector('.ocean-swimmer-track');
  const facing = swimmer && swimmer.querySelector('.ocean-robot-facing');
  if (!pond || !swimmer || !facing || !window.requestAnimationFrame) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const random = (a, b) => a + Math.random() * (b - a);
  const distance = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);

  // The robot spends most of its time in the open-water (right-hand) area,
  // but sometimes ventures behind the protected text wash on the left.
  function nextWaypoint(from) {
    let candidate = from;
    for (let attempt = 0; attempt < 20; attempt++) {
      const openWater = Math.random() < 0.77;
      candidate = {
        u: openWater ? random(0.43, 0.94) : random(0.06, 0.43),
        v: random(0.08, 0.92)
      };
      if (distance(candidate, from) >= 0.30) break;
    }
    return candidate;
  }

  // Four neighboring waypoints determine one smooth spline leg. Each completed
  // leg reveals another randomized destination instead of restarting a loop.
  const waypoints = [
    { u: 0.96, v: 0.63 },
    { u: 0.84, v: 0.61 },
    { u: 0.63, v: 0.36 },
    { u: 0.37, v: 0.73 }
  ];
  let bounds, lookup = [], length = 1, travelled = 0;
  let heading = -1, turning = 0, lastFrame = 0, frame = 0;
  let onScreen = true;

  function setBounds() {
    const w = pond.clientWidth, h = pond.clientHeight;
    const robotW = swimmer.offsetWidth || 300;
    const robotH = robotW * 0.50; // 460 × 230 SVG aspect ratio
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const left = Math.max(8, w * 0.018);
    const right = Math.max(left, w - robotW - Math.max(12, w * 0.018));
    const top = mobile ? h * 0.42 : h * 0.11;
    const bottom = Math.max(top, h - robotH - (mobile ? 51 : 46));
    bounds = { x: left, y: top, w: right - left, h: bottom - top };
  }

  function position(node) {
    return { x: bounds.x + node.u * bounds.w, y: bounds.y + node.v * bounds.h };
  }

  function spline(t) {
    const p0 = waypoints[0], p1 = waypoints[1];
    const p2 = waypoints[2], p3 = waypoints[3];
    const t2 = t * t, t3 = t2 * t;
    function component(k) {
      return 0.5 * ((2 * p1[k]) +
        (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
        (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    }
    return position({ u: component('u'), v: component('v') });
  }

  function rebuildArc() {
    lookup = [{ t: 0, d: 0 }];
    let before = spline(0), cumulative = 0;
    for (let i = 1; i <= 60; i++) {
      const t = i / 60, after = spline(t);
      cumulative += Math.hypot(after.x - before.x, after.y - before.y);
      lookup.push({ t, d: cumulative });
      before = after;
    }
    length = Math.max(1, cumulative);
  }

  function atTravel(d) {
    const target = clamp(d, 0, length);
    let lo = 0, hi = lookup.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (lookup[mid].d < target) lo = mid;
      else hi = mid;
    }
    const a = lookup[lo], b = lookup[hi];
    const fraction = b.d === a.d ? 0 : (target - a.d) / (b.d - a.d);
    return spline(a.t + (b.t - a.t) * fraction);
  }

  function draw() {
    const point = atTravel(travelled);
    swimmer.style.transform =
      'translate3d(' + point.x.toFixed(2) + 'px,' + point.y.toFixed(2) + 'px,0)';
  }

  function nextLeg() {
    waypoints.shift();
    waypoints.push(nextWaypoint(waypoints[2]));
    rebuildArc();
  }

  function animate(now) {
    frame = 0;
    if (!runningAllowed()) return;
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05);
    lastFrame = now;

    if (turning > 0) {
      turning = Math.max(0, turning - dt);
    } else {
      const pxPerSecond = clamp(pond.clientWidth * 0.039, 26, 66);
      let advance = pxPerSecond * dt;
      while (travelled + advance >= length) {
        advance -= (length - travelled);
        travelled = 0;
        nextLeg();
      }
      const candidate = travelled + advance;
      // A short, intentional turnaround happens only when the horizontal
      // travel direction changes, not on every curve or at every waypoint.
      const before = atTravel(Math.max(0, candidate - 4));
      const after = atTravel(Math.min(length, candidate + 4));
      const horizontal = after.x - before.x;
      const wanted = horizontal > 0.8 ? 1 : horizontal < -0.8 ? -1 : heading;
      if (wanted !== heading) {
        heading = wanted;
        facing.style.transform = 'scaleX(' + heading + ')';
        turning = 0.68;
      } else {
        travelled = candidate;
      }
    }
    draw();
    frame = window.requestAnimationFrame(animate);
  }

  function runningAllowed() {
    return !reduced.matches && !document.hidden && onScreen &&
      !root.classList.contains('lab-motion-paused') &&
      !root.classList.contains('lab-motion-idle');
  }

  function syncRunning() {
    if (reduced.matches) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      root.classList.remove('lab-roaming');
      swimmer.style.transform = '';
      facing.style.transform = '';
      return;
    }
    root.classList.add('lab-roaming');
    if (!runningAllowed()) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      return;
    }
    if (!frame) {
      draw();
      lastFrame = 0;
      frame = window.requestAnimationFrame(animate);
    }
  }

  function onResize() {
    const ratio = travelled / length;
    setBounds();
    rebuildArc();
    travelled = ratio * length;
    if (!reduced.matches) draw();
  }

  setBounds();
  rebuildArc();
  facing.style.transform = 'scaleX(-1)';
  root.classList.add('lab-roaming');
  draw();

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(onResize);
    observer.observe(pond);
  } else {
    window.addEventListener('resize', onResize, { passive: true });
  }

  if (window.IntersectionObserver) {
    const observer = new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      syncRunning();
    }, { threshold: 0.01 });
    observer.observe(pond);
  }
  const motionObserver = new MutationObserver(syncRunning);
  motionObserver.observe(root, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', syncRunning);
  if (typeof reduced.addEventListener === 'function') {
    reduced.addEventListener('change', syncRunning);
  } else if (typeof reduced.addListener === 'function') {
    reduced.addListener(syncRunning);
  }
  syncRunning();
})();
