/* theme.js — standalone dark/light mode toggle.
 * Extracted from site.js so quote.html can load it independently.
 * The theme is stored in sessionStorage (not localStorage — avoids iframe issues).
 */
(function () {
  const root = document.documentElement;

  function getTheme() {
    try {
      const stored = sessionStorage.getItem('oc_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_e) { /* storage unavailable */ }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    window._ocTheme = t;
    try { sessionStorage.setItem('oc_theme', t); } catch (_e) { /* storage unavailable */ }
  }

  applyTheme(getTheme());

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    syncIcon(btn, getTheme());
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      syncIcon(btn, next);
    });
  });

  function syncIcon(btn, t) {
    btn.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' mode');
    btn.innerHTML = t === 'dark'
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  window.OC = window.OC || {};
  window.OC.getTheme  = getTheme;
  window.OC.applyTheme = applyTheme;
})();
