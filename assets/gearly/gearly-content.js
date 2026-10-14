(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GearlyContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var cache = new Map();
  var MAX_BYTES = 2 * 1024 * 1024;
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function normalize(value) {
    return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function contains(text, phrase) { return (' ' + normalize(text) + ' ').includes(' ' + normalize(phrase) + ' '); }
  function roleFor(title, roles) {
    var candidates = [];
    (roles || []).forEach(function (role) {
      [role.id].concat(role.aliases || []).forEach(function (alias) {
        if (contains(title, alias)) candidates.push({ id: role.id, length: normalize(alias).length });
      });
    });
    candidates.sort(function (a, b) { return b.length - a.length; });
    return candidates.length ? candidates[0].id : normalize(title).replace(/ /g, '-');
  }
  function parseLeadership(documentOrHtml, roles) {
    var doc = documentOrHtml;
    if (typeof doc === 'string') {
      if (!root.DOMParser) throw new Error('DOMParser is required to parse HTML');
      doc = new root.DOMParser().parseFromString(doc, 'text/html');
    }
    function board(element, current) {
      if (!element) return null;
      var heading = clean(element.querySelector('h2')?.textContent);
      var years = heading.match(/(\d{4})\s*[–—-]\s*(\d{4})/);
      if (!years) return null;
      var officers = Array.from(element.querySelectorAll('.lb-grid > article.leader-card')).map(function (card) {
        var role = clean(card.querySelector('h3')?.textContent);
        var name = clean(card.querySelector('h4')?.textContent);
        if (!role || !name) return null;
        var officer = { role: role, roleId: roleFor(role, roles), name: name };
        if (current) {
          var href = card.querySelector('a[href^="mailto:"]')?.getAttribute('href') || '';
          var email = href.slice(7).split('?')[0];
          officer.email = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email) ? email : '';
          officer.photo = card.querySelector('.leader-photo')?.getAttribute('src') || '';
        }
        return officer;
      }).filter(Boolean);
      return { label: years[1] + '–' + years[2], startYear: Number(years[1]), endYear: Number(years[2]), officers: officers };
    }
    if (!doc?.querySelector) return { current: null, past: [] };
    return {
      current: board(doc.querySelector('.lb-current-year'), true),
      past: Array.from(doc.querySelectorAll('.lb-year-panel')).map(function (element) { return board(element, false); }).filter(Boolean)
    };
  }
  function resolveLeadership(snapshot, query, options) {
    options = options || {};
    var current = snapshot?.current;
    var boards = (current ? [current] : []).concat(snapshot?.past || []);
    var q = normalize(query);
    var url = new URL('leadership/', options.siteBase || 'https://org.osu.edu/asme/').href;
    var cards = [{ title: 'Leadership and past boards', url: url }];
    var unmatched = { matched: false, text: '', cards: cards };
    if (!boards.length) return unmatched;
    var range = clean(query).match(/\b(20\d{2}|19\d{2})\s*[–—-]\s*(\d{4}|\d{2})\b/);
    var selected = boards;
    var historical = false;
    if (range) {
      var end = range[2].length === 2 ? Number(range[1].slice(0, 2) + range[2]) : Number(range[2]);
      selected = boards.filter(function (board) { return board.startYear === Number(range[1]) && board.endYear === end; });
      historical = true;
    } else if (/\b(last year|last years|previous board)\b/.test(q)) {
      selected = (snapshot.past || []).slice().sort(function (a, b) { return b.startYear - a.startYear; }).slice(0, 1);
      historical = true;
    } else {
      var year = q.match(/\b(20\d{2}|19\d{2})\b/);
      if (year) {
        selected = boards.filter(function (board) { return board.startYear === Number(year[1]) || board.endYear === Number(year[1]); });
        historical = true;
      }
    }
    var roleId = options.roleId || roleFor(query, options.roles);
    var roleTitles = boards.flatMap(function (board) { return board.officers; }).filter(function (officer) { return contains(query, officer.role); });
    if (roleTitles.length) roleId = roleTitles.sort(function (a, b) { return b.role.length - a.role.length; })[0].roleId;
    var roleKnown = boards.some(function (board) { return board.officers.some(function (officer) { return officer.roleId === roleId; }); });
    var named = boards.flatMap(function (board) {
      return board.officers.filter(function (officer) { return contains(query, officer.name); }).map(function (officer) { return { board: board, officer: officer }; });
    });
    if (named.length && !historical) {
      return { matched: true, text: named.map(function (entry) {
        return entry.officer.name + ': ' + entry.officer.role + ' (' + entry.board.label + ')' + (entry.board === current && entry.officer.email ? '. Public email: ' + entry.officer.email : '');
      }).join('\n'), cards: cards };
    }
    if (!historical) selected = current ? [current] : [];
    if (!roleKnown && !historical && !/\b(officers|board|leadership|ran asme)\b/.test(q)) return unmatched;
    var lines = selected.flatMap(function (board) {
      return board.officers.filter(function (officer) { return !roleKnown || officer.roleId === roleId; }).map(function (officer) {
        return officer.name + ' is the ' + board.label + ' ' + officer.role + '.' + (board === current && officer.email ? ' Public email: ' + officer.email + '.' : '');
      });
    });
    return lines.length ? { matched: true, text: lines.join('\n'), cards: cards } : unmatched;
  }
  async function request(url, options) {
    var controller = new AbortController();
    var timeout = new Promise(function (_, reject) {
      var timer = setTimeout(function () { controller.abort(); reject(new Error('Leadership request timed out')); }, 8000);
      controller.timer = timer;
    });
    try {
      return await Promise.race([timeout, (async function () {
        var response = await (options.fetch || root.fetch)(url, { signal: controller.signal, credentials: 'omit', redirect:'error' });
        if (!response.ok) throw new Error('Leadership source unavailable');
        if (Number(response.headers?.get('content-length')) > MAX_BYTES) throw new Error('Leadership source too large');
        var text = await response.text();
        if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Leadership source too large');
        return text;
      })()]);
    } finally { clearTimeout(controller.timer); }
  }
  async function loadLeadership(options) {
    options = options || {};
    var base = new URL(options.siteBase || 'https://org.osu.edu/asme/');
    var origin = options.origin || root.location?.origin || base.origin;
    var key = base.href + JSON.stringify(options.roles || []);
    var entry = cache.get(key);
    if (entry && Date.now() - entry.at < 600000) return entry.value;
    var value;
    try {
      if (base.origin !== origin) throw new Error('Leadership must use the same origin');
      var html = await request(new URL('leadership/', base).href, options);
      var Parser = options.DOMParser || root.DOMParser;
      if (!Parser) throw new Error('DOMParser unavailable');
      value = parseLeadership(new Parser().parseFromString(html, 'text/html'), options.roles);
      if (!value.current?.officers.length) throw new Error('Leadership page has no current officers');
    } catch (_) {
      if (options.snapshot) value = options.snapshot;
      else value = JSON.parse(await request(new URL(options.snapshotURL || 'assets/gearly/gearly-officers.json', options.assetBase || base).href, options));
    }
    cache.set(key, { at: Date.now(), value: value });
    return value;
  }
  return { parseLeadership: parseLeadership, resolveLeadership: resolveLeadership, loadLeadership: loadLeadership, clearCache: function () { cache.clear(); } };
});
