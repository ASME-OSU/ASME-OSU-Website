(function () {
  'use strict';

  function start() {
    var app = document.getElementById('asmePointsApp');
    var rowsEl = document.getElementById('asmeLeaderboardRows');
    if (!app || !rowsEl) return;

    var EXPORT_ID = '1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg';
    var base = 'https://docs.google.com/spreadsheets/d/' + EXPORT_ID + '/gviz/tq';
    var statusBadge = document.getElementById('asmePointsStatusBadge');
    var leaderboardBadge = document.getElementById('asmeLeaderboardStatus');
    var notice = document.getElementById('asmePointsNotice');
    var caption = document.getElementById('asmeLeaderboardCaption');
    var valuesGrid = document.getElementById('asmePointValuesGrid');
    var title = document.getElementById('asmeLeaderboardTitle');

    function jsonp(sheet, query) {
      return new Promise(function (resolve, reject) {
        var key = '__asmeSheet_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        var script = document.createElement('script');
        var timer = setTimeout(function () { cleanup(); reject(new Error('Sheet request timed out')); }, 8000);
        function cleanup() { clearTimeout(timer); delete window[key]; if (script.parentNode) script.parentNode.removeChild(script); }
        window[key] = function (data) { cleanup(); resolve(data); };
        script.onerror = function () { cleanup(); reject(new Error('Sheet request failed')); };
        script.src = base + '?sheet=' + encodeURIComponent(sheet) + '&headers=1&tqx=' + encodeURIComponent('out:json;responseHandler:' + key) + '&tq=' + encodeURIComponent(query) + '&_=' + Date.now();
        document.head.appendChild(script);
      });
    }

    function table(data) {
      if (!data || !data.table) throw new Error('Unexpected sheet response');
      return data.table;
    }

    function value(row, index) {
      var cell = row.c && row.c[index];
      return cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : '';
    }

    function setStatus(status) {
      var clean = (status || 'TESTING').toUpperCase();
      var label = clean === 'LIVE' ? 'Live' : clean === 'PAUSED' ? 'Paused' : 'Testing';
      [statusBadge, leaderboardBadge].forEach(function (el) {
        if (!el) return;
        el.textContent = label;
        el.classList.remove('asme-status-badge--dev', 'asme-status-badge--resource', 'asme-status-badge--coming-soon');
        el.classList.add(clean === 'LIVE' ? 'asme-status-badge--resource' : 'asme-status-badge--dev');
      });
      if (notice) {
        notice.classList.toggle('asme-info-banner--green', clean === 'LIVE');
        notice.classList.toggle('asme-info-banner--amber', clean !== 'LIVE');
        var p = notice.querySelector('p');
        if (p) p.textContent = clean === 'LIVE' ? 'The leaderboard is live. Totals come from verified check-ins and refresh from the public Website Export sheet.' : 'Point tracking is in testing. Names remain hidden until officers switch the system status to LIVE.';
      }
      return clean;
    }

    function renderValues(t) {
      if (!valuesGrid) return;
      valuesGrid.textContent = '';
      var rows = (t.rows || []).filter(function (r) { return value(r, 1) && value(r, 2); });
      if (!rows.length) { valuesGrid.textContent = 'Point values are temporarily unavailable.'; return; }
      rows.forEach(function (r) {
        var card = document.createElement('div'); card.className = 'asme-points-feature';
        var icon = document.createElement('span'); icon.className = 'asme-points-feature-icon'; icon.textContent = '📌';
        var name = document.createElement('p'); name.className = 'asme-points-feature-name'; name.textContent = value(r, 4) || value(r, 1);
        var desc = document.createElement('p'); desc.className = 'asme-points-feature-desc'; desc.textContent = value(r, 5) || 'Approved ASME OSU point value.';
        var points = document.createElement('span'); points.className = 'asme-points-value'; points.textContent = value(r, 2) + ' pts';
        card.appendChild(icon); card.appendChild(name); card.appendChild(desc); card.appendChild(points); valuesGrid.appendChild(card);
      });
      valuesGrid.setAttribute('aria-busy', 'false');
    }

    function renderLeaderboard(t, status) {
      rowsEl.textContent = '';
      rowsEl.setAttribute('aria-busy', 'false');
      if (status !== 'LIVE') {
        var state = document.createElement('p'); state.className = 'asme-leaderboard-state'; state.textContent = 'Leaderboard names will appear after the system is approved for public launch.'; rowsEl.appendChild(state);
        if (caption) caption.textContent = 'System status: ' + status + '. No member names are displayed.';
        return;
      }
      var rows = (t.rows || []).map(function (r) { return { rank: Number(value(r, 0)), name: value(r, 1), period: value(r, 2), points: Number(value(r, 3)), events: Number(value(r, 4)) }; }).filter(function (r) { return r.name && Number.isFinite(r.points); }).slice(0, 10);
      if (title && rows[0] && rows[0].period) title.textContent = 'Semester Leaderboard — ' + rows[0].period;
      if (!rows.length) { var empty = document.createElement('p'); empty.className = 'asme-leaderboard-state'; empty.textContent = 'No public totals are available yet.'; rowsEl.appendChild(empty); return; }
      rows.forEach(function (r) {
        var row = document.createElement('div'); row.className = 'asme-leaderboard-row';
        var rank = document.createElement('span'); rank.className = 'asme-leaderboard-rank'; rank.textContent = Number.isFinite(r.rank) && r.rank > 0 ? String(r.rank) : '—';
        var avatar = document.createElement('span'); avatar.className = 'asme-leaderboard-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = (r.name[0] || '?').toUpperCase();
        var name = document.createElement('span'); name.className = 'asme-leaderboard-name'; name.textContent = r.name;
        var meta = document.createElement('span'); meta.className = 'asme-leaderboard-meta'; meta.textContent = Number.isFinite(r.events) ? r.events + (r.events === 1 ? ' event' : ' events') : '';
        var score = document.createElement('strong'); score.className = 'asme-leaderboard-score'; score.textContent = r.points + ' pts';
        row.appendChild(rank); row.appendChild(avatar); row.appendChild(name); row.appendChild(meta); row.appendChild(score); rowsEl.appendChild(row);
      });
      if (caption) caption.textContent = 'Showing up to 10 public totals from the latest verified export.';
    }

    Promise.all([
      jsonp('System_Status', 'select A,B where A is not null'),
      jsonp('Point_Values_Public', 'select A,B,C,D,E,F where B is not null')
    ]).then(function (results) {
      var statusTable = table(results[0]);
      var status = 'TESTING';
      (statusTable.rows || []).forEach(function (r) { if (value(r, 0).toLowerCase() === 'system_status') status = value(r, 1); });
      status = setStatus(status);
      renderValues(table(results[1]));
      if (status === 'LIVE') return jsonp('Leaderboard_Public', 'select A,B,C,D,E,F,G where B is not null').then(function (d) { renderLeaderboard(table(d), status); });
      renderLeaderboard({ rows: [] }, status);
    }).catch(function () {
      if (valuesGrid) { valuesGrid.textContent = 'Point values are temporarily unavailable. Please try again later.'; valuesGrid.setAttribute('aria-busy', 'false'); }
      rowsEl.textContent = ''; rowsEl.setAttribute('aria-busy', 'false');
      var error = document.createElement('p'); error.className = 'asme-leaderboard-state asme-leaderboard-state--error'; error.textContent = 'The points sheet is temporarily unavailable. Please check back later.'; rowsEl.appendChild(error);
      if (caption) caption.textContent = 'The website could not reach the public export sheet.';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
