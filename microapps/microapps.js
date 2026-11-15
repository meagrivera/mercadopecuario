// microapps.js — Compartir y contador de descargas de las microapps.
// Contador:
// Combina dos fuentes y muestra la cifra más alta:
//  1. Clics en el botón "Descargar", contados al instante con Abacus (abacus.jasoncameron.dev).
//  2. Descargas del APK en los releases de GitHub (exactas, pero GitHub las actualiza con retraso).
//     Se suman todas las versiones cuyo archivo empieza con el nombre de la app (vendo-mi-vaca*.apk).
(function () {
  // Enlaces viejos (/microapps/#vendo-mi-vaca) -> página propia de la app
  var hash = location.hash.replace('#', '');
  if (/^\/microapps\/?(index\.html)?$/.test(location.pathname) && /^[a-z-]+$/.test(hash) &&
      document.querySelector('.app-card[id="' + hash + '"]')) {
    location.replace('/microapps/' + hash + '/');
    return;
  }

  // Botones de compartir
  document.querySelectorAll('[data-share-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-share-copy');
      var label = btn.querySelector('.share-label');
      var done = function () {
        if (!label) return;
        var old = label.textContent;
        label.textContent = '¡Copiado!';
        setTimeout(function () { label.textContent = old; }, 2000);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copia el enlace:', url); });
      } else {
        window.prompt('Copia el enlace:', url);
      }
    });
  });

  if (navigator.share) {
    document.querySelectorAll('[data-share-native]').forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        navigator.share({
          title: btn.getAttribute('data-title'),
          text: btn.getAttribute('data-text'),
          url: btn.getAttribute('data-url')
        }).catch(function () {});
      });
    });
  }

  var GITHUB = 'https://api.github.com/repos/meagrivera/mercadopecuario/releases?per_page=100';
  var ABACUS = 'https://abacus.jasoncameron.dev';
  var NS = 'mercadopecuario.com';

  var counts = {}; // app -> { clicks, github }

  function show(app) {
    var c = counts[app] || {};
    var n = Math.max(c.clicks || 0, c.github || 0);
    document.querySelectorAll('.app-downloads[data-app="' + app + '"]').forEach(function (el) {
      el.querySelector('.app-downloads-num').textContent = n.toLocaleString('es-NI');
      el.querySelector('.app-downloads-label').textContent = n === 1 ? 'descarga' : 'descargas';
      el.hidden = false;
    });
  }

  function set(app, source, value) {
    counts[app] = counts[app] || {};
    counts[app][source] = value;
    show(app);
  }

  function getJSON(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }

  var apps = [];
  document.querySelectorAll('.app-downloads[data-app]').forEach(function (el) {
    if (apps.indexOf(el.dataset.app) < 0) apps.push(el.dataset.app);
  });
  if (!apps.length) return;

  apps.forEach(function (app) {
    getJSON(ABACUS + '/get/' + NS + '/' + app)
      .then(function (d) { set(app, 'clicks', d.value || 0); })
      .catch(function () {});
  });

  getJSON(GITHUB)
    .then(function (releases) {
      apps.forEach(function (app) {
        var total = 0;
        releases.forEach(function (r) {
          (r.assets || []).forEach(function (a) {
            if (a.name.indexOf(app) === 0 && /\.apk$/i.test(a.name)) total += a.download_count;
          });
        });
        set(app, 'github', total);
      });
    })
    .catch(function () {});

  document.querySelectorAll('[data-app-download]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var app = btn.dataset.appDownload;
      var c = counts[app] || {};
      set(app, 'clicks', (c.clicks || 0) + 1); // subir el número en pantalla al instante
      fetch(ABACUS + '/hit/' + NS + '/' + app, { keepalive: true })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.value) set(app, 'clicks', d.value); })
        .catch(function () {});
    });
  });
})();
