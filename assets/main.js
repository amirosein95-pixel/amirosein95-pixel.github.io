(() => {
  const root = document.documentElement;

  // Signal that JS is ready so the staged hero entrance can play.
  // (Without JS the hero stays visible — the hidden state only applies under .js.)
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('ready')));

  // Theme toggle — dark by default; the visitor's choice is remembered.
  document.querySelector('.theme')?.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Mobile menu — visible under 1000px via CSS; hidden on desktop.
  const menuBtn = document.querySelector('.menu');
  const mnav = document.querySelector('.mnav');
  if (menuBtn && mnav) {
    const openLabel = menuBtn.getAttribute('aria-label');
    const closeLabel = menuBtn.dataset.close || openLabel;
    const setOpen = (open) => {
      mnav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menuBtn.setAttribute('aria-label', open ? closeLabel : openLabel);
    };
    menuBtn.addEventListener('click', () => setOpen(!mnav.classList.contains('open')));
    mnav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    matchMedia('(min-width: 1001px)').addEventListener?.('change', (e) => { if (e.matches) setOpen(false); });
  }

  // Subtle reveal on scroll.
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
        el.style.transitionDelay = `${Math.min(siblings.indexOf(el), 5) * 50}ms`;
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // Animated stat counters — count up once when the stats bar enters view.
  // Final values always land exactly on the authored text (digits, +, separators kept).
  const stats = document.querySelector('.stats');
  if (stats && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const FA_D = '۰۱۲۳۴۵۶۷۸۹';
    const toFa = (s) => String(s).replace(/\d/g, (d) => FA_D[d]);
    const groupFa = (n) => toFa(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '٬'));
    const parse = (text) => {
      const m = text.match(/[0-9\u06F0-\u06F9][0-9\u06F0-\u06F9\u066C,\s]*[0-9\u06F0-\u06F9]|[0-9\u06F0-\u06F9]/);
      if (!m) return null;
      const target = parseInt(m[0].replace(/[^\d\u06F0-\u06F9]/g, '').replace(/[\u06F0-\u06F9]/g, (d) => FA_D.indexOf(d)), 10);
      if (!isFinite(target)) return null;
      return {
        target,
        prefix: text.slice(0, m.index),
        suffix: text.slice(m.index + m[0].length),
        fa: /[\u06F0-\u06F9]/.test(m[0]),
        grouped: /[,\u066C]/.test(m[0]),
      };
    };
    const format = (n, p) => {
      const s = p.grouped ? (p.fa ? groupFa(n) : n.toLocaleString('en-US')) : (p.fa ? toFa(n) : String(n));
      return p.prefix + s + p.suffix;
    };
    // Parse once up front — never re-parse the live (already formatted) text.
    const jobs = [...stats.querySelectorAll('dt')]
      .map((dt) => ({ dt, p: parse(dt.textContent) }))
      .filter((j) => j.p);
    if (!jobs.length) return;
    // Replayable: re-runs every time the stats bar re-enters the viewport.
    let counting = false;
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting || counting) return;
        counting = true;
        const t0 = performance.now(), dur = 2000;
        const tick = (now) => {
          const t = Math.min(1, Math.max(0, (now - t0) / dur));
          const eased = 1 - Math.pow(1 - t, 3);
          jobs.forEach(({ dt, p }) => { dt.textContent = format(Math.round(p.target * eased), p); });
          if (t < 1) requestAnimationFrame(tick);
          else { jobs.forEach(({ dt, p }) => { dt.textContent = format(p.target, p); }); counting = false; }
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.3 });
    cio.observe(stats);
  }

  // Scroll progress bar under the sticky header (rAF-throttled).
  const bar = document.querySelector('.progress');
  if (bar) {
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      bar.style.transform = `scaleX(${p})`;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // First-party visit counter — no cookies, skipped when Do Not Track is on.
  // ENDPOINT is rewritten to the mirror collector in the GitHub Pages build.
  // Form-encoded body (not JSON): keeps the request CORS-simple AND passes
  // OWASP CRS 920420, which blocks text/plain POST bodies on some hosts.
  const STATS_ENDPOINT = '/api/hit.php';
  try {
    if (navigator.doNotTrack !== '1' && STATS_ENDPOINT) {
      const payload = 'p=' + encodeURIComponent(location.pathname)
        + '&r=' + encodeURIComponent(document.referrer || '');
      if (navigator.sendBeacon) navigator.sendBeacon(STATS_ENDPOINT, new Blob([payload], { type: 'application/x-www-form-urlencoded' }));
      else fetch(STATS_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: payload, keepalive: true });
    }
  } catch (e) {}

  // Copy e-mail address.
  document.querySelectorAll('[data-copy]').forEach((b) => {
    const label = b.textContent;
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
      } catch (e) {
        const t = document.createElement('textarea');
        t.value = b.dataset.copy;
        document.body.appendChild(t);
        t.select();
        try { document.execCommand('copy'); } catch (err) {}
        t.remove();
      }
      b.textContent = b.dataset.done;
      setTimeout(() => { b.textContent = label; }, 2000);
    });
  });

  // Highlight the nav link of the section in view.
  const links = [...document.querySelectorAll('.nav a, .mnav a')];
  const map = { about: 'approach', ventures: 'experience', timeline: 'media', education: 'media', languages: 'media', interests: 'media' };
  if ('IntersectionObserver' in window) {
    const so = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = map[e.target.id] || e.target.id;
        links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${id}`));
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    document.querySelectorAll('main section[id]').forEach((s) => so.observe(s));
  }
})();
