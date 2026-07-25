/* site.js — OddCoop public site chrome + coop token hydration */
(function () {

  // ── coop token hydration ──────────────────────────────────────────────────
  async function hydrateCoop() {
    let coop;
    try {
      const res = await fetch('/api/coop');
      coop = await res.json();
    } catch (e) {
      console.warn('coop hydration failed', e);
      return;
    }

    const name   = coop.name        || 'OddCoop';
    const color  = coop.color       || '#2d8b8b';
    const letter = coop.logo_letter || name[0].toUpperCase();

    const tokens = {
      '{{COOP_NAME}}':        name,
      '{{COOP_MARKET}}':      coop.market   || '',
      '{{COOP_CORRIDOR}}':    coop.corridor || '',
      '{{COOP_COLOR}}':       color,
      '{{COOP_LOGO_LETTER}}': letter,
    };

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        let val = node.nodeValue;
        let changed = false;
        for (const [tok, rep] of Object.entries(tokens)) {
          if (val.includes(tok)) { val = val.split(tok).join(rep); changed = true; }
        }
        if (changed) node.nodeValue = val;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (const attr of ['placeholder', 'title', 'content', 'aria-label', 'alt', 'fill', 'href']) {
          const v = node.getAttribute(attr);
          if (!v) continue;
          let nv = v;
          for (const [tok, rep] of Object.entries(tokens)) nv = nv.split(tok).join(rep);
          if (nv !== v) node.setAttribute(attr, nv);
        }
        for (const child of node.childNodes) walk(child);
      }
    }
    walk(document.body);

    // patch title
    let t = document.title;
    for (const [tok, rep] of Object.entries(tokens)) t = t.split(tok).join(rep);
    document.title = t;

    // CSS var + meta theme-color
    document.documentElement.style.setProperty('--brand', color);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', color);
  }

  // ── mobile nav ────────────────────────────────────────────────────────────
  function initNav(topbar) {
    const toggle = topbar.querySelector('.nav-toggle');
    const panel  = topbar.querySelector('.nav-panel');
    if (!toggle || !panel) return;

    function setOpen(open) {
      topbar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', () => setOpen(!topbar.classList.contains('is-open')));
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });

    const mq = window.matchMedia('(min-width: 900px)');
    const onChange = () => { if (mq.matches) setOpen(false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
  }

  document.querySelectorAll('.topbar').forEach(initNav);
  hydrateCoop();
})();
