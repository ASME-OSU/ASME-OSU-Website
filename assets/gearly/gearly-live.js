/* Public data only. Never query the member system or execute a JSONP response. */
(function (root) {
  'use strict';
  var baseURL = 'https://asme-osu.github.io/ASME-OSU-Website/';
  var sheet = 'https://docs.google.com/spreadsheets/d/1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg/gviz/tq';
  var cache = Object.create(null), pending = Object.create(null), ttl = 60000;
  var pages = 'https://org.osu.edu/asme/';
  function clean(value, limit) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit || 400) : ''; }
  function safeURL(value, fallback) {
    try { var u = new URL(value); if (u.protocol === 'https:' && !u.username && !u.password && /^(org\.osu\.edu|calendar\.google\.com|www\.instagram\.com|instagram\.com|photos\.app\.goo\.gl|asme-osu\.github\.io)$/.test(u.hostname)) return u.href; } catch (_) {}
    return fallback;
  }
  function date(value) { var d = new Date(value); return value && Number.isFinite(d.getTime()) ? d : null; }
  function stamp(value) { var d = date(value); return d ? d.toISOString() : null; }
  function request(url, gviz) {
    var controller = new AbortController();
    var timer;
    return Promise.race([
      root.fetch(url, { cache: 'no-store', credentials: 'omit', signal: controller.signal }).then(function (response) {
        if (!response.ok) throw new Error('Source unavailable');
        return response.text();
      }).then(function (body) {
        if (body.length > 2000000) throw new Error('Oversized source');
        if (gviz) { var match = body.match(/^\s*(?:\/\*[^]*?\*\/\s*)?google\.visualization\.Query\.setResponse\(([^]*)\);?\s*$/); if (!match) throw new Error('Malformed sheet response'); body = match[1]; }
        var data = JSON.parse(body); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Malformed source');
        if (gviz && (data.status !== 'ok' || !data.table || !Array.isArray(data.table.rows))) throw new Error('Invalid public table');
        return gviz ? data.table.rows : data;
      }),
      new Promise(function (_, reject) { timer = setTimeout(function () { controller.abort(); reject(new Error('Source timed out')); }, 8000); })
    ]).finally(function () { clearTimeout(timer); });
  }
  function table(name, query) { return request(sheet + '?headers=1&sheet=' + encodeURIComponent(name) + '&tq=' + encodeURIComponent(query) + '&tqx=out:json', true); }
  function cell(row, index) { return row && Array.isArray(row.c) && row.c[index] ? row.c[index].v : null; }
  function result(text, cards, updatedAt, sourceLabel) { return { text: text, cards: cards, updatedAt: stamp(updatedAt), sourceLabel: sourceLabel }; }
  function feed(kind, options) {
    if (kind === 'leaderboard' || kind === 'points') {
      if (kind === 'points') return table('Point_Values_Public', 'select A,B,C,D,E,F where B is not null').then(function (rows) {
        return result('Current public point values.', rows.map(function (r) { return { title: clean(cell(r, 4)) || clean(cell(r, 1)), text: Number.isFinite(Number(cell(r, 2))) && cell(r, 2) !== null ? String(Number(cell(r, 2))) + ' points' : '', url: pages + 'member-points-page/' }; }).filter(function (r) { return r.title && r.text; }).slice(0, 12), null, 'Public point values · read on request');
      });
      return table('System_Status', 'select A,B where A is not null').then(function (rows) {
        var status = rows.find(function (r) { return clean(cell(r, 0)).toLowerCase() === 'system_status'; });
        if (!status || clean(cell(status, 1)).toUpperCase() !== 'LIVE') return result('The leaderboard is unavailable while the points system is not live.', [], null, 'Public leaderboard');
        return table('Leaderboard_Public', 'select A,B,C,D where B is not null').then(function (members) {
          var cards = members.map(function (r) { return { rank: Number(cell(r, 0)), title: clean(cell(r, 1), 100), points: cell(r, 3) === null ? NaN : Number(cell(r, 3)) }; }).filter(function (r) { return r.title && Number.isInteger(r.rank) && r.rank > 0 && Number.isFinite(r.points) && r.points >= 0; }).sort(function (a, b) { return a.rank - b.rank; }).slice(0, 10).map(function (r) { return { title: '#' + r.rank + ' ' + r.title, text: r.points + ' verified points', url: pages + 'member-points-page/' }; });
          return result(cards.length ? 'Top verified public leaderboard totals.' : 'No public leaderboard totals are available yet.', cards, null, 'Sanitized public leaderboard · read on request');
        });
      });
    }
    var paths = { events: 'calendar-events.json', instagram: 'instagram-feed.json', gallery: 'google-photos-feed.json' };
    return request(new URL('data/' + paths[kind], baseURL).href).then(function (data) {
      var rows = kind === 'events' ? data.events : data.items;
      if (!Array.isArray(rows)) throw new Error('Malformed feed');
      var updated = data.checkedAt || data.updatedAt || data.generatedAt;
      var cards;
      if (kind === 'events') {
        cards = rows.filter(function (e) { if (!e || !date(e.start) || !date(e.end || e.start) || date(e.end || e.start).getTime() < Date.now()) return false;
          var dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date(e.start));
          var parts = {}; dayParts.forEach(function (p) { parts[p.type] = p.value; });
          var day = parts.year + '-' + parts.month + '-' + parts.day;
          var range = options.dateRange || {};
          if (range.from && day < range.from || range.to && day > range.to) return false;
          var words = (clean(e.title) + ' ' + clean(e.description)).toLowerCase();
          if (options.company && !words.includes(options.company.toLowerCase())) return false;
          if (options.eventType) {
            var type = options.eventType.toLowerCase();
            var patterns = { social: /\b(social|pickleball|casino|bowling|game night|picnic)\b/, workshop: /\b(workshop|tutorial|training|hands-on)\b/, company: /\b(company|employer|recruiting|recruiter|corporate|information session|info session)\b/, volunteering: /\b(volunteer|volunteering|community service)\b/, competition: /\b(competition|contest|design challenge|robotics competition)\b/, meeting: /\b(meeting|gbm|general body|chapter session)\b/ };
            if (!patterns[type] || !patterns[type].test(words)) return false;
          }
          return true; }).sort(function (a, b) { return date(a.start) - date(b.start); }).slice(0, 5).map(function (e) {
          var when = date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', ...(e.allDay ? {} : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) });
          return { title: clean(e.title, 150) || 'Chapter event', text: when + (e.allDay ? ' · All day' : '') + (clean(e.location) ? ' · ' + clean(e.location) : ''), url: safeURL(e.url, pages + 'calendar/') };
        });
      } else cards = rows.filter(function (e) { return e && typeof e === 'object'; }).slice().sort(function (a, b) { return kind === 'instagram' ? (date(b.timestamp) || 0) - (date(a.timestamp) || 0) : Number(a.order || 0) - Number(b.order || 0); }).slice(0, 5).map(function (e) {
        return { title: clean(e.title || e.alt, 150) || 'Chapter photo', text: clean(e.summary || e.caption || e.category), url: safeURL(kind === 'instagram' ? e.permalink : data.albumUrl, kind === 'instagram' ? 'https://www.instagram.com/asmeohiostate/' : pages + 'gallery/') };
      });
      var labels = { events: 'Google Calendar · hourly snapshot', instagram: 'Instagram · snapshot every 6 hours', gallery: 'Public Google Photos · daily snapshot' };
      var value = result(cards.length ? (kind === 'events' ? 'Upcoming events in Eastern Time.' : 'Latest public chapter updates.') : (kind === 'events' && (options.dateRange || options.eventType || options.company) ? 'No upcoming events match these filters in the public calendar snapshot. Open the calendar for all events.' : 'No public updates are available in this snapshot.'), cards, updated, labels[kind]);
      var maximumAge = kind === 'events' ? 3 * 3600000 : kind === 'instagram' ? 18 * 3600000 : 3 * 86400000;
      if (!value.updatedAt || Date.now() - date(value.updatedAt) > maximumAge) { value.stale = true; value.text += ' This snapshot may be out of date; open the source for current details.'; }
      return value;
    });
  }
  root.GearlyLive = {
    configure: function (options) { if (options && options.baseURL) { var u = new URL(options.baseURL, root.location && root.location.href); if (!/^https?:$/.test(u.protocol)) throw new Error('Invalid feed base'); baseURL = u.href.replace(/\/?$/, '/'); cache = Object.create(null); pending = Object.create(null); } },
    load: function (kind, options) {
      options = options && typeof options === 'object' ? options : {};
      var range = options.dateRange && typeof options.dateRange === 'object' ? options.dateRange : null;
      var normalized = { company: clean(options.company, 100), eventType: clean(options.eventType, 60) };
      if (range) { normalized.dateRange = {}; ['from', 'to'].forEach(function (name) { if (typeof range[name] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(range[name])) normalized.dateRange[name] = range[name]; }); }
      var key = kind + (kind === 'events' ? JSON.stringify(normalized) : '');
      if (!['events', 'leaderboard', 'instagram', 'gallery', 'points'].includes(kind)) return Promise.resolve(result('This live source is not supported.', [], null, 'Unavailable'));
      if (cache[key] && Date.now() - cache[key].time < ttl) return Promise.resolve(cache[key].value);
      if (pending[key]) return pending[key];
      pending[key] = feed(kind, normalized).then(function (value) { cache[key] = { time: Date.now(), value: value }; return value; }).catch(function () {
        // Never retain leaderboard totals after a failed status check.
        if (cache[key] && kind !== 'leaderboard') return Object.assign({}, cache[key].value, { stale: true, text: 'The source could not be refreshed. Showing the last snapshot; open the source for current details.' });
        return result('This public source is temporarily unavailable. Try again shortly or open its website.', [], null, 'Unavailable');
      }).finally(function () { delete pending[key]; });
      return pending[key];
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
