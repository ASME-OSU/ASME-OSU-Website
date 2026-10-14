/* Public data only. Never query the member system or execute a JSONP response. */
(function (root) {
  'use strict';
  var baseURL = 'https://asme-osu.github.io/ASME-OSU-Website/';
  var sheet = 'https://docs.google.com/spreadsheets/d/1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg/gviz/tq';
  var cache = Object.create(null), pending = Object.create(null), ttl = 60000;
  var pages = 'https://org.osu.edu/asme/';
  var companies = [];
  function words(value) { return clean(value, 2000).toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim(); }
  function mentions(text, alias) { var a=words(alias); return a && (' '+words(text)+' ').includes(' '+a+' '); }
  function knownCompany(text) { return companies.some(function(c){return c.aliases.some(function(a){return mentions(text,a);});}); }
  function clean(value, limit) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit || 400) : ''; }
  function safeURL(value, fallback) {
    try { var u = new URL(value); if (u.protocol === 'https:' && !u.username && !u.password && /^(org\.osu\.edu|calendar\.google\.com|www\.instagram\.com|instagram\.com|photos\.app\.goo\.gl|asme-osu\.github\.io)$/.test(u.hostname)) return u.href; } catch (_) {}
    return fallback;
  }
  var EVENT_TYPES = [
    { column: 7, label: 'General body meetings' },
    { column: 8, label: 'Social events / tabling' },
    { column: 9, label: 'Company info sessions' },
    { column: 10, label: 'Technical workshops' },
    { column: 11, label: 'Build nights / projects' },
    { column: 12, label: 'Volunteering / outreach' },
    { column: 13, label: 'Committee work sessions' }
  ];
  var memberRows = null, memberPending = null, memberTime = 0, memberGeneration = 0;
  function safeImageURL(value) {
    try {
      var image = new URL(value), base = new URL(baseURL);
      if (image.protocol === 'https:' && image.hostname === 'asme-osu.github.io' &&
          !image.username && !image.password &&
          image.pathname.startsWith(base.pathname.replace(/\/?$/, '/') + 'assets/gallery/')) return image.href;
    } catch (_) {}
    return null;
  }
  function imageFor(item, kind) {
    var src = kind === 'gallery' ? safeImageURL(item.thumbnailUrl) || safeImageURL(item.imageUrl) : safeImageURL(item.imageUrl);
    if (!src) return null;
    var image = { src: src, alt: clean(item.alt, 400) };
    var width = kind === 'instagram' ? item.imageWidth : item.width;
    var height = kind === 'instagram' ? item.imageHeight : item.height;
    if (Number.isInteger(width) && width > 0) image.width = width;
    if (Number.isInteger(height) && height > 0) image.height = height;
    return image;
  }
  var mediaStop = new Set(('a an the is are was what where when how can could would i we you me my our your please find show tell do does have information about on in to for of with photo photos picture pictures pics latest recent instagram post posts').split(' '));
  function mediaTokens(value) {
    return words(value).split(/\s+/).filter(function (word) { return word.length > 1 && !mediaStop.has(word); });
  }
  function easternDay(value) {
    var parsed = date(value);
    if (!parsed) return null;
    // All-day dates already describe a calendar day, rather than a UTC instant.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return Date.parse(value) / 86400000;
    var parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed).forEach(function (part) { parts[part.type] = part.value; });
    return Date.parse(parts.year + '-' + parts.month + '-' + parts.day) / 86400000;
  }
  function photoTitle(item, history, overrides) {
    var manual = clean(overrides[item.id], 150);
    if (manual) return manual;
    var day = easternDay(item.takenAt), closest = 2, matches = [];
    if (day !== null) history.forEach(function (event) {
      if (!event || event.cancelled === true || /^(cancelled|canceled)$/i.test(event.status || '')) return;
      var eventDay = easternDay(event.start);
      if (eventDay === null) return;
      var distance = Math.abs(day - eventDay);
      if (distance > 1) return;
      if (distance < closest) { closest = distance; matches = [event]; }
      else if (distance === closest) matches.push(event);
    });
    return (matches.length === 1 && clean(matches[0].title, 150)) || clean(item.alt || item.title, 150) || 'Chapter photo';
  }
  function mediaCards(kind, data, rows, options, history, overrides) {
    var terms = Array.from(new Set(mediaTokens(options.query)));
    var ranked = rows.filter(function (item) { return item && typeof item === 'object'; }).map(function (item, index) {
      var title = kind === 'gallery' ? photoTitle(item, history, overrides) : clean(item.title || item.alt, 150) || 'Chapter photo';
      var score = 0;
      [[title, 6], [item.title, 6], [item.alt, 5], [item.summary, 2], [item.caption, 1], [item.category, 3]].forEach(function (field) {
        var tokens = mediaTokens(field[0]);
        terms.forEach(function (term) { if (tokens.some(function (token) { return token === term || term.length >= 4 && token.startsWith(term); })) score += field[1]; });
      });
      return { item: item, title: title, score: score, index: index, time: +(date(kind === 'gallery' ? item.takenAt : item.timestamp) || 0) };
    });
    var matching = terms.length && ranked.some(function (entry) { return entry.score > 0; });
    if (matching) ranked = ranked.filter(function (entry) { return entry.score > 0; });
    ranked.sort(function (a, b) { return (matching ? b.score - a.score : 0) || b.time - a.time || Number(a.item.order || 0) - Number(b.item.order || 0) || a.index - b.index; });
    return { matching: !!matching, cards: ranked.slice(0, 3).map(function (entry) {
      var card = { title: entry.title, text: clean(entry.item.summary || entry.item.caption || entry.item.category), url: safeURL(kind === 'instagram' ? entry.item.permalink : data.albumUrl, kind === 'instagram' ? 'https://www.instagram.com/asmeohiostate/' : pages + 'pictures/') };
      var image = imageFor(entry.item, kind);
      if (image) card.image = image;
      return card;
    }) };
  }
  function normalizedName(value) {
    return clean(value, 100).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  }
  function oneEdit(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      if (++edits > 1) return false;
      if (a.length >= b.length) i++;
      if (b.length >= a.length) j++;
    }
    return edits + (i < a.length || j < b.length ? 1 : 0) <= 1;
  }
  function memberResult(rows, options) {
    var query = normalizedName(options.name), tokens = query.split(' ').filter(Boolean);
    var matches = [];
    if (options.selection) matches = rows.filter(function (row) { return row.selection === options.selection; });
    else if (tokens.length) {
      for (var level = 0; level < 4 && !matches.length; level++) {
        matches = rows.filter(function (row) {
          var name = normalizedName(row.name), parts = name.split(' ');
          if (level === 0) return name === query;
          return tokens.every(function (token) { return parts.some(function (part) {
            return level === 1 ? part === token : level === 2 ? part.startsWith(token) : part === token || token.length >= 4 && part.length >= 4 && oneEdit(token, part);
          }); });
        });
      }
    }
    if (matches.length > 5) return result('Please provide a last name or full name to narrow the public leaderboard search.', [], null, 'Public leaderboard');
    if (matches.length > 1) {
      var choices = result('Which one?', [], null, 'Public leaderboard');
      choices.candidates = matches.map(function (row) { return { label: row.name + (row.period ? ' · ' + row.period : ''), name: row.name, selection: row.selection }; });
      return choices;
    }
    if (!matches.length) {
      var missing = result('No public leaderboard entry matched that name. Try the Member Points page search.', [{ title: 'Search the public leaderboard', text: 'Use the page’s member search.', url: pages + 'member-points-page/#member-dashboard' }], null, 'Public leaderboard');
      missing.noMatch = true;
      return missing;
    }
    var row = matches[0];
    var breakdown = EVENT_TYPES.map(function (type) { var count = Number(cell(row.raw, type.column)); return Number.isFinite(count) && count > 0 ? type.label + ': ' + count : ''; }).filter(Boolean);
    var text = row.points + ' points · ' + row.events + ' events' + (row.period ? ' · ' + row.period : '') + (row.tier ? ' · ' + row.tier : '') + (row.topType ? ' · Top event type: ' + row.topType : '') + (breakdown.length ? '. ' + breakdown.join('; ') : '');
    return result('Matched a public leaderboard name; I cannot verify who is asking.', [{ title: row.name + ' · #' + row.rank, text: text, url: pages + 'member-points-page/' }], row.updated, 'Public leaderboard');
  }
  function loadMember(options) {
    return table('System_Status', 'select A,B where A is not null').then(function (statusRows) {
      var status = statusRows.find(function (row) { return clean(cell(row, 0)).toLowerCase() === 'system_status'; });
      if (!status || clean(cell(status, 1)).toUpperCase() !== 'LIVE') return result('The leaderboard is unavailable while the points system is not live.', [], null, 'Public leaderboard');
      if (memberRows && Date.now() - memberTime < ttl) return memberResult(memberRows, options);
      if (!memberPending) memberPending = table('Leaderboard_Public', 'select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O where B is not null').then(function (rows) {
        memberGeneration++;
        memberRows = rows.map(function (raw, index) {
          return { raw: raw, selection: 'public-row-' + memberGeneration + '-' + index, rank: Number(cell(raw, 0)), name: clean(cell(raw, 1), 100), period: clean(cell(raw, 2), 100), points: cell(raw, 3) === null ? NaN : Number(cell(raw, 3)), events: Number(cell(raw, 4)) || 0, tier: clean(cell(raw, 5)), updated: cell(raw, 6), topType: clean(cell(raw, 14)) };
        }).filter(function (row) { return row.name && Number.isFinite(row.points) && row.points >= 0 && Number.isInteger(row.rank) && row.rank > 0; });
        memberTime = Date.now();
        return memberRows;
      }).finally(function () { memberPending = null; });
      return memberPending.then(function (rows) { return memberResult(rows, options); });
    });
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
    if (kind === 'member') return loadMember(options);
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
    return Promise.all([
      request(new URL('data/' + paths[kind], baseURL).href),
      kind === 'gallery' ? request(new URL('data/calendar-history.json', baseURL).href).catch(function () { return {}; }) : Promise.resolve({}),
      kind === 'gallery' ? request(new URL('data/google-photos-titles.json', baseURL).href).catch(function () { return {}; }) : Promise.resolve({})
    ]).then(function (sources) {
      var data = sources[0], history = Array.isArray(sources[1].events) ? sources[1].events : [], overrides = sources[2];
      var rows = kind === 'events' ? data.events : data.items;
      if (!Array.isArray(rows)) throw new Error('Malformed feed');
      var updated = data.checkedAt || data.updatedAt || data.generatedAt;
      var cards;
      if (kind === 'events') {
        cards = rows.filter(function (e) { if (!e || e.cancelled === true || /^(cancelled|canceled)$/i.test(e.status || '') || !date(e.start) || !date(e.end || e.start) || date(e.end || e.start).getTime() < Date.now()) return false;
          var dayParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date(e.start));
          var parts = {}; dayParts.forEach(function (p) { parts[p.type] = p.value; });
          var day = parts.year + '-' + parts.month + '-' + parts.day;
          var range = options.dateRange || {};
          if (range.from && day < range.from || range.to && day > range.to) return false;
          var words = (clean(e.title) + ' ' + clean(e.description)).toLowerCase();
          var selected = companies.find(function(c){return c.id === options.company;});
          if (options.company && !(selected ? selected.aliases.some(function(a){return mentions(words,a);}) : mentions(words,options.company))) return false;
          if (options.eventType) {
            var type = options.eventType.toLowerCase();
            var patterns = { social: /\b(social|pickleball|casino|bowling|game night|picnic)\b/, workshop: /\b(workshop|tutorial|training|hands-on)\b/, company: /\b(company|employer|recruiting|recruiter|corporate|information session|info session)\b/, volunteering: /\b(volunteer|volunteering|community service)\b/, competition: /\b(competition|contest|design challenge|robotics competition)\b/, meeting: /\b(meeting|gbm|general body|chapter session)\b/ };
            if (!patterns[type] || !(patterns[type].test(words) || type === 'company' && knownCompany(words))) return false;
          }
          return true; }).sort(function (a, b) { return date(a.start) - date(b.start); }).slice(0, 3).map(function (e) {
          var when = date(e.start).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', ...(e.allDay ? {} : { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) });
          return { title: clean(e.title, 150) || 'Chapter event', text: when + (e.allDay ? ' · All day' : '') + (clean(e.location) ? ' · ' + clean(e.location) : ''), url: safeURL(e.url, pages + 'calendar/') };
        });
      } else {
        var media = mediaCards(kind, data, rows, options, history, overrides);
        cards = media.cards;
      }
      var labels = { events: 'Google Calendar · hourly snapshot', instagram: 'Instagram · snapshot every 6 hours', gallery: 'Public Google Photos · daily snapshot' };
      var value = result(cards.length ? (kind === 'events' ? 'Upcoming events in Eastern Time.' : (media.matching ? 'Closest matches from public chapter updates.' : 'Latest public chapter updates.')) : (kind === 'events' && (options.dateRange || options.eventType || options.company) ? 'No upcoming events match these filters in the public calendar snapshot. Open the calendar for all events.' : 'No public updates are available in this snapshot.'), cards, updated, labels[kind]);
      if (!cards.length && kind !== 'events') value.cards = [{ title: 'Open the source', text: 'See current public updates.', url: kind === 'instagram' ? 'https://www.instagram.com/asmeohiostate/' : kind === 'gallery' ? safeURL(data.albumUrl, pages + 'pictures/') : pages + 'calendar/' }];
      var maximumAge = kind === 'events' ? 3 * 3600000 : kind === 'instagram' ? 18 * 3600000 : 3 * 86400000;
      if (!value.updatedAt || Date.now() - date(value.updatedAt) > maximumAge) { value.stale = true; value.text += ' This snapshot may be out of date; open the source for current details.'; }
      return value;
    });
  }
  root.GearlyLive = {
    safeImageURL: safeImageURL,
    EVENT_TYPES: EVENT_TYPES,
    configure: function (options) { memberRows = null; memberTime = 0; if (options && Array.isArray(options.companies)) { companies=options.companies.filter(function(c){return c && typeof c.id === 'string' && typeof c.name === 'string';}).slice(0,100).map(function(c){return {id:clean(c.id,100),aliases:[c.name].concat(Array.isArray(c.aliases)?c.aliases:[]).filter(function(a){return typeof a === 'string' && a.trim().length >= 2;}).map(function(a){return clean(a,100);})};}); cache=Object.create(null); pending=Object.create(null); } if (options && options.baseURL) { var u = new URL(options.baseURL, root.location && root.location.href); if (!/^https?:$/.test(u.protocol)) throw new Error('Invalid feed base'); baseURL = u.href.replace(/\/?$/, '/'); cache = Object.create(null); pending = Object.create(null); } },
    load: function (kind, options) {
      options = options && typeof options === 'object' ? options : {};
      var range = options.dateRange && typeof options.dateRange === 'object' ? options.dateRange : null;
      var normalized = { company: clean(options.company, 100), eventType: clean(options.eventType, 60) };
      if (range) { normalized.dateRange = {}; ['from', 'to'].forEach(function (name) { if (typeof range[name] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(range[name])) normalized.dateRange[name] = range[name]; }); }
      normalized.query = clean(options.query, 200);
      normalized.name = clean(options.name, 60);
      normalized.selection = clean(options.selection, 100);
      var key = kind + (kind === 'events' || kind === 'gallery' || kind === 'instagram' ? JSON.stringify(normalized) : '');
      if (!['events', 'leaderboard', 'instagram', 'gallery', 'points', 'member'].includes(kind)) return Promise.resolve(result('This live source is not supported.', [], null, 'Unavailable'));
      if (kind === 'member') return feed(kind, normalized).catch(function () { return result('This public source is temporarily unavailable. Try again shortly or open its website.', [], null, 'Unavailable'); });
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
