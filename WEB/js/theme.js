// Light / dark theme. Loaded as a plain (non-module) script in every page's
// <head> so the right theme is applied before anything is painted (no flash).
// The visitor's saved choice wins; otherwise the device's own light/dark setting.
(function () {
  var KEY = 'theme';

  function saved() {
    try { return localStorage.getItem(KEY); } catch (err) { return null; }
  }

  function prefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var button = document.getElementById('themeToggle');
    if (button) {
      var next = theme === 'dark' ? 'light' : 'dark';
      button.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      button.setAttribute('title', 'Switch to ' + next + ' mode');
    }
  }

  apply(saved() || (prefersDark() ? 'dark' : 'light'));

  document.addEventListener('DOMContentLoaded', function () {
    var bar = document.querySelector('.topbar-inner');
    if (!bar || document.getElementById('themeToggle')) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'themeToggle';
    button.className = 'theme-toggle';
    button.innerHTML =
      '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
      '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
    bar.appendChild(button);
    apply(document.documentElement.getAttribute('data-theme'));

    button.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (err) { /* private mode: still switches for this visit */ }
      apply(next);
    });
  });

  // Follow the device setting live, but only until the visitor has chosen themselves.
  if (window.matchMedia) {
    var query = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function (event) { if (!saved()) apply(event.matches ? 'dark' : 'light'); };
    if (query.addEventListener) query.addEventListener('change', onChange);
  }
})();
