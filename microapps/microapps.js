// Contador de descargas de las microapps.
// Los APK se publican como "releases" de GitHub; la API pública cuenta cada descarga.
// Se suman todas las versiones cuyo archivo empieza con el nombre de la app (p. ej. vendo-mi-vaca*.apk).
(function () {
  var API = 'https://api.github.com/repos/meagrivera/mercadopecuario/releases?per_page=100';
  var CACHE_KEY = 'mp-microapps-descargas';
  var CACHE_MS = 10 * 60 * 1000;

  var nodes = document.querySelectorAll('.app-downloads[data-app]');
  if (!nodes.length) return;

  function render(totals) {
    nodes.forEach(function (el) {
      var n = totals[el.dataset.app] || 0;
      el.querySelector('.app-downloads-num').textContent = n.toLocaleString('es-NI');
      el.querySelector('.app-downloads-label').textContent = n === 1 ? 'descarga' : 'descargas';
      el.hidden = false;
    });
  }

  function sum(releases) {
    var totals = {};
    nodes.forEach(function (el) {
      var app = el.dataset.app;
      totals[app] = 0;
      releases.forEach(function (r) {
        (r.assets || []).forEach(function (a) {
          if (a.name.indexOf(app) === 0 && /\.apk$/i.test(a.name)) totals[app] += a.download_count;
        });
      });
    });
    return totals;
  }

  try {
    var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && Date.now() - cached.t < CACHE_MS) { render(cached.totals); return; }
  } catch (e) {}

  fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (releases) {
      var totals = sum(releases);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), totals: totals })); } catch (e) {}
      render(totals);
    })
    .catch(function () { /* Sin conexión o límite de la API: se deja oculto el contador. */ });
})();
