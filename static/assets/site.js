/* Notification app site: theme, menu, reveal-on-scroll and the one-day simulation (example rules, generated in the browser). */
(function () {
  'use strict';
  var root = document.documentElement;
  document.body.classList.remove('no-js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- theme: System (default) + the app's five themes ----------
  var THEMES = ['system', 'paper', 'light', 'dark', 'night', 'day'];
  var DARKISH = { dark: 1, night: 1 };
  var themeBtn = document.getElementById('theme'), themeMenu = document.querySelector('.themes');
  var ICON = {
    system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
  };
  function getTheme() { try { var t = localStorage.getItem('theme'); return THEMES.indexOf(t) >= 0 ? t : 'system'; } catch (e) { return 'system'; } }
  function applyTheme(t) {
    if (t === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    if (themeBtn) themeBtn.innerHTML = ICON[t === 'system' ? 'system' : (DARKISH[t] ? 'dark' : 'light')];
    if (themeMenu) themeMenu.querySelectorAll('[data-t]').forEach(function (b) {
      if (b.getAttribute('data-t') === t) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }
  applyTheme(getTheme());
  if (themeMenu) {
    themeMenu.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]');
      if (!b) return;
      var t = b.getAttribute('data-t');
      try { localStorage.setItem('theme', t); } catch (err) {}
      applyTheme(t);
      themeMenu.removeAttribute('open');
    });
    document.addEventListener('click', function (e) { if (!themeMenu.contains(e.target)) themeMenu.removeAttribute('open'); });
  }

  // ---------- mobile menu ----------
  var menuBtn = document.getElementById('menu'), nav = document.getElementById('nav');
  if (menuBtn && nav) menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(open));
  });

  // ---------- language menu: remember the choice for the root page ----------
  var langs = document.querySelector('.langs');
  if (langs) {
    langs.addEventListener('click', function (e) {
      var a = e.target.closest('a[hreflang]');
      if (a) try { localStorage.setItem('lang', a.getAttribute('hreflang')); } catch (err) {}
    });
    document.addEventListener('click', function (e) { if (!langs.contains(e.target)) langs.removeAttribute('open'); });
  }

  // ---------- reveal on scroll ----------
  var rv = document.querySelectorAll('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el, i) { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else rv.forEach(function (el) { el.classList.add('in'); });

  // ---------- cookieless visit counter (same site only; no cookie, IP or id is kept) ----------
  // The browser keeps only "counted today" / "seen before" marks. ?yonetici=1 stops counting this browser (?yonetici=0 undoes it).
  (function () {
    var skip = !!navigator.webdriver;
    try {
      var u = new URL(location.href), y = u.searchParams.get('yonetici');
      if (y === '1' || y === '0') {
        if (y === '1') localStorage.setItem('hs-owner', '1'); else localStorage.removeItem('hs-owner');
        u.searchParams.delete('yonetici'); history.replaceState(null, '', u.pathname + u.search + u.hash);
      }
      if (localStorage.getItem('hs-owner') === '1') skip = true;
    } catch (e) {}
    if (skip || !navigator.sendBeacon) return;
    function send(t, extra) {
      try {
        var b = { t: t, p: location.pathname };
        for (var k in extra) b[k] = extra[k];
        navigator.sendBeacon('/s.php', new Blob([JSON.stringify(b)], { type: 'text/plain' }));
      } catch (e) {}
    }
    var visit = 0, day = 0, first = 0, ref = '';
    try { if (!sessionStorage.getItem('hs-s')) { sessionStorage.setItem('hs-s', '1'); visit = 1; } } catch (e) {}
    try {
      var d = new Date(), today = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      if (localStorage.getItem('hs-d') !== today) { localStorage.setItem('hs-d', today); day = 1; }
      if (!localStorage.getItem('hs-f')) { localStorage.setItem('hs-f', '1'); first = 1; }
    } catch (e) {}
    try { if (document.referrer) { var h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h; } } catch (e) {}
    send('sayfa', { y: visit, g: day, n: first, r: ref });
    document.addEventListener('click', function (e) { if (e.target.closest('a[href^="mailto:"]')) send('posta'); });
  })();

  // ---------- simulation ----------
  var dial = document.getElementById('dial');
  if (!dial) return;
  var T = window.SIM_T;
  if (!T) return;
  var NS = 'http://www.w3.org/2000/svg';
  var COL = { normal: 'var(--m-normal)', focus: 'var(--m-focus)', sleep: 'var(--m-sleep)', sports: 'var(--m-sports)' };
  // Example weekday plan (minutes from midnight)
  var PLAN = [[0, 420, 'sleep'], [420, 540, 'normal'], [540, 750, 'focus'], [750, 840, 'normal'], [840, 1080, 'focus'], [1080, 1200, 'normal'], [1200, 1320, 'sports'], [1320, 1440, 'sleep']];
  var DELIVERY = [750, 1080, 1260]; // 12:30, 18:00, 21:00
  // Example app types and their per-app rule
  var RULES = [['normal', 'hold', 5], ['sleep', 'hold', 5], ['focus', 'delivery', 3], ['sports', 'block', 3], ['sports', 'sports', 2], ['normal', 'never', 1], ['focus', 'system', 1]];
  var APPS = RULES.map(function (r, i) { var a = T.apps[i]; return { k: a[0], l: a[1], msg: a[2], c: COL[r[0]], rule: r[1], w: r[2] }; });
  var wsum = APPS.reduce(function (a, b) { return a + b.w; }, 0);

  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  var C = 170, R = 138, W = 22;
  function pt(min, r) { var a = (min / 1440) * Math.PI * 2 - Math.PI / 2; return [C + r * Math.cos(a), C + r * Math.sin(a)]; }
  function arc(a, b, r) {
    var p1 = pt(a, r), p2 = pt(b, r), large = (b - a) > 720 ? 1 : 0;
    return 'M' + p1[0] + ' ' + p1[1] + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + p2[0] + ' ' + p2[1];
  }
  el('circle', { cx: C, cy: C, r: R, fill: 'none', style: 'stroke:var(--track)', 'stroke-width': W }, dial);
  PLAN.forEach(function (p) { el('path', { d: arc(p[0] + 4, p[1] - 4, R), fill: 'none', style: 'stroke:' + COL[p[2]], 'stroke-width': W, 'stroke-linecap': 'round' }, dial); });
  [['00', 0], ['06', 360], ['12', 720], ['18', 1080]].forEach(function (h) {
    var q = pt(h[1], R - 34); var t = el('text', { x: q[0], y: q[1] + 5, 'text-anchor': 'middle' }, dial); t.textContent = h[0];
  });
  DELIVERY.forEach(function (d) { var q = pt(d, R); el('circle', { cx: q[0], cy: q[1], r: 7, style: 'fill:var(--gold);stroke:var(--hand-ring)', 'stroke-width': 2.5 }, dial); });
  var hand = el('circle', { r: 11, style: 'fill:var(--hand);stroke:var(--hand-ring)', 'stroke-width': 4 }, dial);
  var tNow = el('text', { x: C, y: C + 6, 'text-anchor': 'middle', 'class': 'now' }, dial);
  var tMode = el('text', { x: C, y: C + 36, 'text-anchor': 'middle', 'class': 'sub' }, dial);
  var tNext = el('text', { x: C, y: C + 58, 'text-anchor': 'middle', 'class': 'sub2' }, dial);

  var $ = function (id) { return document.getElementById(id); };
  var nowList = $('now'), wait = $('wait'), empty = $('empty'), legend = $('legend').children;
  var playBtn = $('play'), fastBtn = $('fast');
  var t, waiting, st, running = !reduce, speed = 1, last = 0, nextSpawn;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(m) { m = Math.floor(m) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function modeAt(m) { for (var i = 0; i < PLAN.length; i++) if (m >= PLAN[i][0] && m < PLAN[i][1]) return PLAN[i][2]; return 'normal'; }
  function nextDelivery(m) { for (var i = 0; i < DELIVERY.length; i++) if (DELIVERY[i] > m) return DELIVERY[i]; return null; }
  function pick() { var r = Math.random() * wsum; for (var i = 0; i < APPS.length; i++) { r -= APPS[i].w; if (r <= 0) return APPS[i]; } return APPS[0]; }

  // Decide what happens to a notification (example rules)
  function decide(app, mode) {
    if (app.rule === 'system') return ['now', T.system];
    if (app.rule === 'never') return ['now', T.never];
    if (app.rule === 'block') return ['block', T.block];
    if (app.rule === 'sports') return mode === 'sports' ? ['hold', T.spoiler] : ['now', T.now];
    if (app.rule === 'delivery') return ['hold', T.delivery];
    if (mode === 'focus' || mode === 'sleep') return ['hold', T.modeFmt.replace('{m}', T.mode[mode])];
    return ['now', T.now];
  }

  function noteEl(app, title, tag, cls) {
    var li = document.createElement('li'); li.className = 'note' + (cls ? ' ' + cls : '');
    var av = document.createElement('span'); av.className = 'av'; av.style.background = app.c; av.textContent = app.l;
    var tx = document.createElement('span'); var b = document.createElement('b'); b.textContent = app.k; var em = document.createElement('em'); em.textContent = title + ' · ' + hm(t);
    tx.appendChild(b); tx.appendChild(em);
    var tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = tag;
    li.appendChild(av); li.appendChild(tx); li.appendChild(tg); return li;
  }
  function pushNow(li) { nowList.insertBefore(li, nowList.firstChild); while (nowList.children.length > 5) nowList.removeChild(nowList.lastChild); }
  function layoutStack() {
    var n = waiting.length; empty.style.display = n ? 'none' : '';
    waiting.forEach(function (w, i) {
      var depth = n - 1 - i; // newest on top
      w.li.style.zIndex = 100 - depth;
      w.li.style.transform = 'translateY(' + Math.min(depth, 6) * 10 + 'px) scale(' + (1 - Math.min(depth, 6) * 0.03) + ')';
      w.li.style.opacity = depth > 6 ? 0 : 1 - depth * 0.08;
    });
  }
  function stats() {
    $('s-arr').textContent = st.arr; $('s-now').textContent = st.now; $('s-held').textContent = st.batch; $('s-quiet').textContent = st.held + st.block;
  }
  function release(label) {
    if (!waiting.length) return;
    var keep = [], mode = modeAt(t);
    waiting.forEach(function (w) {
      if (w.app.rule === 'sports' && mode === 'sports') { keep.push(w); return; } // still no spoilers
      if (mode === 'sleep' && label !== 'morning') { keep.push(w); return; }
      w.li.remove(); st.batch++;
      pushNow(noteEl(w.app, w.title, label === 'morning' ? T.morning : T.batch + hm(t)));
    });
    waiting = keep; layoutStack(); stats();
    var lane = $('waitlane'); lane.classList.remove('flash'); void lane.offsetWidth; lane.classList.add('flash');
  }
  function spawn() {
    var app = pick(), mode = modeAt(t), d = decide(app, mode), title = app.msg[Math.floor(Math.random() * app.msg.length)];
    st.arr++;
    if (d[0] === 'now') { st.now++; pushNow(noteEl(app, title, d[1])); }
    else if (d[0] === 'block') { st.block++; pushNow(noteEl(app, title, d[1], 'blocked')); }
    else { st.held++; var li = noteEl(app, title, d[1]); wait.appendChild(li); waiting.push({ app: app, title: title, li: li }); layoutStack(); }
    stats();
  }
  function render() {
    var q = pt(t, R); hand.setAttribute('cx', q[0]); hand.setAttribute('cy', q[1]);
    var m = modeAt(t), nd = nextDelivery(t);
    tNow.textContent = hm(t); tMode.textContent = T.modeFmt.replace('{m}', T.mode[m]) + ' · ' + T.waitingFmt.replace('{n}', waiting.length);
    tNext.textContent = nd ? T.next + hm(nd) : T.untilMorning;
    $('nextdel').textContent = nd ? T.nextLow + hm(nd) : T.untilLow;
    for (var i = 0; i < legend.length; i++) legend[i].classList.toggle('on', legend[i].getAttribute('data-m') === m);
  }
  function reset() {
    t = 420; waiting = []; st = { arr: 0, now: 0, held: 0, block: 0, batch: 0 }; nextSpawn = t + 6;
    nowList.innerHTML = ''; Array.prototype.slice.call(wait.querySelectorAll('.note')).forEach(function (n) { n.remove(); });
    layoutStack(); stats(); render();
  }
  function step(dt) {
    var prev = t; t += dt;
    DELIVERY.forEach(function (d) { if (prev < d && t >= d) release('batch'); });
    if (prev < 1320 && t >= 1320) release('batch'); // sports mode ends: held sports alerts arrive
    while (t >= nextSpawn) { spawn(); nextSpawn += 8 + Math.random() * 26; }
    if (t >= 1440) { t = 1439.9; running = false; playBtn.textContent = T.again; playBtn.setAttribute('aria-pressed', 'false'); }
    render();
  }
  var visible = true;
  function loop(ts) {
    if (!last) last = ts;
    var dt = Math.min(100, ts - last); last = ts;
    if (running && visible) step(dt / 1000 * 16 * speed); // ~16 simulated minutes per second
    requestAnimationFrame(loop);
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(dial);

  playBtn.addEventListener('click', function () {
    if (t >= 1439) reset();
    running = !running; playBtn.textContent = running ? T.pause : T.play; playBtn.setAttribute('aria-pressed', String(running));
  });
  fastBtn.addEventListener('click', function () { speed = speed === 1 ? 3 : 1; fastBtn.setAttribute('aria-pressed', String(speed === 3)); });
  $('restart').addEventListener('click', function () { reset(); running = true; playBtn.textContent = T.pause; playBtn.setAttribute('aria-pressed', 'true'); });

  reset();
  if (reduce) { playBtn.textContent = T.play; playBtn.setAttribute('aria-pressed', 'false'); }
  requestAnimationFrame(loop);
})();
