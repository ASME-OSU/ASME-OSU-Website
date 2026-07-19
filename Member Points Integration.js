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
    var memberSelect = document.getElementById('asmeMemberSelect');
    var dashboard = document.getElementById('asmeMemberDashboardPanel');
    var dashboardState = document.getElementById('asmeMemberDashboardState');
    var dashboardName = document.getElementById('asmeDashboardName');
    var dashboardPeriod = document.getElementById('asmeDashboardPeriod');
    var dashboardRank = document.getElementById('asmeDashboardRank');
    var dashboardPoints = document.getElementById('asmeDashboardPoints');
    var dashboardEvents = document.getElementById('asmeDashboardEvents');
    var dashboardStatus = document.getElementById('asmeDashboardStatus');
    var dashboardTopType = document.getElementById('asmeDashboardTopType');
    var dashboardBreakdown = document.getElementById('asmeDashboardBreakdown');
    var members = [];

    var EVENT_TYPES = [
      { column: 7, label: 'General body meetings' },
      { column: 8, label: 'Social events / tabling' },
      { column: 9, label: 'Company info sessions' },
      { column: 10, label: 'Technical workshops' },
      { column: 11, label: 'Build nights / project sessions' },
      { column: 12, label: 'Volunteering / outreach' },
      { column: 13, label: 'Committee work sessions' }
    ];

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
        if (p) p.textContent = clean === 'LIVE' ? 'The point system is live. Verified check-ins update member totals, dashboards, and the public leaderboard automatically.' : 'Point tracking is in testing. Names remain hidden until officers switch the system status to LIVE.';
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

    function parseMembers(t) {
      return (t.rows || []).map(function (r, index) {
        return {
          id: String(index),
          rank: Number(value(r, 0)),
          name: value(r, 1),
          period: value(r, 2),
          points: Number(value(r, 3)),
          events: Number(value(r, 4)),
          tier: value(r, 5),
          updated: value(r, 6),
          eventTypes: EVENT_TYPES.map(function (type) { return { label: type.label, count: Number(value(r, type.column)) || 0 }; }),
          topType: value(r, 14)
        };
      }).filter(function (r) { return r.name && Number.isFinite(r.points); }).slice(0, 10);
    }

    function setDashboardState(message, isError) {
      if (!dashboardState) return;
      dashboardState.hidden = false;
      dashboardState.textContent = message;
      dashboardState.classList.toggle('asme-member-dashboard-state--error', Boolean(isError));
      if (dashboard) dashboard.hidden = true;
    }

    function renderMember(member) {
      if (!member || !dashboard) return;
      if (dashboardState) dashboardState.hidden = true;
      dashboard.hidden = false;
      dashboard.setAttribute('aria-busy', 'false');
      if (dashboardName) dashboardName.textContent = member.name;
      if (dashboardPeriod) dashboardPeriod.textContent = member.period || 'Current period';
      if (dashboardRank) dashboardRank.textContent = Number.isFinite(member.rank) && member.rank > 0 ? '#' + member.rank : '—';
      if (dashboardPoints) dashboardPoints.textContent = Number.isFinite(member.points) ? String(member.points) : '0';
      if (dashboardEvents) dashboardEvents.textContent = Number.isFinite(member.events) ? String(member.events) : '0';
      if (dashboardStatus) dashboardStatus.textContent = member.tier || 'Active';
      if (dashboardTopType) dashboardTopType.textContent = member.events > 0 ? (member.topType || 'Activity recorded') : 'No events yet';

      if (dashboardBreakdown) {
        dashboardBreakdown.textContent = '';
        var max = Math.max.apply(null, member.eventTypes.map(function (type) { return type.count; }).concat([1]));
        member.eventTypes.forEach(function (type) {
          var item = document.createElement('div'); item.className = 'asme-event-type-row';
          var label = document.createElement('span'); label.className = 'asme-event-type-label'; label.textContent = type.label;
          var track = document.createElement('span'); track.className = 'asme-event-type-track';
          var bar = document.createElement('span'); bar.className = 'asme-event-type-bar'; bar.style.width = (type.count ? Math.max(12, (type.count / max) * 100) : 0) + '%';
          var count = document.createElement('strong'); count.className = 'asme-event-type-count'; count.textContent = String(type.count);
          track.appendChild(bar); item.appendChild(label); item.appendChild(track); item.appendChild(count); dashboardBreakdown.appendChild(item);
        });
      }
    }

    function renderDashboard(status) {
      if (!memberSelect) return;
      memberSelect.textContent = '';
      if (status !== 'LIVE') {
        var unavailable = document.createElement('option'); unavailable.textContent = 'Dashboard unavailable while the system is ' + status.toLowerCase(); unavailable.value = '';
        memberSelect.appendChild(unavailable); memberSelect.disabled = true;
        setDashboardState('Member dashboards will appear when officers switch the point system to LIVE.');
        return;
      }
      if (!members.length) {
        var emptyOption = document.createElement('option'); emptyOption.textContent = 'No public member totals yet'; emptyOption.value = '';
        memberSelect.appendChild(emptyOption); memberSelect.disabled = true;
        setDashboardState('No public member totals are available yet.');
        return;
      }
      memberSelect.disabled = false;
      members.forEach(function (member) {
        var option = document.createElement('option'); option.value = member.id; option.textContent = member.name + ' — Rank #' + member.rank;
        memberSelect.appendChild(option);
      });
      memberSelect.onchange = function () {
        var selected = members.filter(function (member) { return member.id === memberSelect.value; })[0];
        renderMember(selected);
      };
      renderMember(members[0]);
    }

    function selectMember(member) {
      if (!memberSelect || !member) return;
      memberSelect.value = member.id;
      renderMember(member);
      var dashboardSection = document.getElementById('member-dashboard');
      if (dashboardSection) dashboardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderLeaderboard(status) {
      rowsEl.textContent = '';
      rowsEl.setAttribute('aria-busy', 'false');
      if (status !== 'LIVE') {
        var state = document.createElement('p'); state.className = 'asme-leaderboard-state'; state.textContent = 'Leaderboard names will appear after the system is approved for public launch.'; rowsEl.appendChild(state);
        if (caption) caption.textContent = 'System status: ' + status + '. No member names are displayed.';
        return;
      }
      if (title && members[0] && members[0].period) title.textContent = 'Semester Leaderboard — ' + members[0].period;
      if (!members.length) { var empty = document.createElement('p'); empty.className = 'asme-leaderboard-state'; empty.textContent = 'No public totals are available yet.'; rowsEl.appendChild(empty); return; }
      members.forEach(function (member) {
        var row = document.createElement('div'); row.className = 'asme-leaderboard-row'; row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', 'View dashboard for ' + member.name);
        var rank = document.createElement('span'); rank.className = 'asme-leaderboard-rank'; rank.textContent = Number.isFinite(member.rank) && member.rank > 0 ? String(member.rank) : '—';
        var avatar = document.createElement('span'); avatar.className = 'asme-leaderboard-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = (member.name[0] || '?').toUpperCase();
        var name = document.createElement('span'); name.className = 'asme-leaderboard-name'; name.textContent = member.name;
        var meta = document.createElement('span'); meta.className = 'asme-leaderboard-meta'; meta.textContent = member.events + (member.events === 1 ? ' event' : ' events');
        var score = document.createElement('strong'); score.className = 'asme-leaderboard-score'; score.textContent = member.points + ' pts';
        row.appendChild(rank); row.appendChild(avatar); row.appendChild(name); row.appendChild(meta); row.appendChild(score); rowsEl.appendChild(row);
        row.addEventListener('click', function () { selectMember(member); });
        row.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectMember(member); } });
      });
      if (caption) caption.textContent = 'Select a member row to open that public dashboard. Showing up to 10 verified totals.';
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
      if (status === 'LIVE') {
        return jsonp('Leaderboard_Public', 'select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O where B is not null').then(function (d) {
          members = parseMembers(table(d));
          renderDashboard(status);
          renderLeaderboard(status);
        });
      }
      renderDashboard(status);
      renderLeaderboard(status);
    }).catch(function () {
      if (valuesGrid) { valuesGrid.textContent = 'Point values are temporarily unavailable. Please try again later.'; valuesGrid.setAttribute('aria-busy', 'false'); }
      rowsEl.textContent = ''; rowsEl.setAttribute('aria-busy', 'false');
      var error = document.createElement('p'); error.className = 'asme-leaderboard-state asme-leaderboard-state--error'; error.textContent = 'The points sheet is temporarily unavailable. Please check back later.'; rowsEl.appendChild(error);
      if (caption) caption.textContent = 'The website could not reach the public export sheet.';
      if (memberSelect) memberSelect.disabled = true;
      setDashboardState('The member dashboard is temporarily unavailable. Please try again later.', true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
