(function () {
  'use strict';

  var document = window.document;
  if (document.querySelector('[data-gearly-bootstrap]') || window.Gearly) return;

  var source = new URL(document.currentScript.src);
  var base = new URL('.', source);
  var version = source.searchParams.get('v');
  var host = document.createElement('div');
  host.className = 'gearly-root';
  host.dataset.gearlyBootstrap = '';
  var launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'gearly-launcher';
  launcher.setAttribute('aria-label', 'Open Gearly, ASME website guide');
  var face = document.createElement('img');
  face.className = 'gearly-avatar-image';
  face.src = new URL('sprites/gearly-centered-idle.webp', base).href;
  face.alt = '';
  face.width = face.height = 72;
  var label = document.createElement('span');
  label.className = 'gearly-launcher-text';
  label.setAttribute('aria-hidden', 'true');
  label.textContent = 'Ask Gearly';
  launcher.append(face, label);
  var status = document.createElement('span');
  status.className = 'gearly-load-status';
  status.setAttribute('role', 'status');
  host.append(launcher, status);

  var main = document.querySelector('main');
  if (main) {
    host.classList.add('gearly-root--in-flow');
    main.append(host);
  } else {
    document.body.append(host);
  }

  var scriptLoads = new Map();
  var loading = null;
  var openRequested = false;

  function asset(name) {
    var url = new URL(name, base);
    if (version) url.searchParams.set('v', version);
    return url.href;
  }

  function loadScript(url, asynchronous) {
    if (!scriptLoads.has(url)) {
      var tag = document.createElement('script');
      tag.async = Boolean(asynchronous);
      tag.src = url;
      var result = new Promise(function (resolve, reject) {
        tag.onload = resolve;
        tag.onerror = function () {
          tag.remove();
          scriptLoads.delete(url);
          reject(new Error('Gearly script unavailable'));
        };
        document.head.append(tag);
      });
      scriptLoads.set(url, result);
    }
    return scriptLoads.get(url);
  }

  function loadTourStyles() {
    if (document.getElementById('gearly-tour-styles')) return;
    var style = document.createElement('link');
    style.id = 'gearly-tour-styles';
    style.rel = 'stylesheet';
    style.href = asset('gearly-tour.css');
    document.head.append(style);
  }

  function loadGuide() {
    if (loading) return;
    window.removeEventListener('scroll', loadAfterReading);
    launcher.setAttribute('aria-busy', 'true');
    if (openRequested) status.textContent = 'Opening Gearly…';
    loadTourStyles();

    var dependencies = [
      'gearly-tour.js', 'gearly-search.js', 'gearly-live.js', 'gearly-content.js',
      'gearly-weighting.js', 'gearly-site.js', 'gearly-student.js'
    ];
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.1.0/fuse.min.js', true).catch(function () {});
    var core = asset('gearly.js');
    loading = Promise.all(dependencies.map(function (name) { return loadScript(asset(name)); }))
      .then(function () { return loadScript(core); })
      .then(function () { return window.GearlyInitialization; })
      .then(function (guide) {
        if (!guide) {
          document.querySelectorAll('script[src]').forEach(function (tag) {
            if (tag.src === core) tag.remove();
          });
          scriptLoads.delete(core);
          throw new Error('Gearly guide unavailable');
        }
        if (openRequested) guide.open();
      })
      .catch(function () {
        launcher.removeAttribute('aria-busy');
        if (openRequested) status.textContent = 'Gearly could not load. Select Ask Gearly to retry.';
        openRequested = false;
        loading = null;
      });
  }

  function loadAfterReading() {
    if (window.scrollY >= 300) loadGuide();
  }

  launcher.addEventListener('click', function () {
    openRequested = true;
    status.textContent = 'Opening Gearly…';
    loadGuide();
  });
  var connection = window.navigator.connection;
  if (!(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType)))) {
    window.addEventListener('scroll', loadAfterReading, { passive: true });
    loadAfterReading();
  }
})();
