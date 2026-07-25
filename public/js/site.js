/* site.js — OddCoop public site chrome + coop token hydration */
(function () {

  // ── coop token hydration ──────────────────────────────────────────────────
  // Replaces every {{COOP_NAME}}, {{COOP_MARKET}}, {{COOP_CORRIDOR}} text node
  // on the page with live data from /api/coop.
  async function hydrateCoop() {
    let coop;
    try {
      const res = await fetch('/api/coop');
      coop = await res.json();
    } catch (e) {
      console.warn('coop hydration failed', e);
      return;
    }

    const tokens = {
      '{{COOP_NAME}}':      coop.name      || 'OddCoop',
      '{{COOP_MARKET}}':   coop.market    || '',
      '{{COOP_CORRIDOR}}': coop.corridor  || '',
    };

    // Walk all text nodes in the document and replace tokens
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        let val = node.nodeValue;
        let changed = false;
        for (const [tok, rep] of Object.entries(tokens)) {
          if (val.includes(tok)) { val = val.split(tok).join(rep); changed = true; }
        }
        if (changed) node.nodeValue = val;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Also patch attributes (placeholder, title, content, href)
        for (const attr of ['placeholder', 'title', 'content', 'aria-label', 'alt']) {
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

    // Also patch document.title
    let t = document.title;
    for (const [tok, rep] of Object.entries(tokens)) t = t.split(tok).join(rep);
    document.title = t;

    // Set CSS custom property so inline styles can use it
    if (coop.color) document.documentElement.style.setProperty('--brand', coop.color);
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

  // Run hydration immediately (non-blocking)
  hydrateCoop();
})();
