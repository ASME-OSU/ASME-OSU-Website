(function () {
  'use strict';

  /* ASME MOBILE NAVIGATION START */
  (function () {
    if (window.asmeMobileNavDismissReady) return;
    window.asmeMobileNavDismissReady = true;

    function getNavigation() {
      return document.getElementById('site-navigation');
    }

    function clearSubmenus(navigation) {
      navigation.querySelectorAll('.sfHover, .dropdown-hover').forEach(function (item) {
        item.classList.remove('sfHover', 'dropdown-hover');
      });

      navigation.querySelectorAll('.dropdown-menu-toggle[aria-expanded="true"]').forEach(function (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open Sub-Menu');
      });
    }

    function closeSubmenu(item) {
      item.classList.remove('sfHover', 'dropdown-hover');

      var link = item.firstElementChild;
      var toggle = link && link.querySelector('.dropdown-menu-toggle');
      if (toggle) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Open Sub-Menu');
      }
    }

    function closeSiblingSubmenus(navigation, activeItem) {
      navigation.querySelectorAll(
        '.main-nav > ul > .menu-item-has-children.sfHover, ' +
        '.main-nav > ul > .menu-item-has-children.dropdown-hover'
      ).forEach(function (item) {
        if (item !== activeItem) closeSubmenu(item);
      });
    }

    function closeMobileNavigation(navigation, returnFocus) {
      var menuToggle = navigation.querySelector('.menu-toggle');
      if (!menuToggle || !navigation.classList.contains('toggled')) return;

      menuToggle.click();
      clearSubmenus(navigation);

      if (returnFocus) menuToggle.focus();
    }

    document.addEventListener('click', function (event) {
      if (!window.matchMedia('(max-width: 768px)').matches) return;

      var navigation = getNavigation();
      if (!navigation || !navigation.classList.contains('toggled')) return;
      if (navigation.contains(event.target)) return;

      event.preventDefault();
      event.stopPropagation();
      closeMobileNavigation(navigation, false);
    }, true);

    document.addEventListener('click', function (event) {
      if (!window.matchMedia('(max-width: 768px)').matches) return;

      var target = event.target && event.target.closest ? event.target : null;
      var dropdownToggle = target && target.closest('#site-navigation .dropdown-menu-toggle');
      if (!dropdownToggle) return;

      var navigation = getNavigation();
      var activeItem = dropdownToggle.closest('.menu-item-has-children');
      if (!navigation || !activeItem || !navigation.classList.contains('toggled')) return;

      window.setTimeout(function () {
        closeSiblingSubmenus(navigation, activeItem);
      }, 0);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;

      var navigation = getNavigation();
      if (!navigation || !navigation.classList.contains('toggled')) return;

      event.preventDefault();
      closeMobileNavigation(navigation, true);
    });
  })();
  /* ASME MOBILE NAVIGATION END */

  function start() {
    var app = document.getElementById('asmePointsApp');
    var rowsEl = document.getElementById('asmeLeaderboardRows');
    if (!app || !rowsEl) return;

    var EXPORT_ID = '1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg';
    var base = 'https://docs.google.com/spreadsheets/d/' + EXPORT_ID + '/gviz/tq';
    var statusBadge = document.getElementById('asmePointsStatusBadge');
    var leaderboardBadge = document.getElementById('asmeLeaderboardStatus');
    var caption = document.getElementById('asmeLeaderboardCaption');
    var valuesGrid = document.getElementById('asmePointValuesGrid');
    var title = document.getElementById('asmeLeaderboardTitle');
    var searchInput = document.getElementById('asmeMemberSearch');
    var searchResults = document.getElementById('asmeMemberSearchResults');
    var searchHint = document.getElementById('asmeMemberSearchHint');
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
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var RANK_SNAPSHOT_KEY = 'asmeLeaderboardRankSnapshotsV1';
    var members = [];
    var jumpLinks = Array.prototype.slice.call(app.querySelectorAll('.asme-points-jump-nav a[href^="#"]'));
    var jumpSections = jumpLinks.map(function (link) {
      return { link: link, section: document.querySelector(link.getAttribute('href')) };
    }).filter(function (item) { return item.section; });
    var jumpFrame = 0;

    function setCurrentJumpLink(activeLink) {
      jumpLinks.forEach(function (link) {
        if (link === activeLink) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }

    function updateCurrentJumpLink() {
      jumpFrame = 0;
      if (!jumpSections.length) return;
      if (window.matchMedia('(min-width: 1101px)').matches) return;

      var threshold = Math.min(180, window.innerHeight * 0.32);
      var existingLink = app.querySelector('.asme-points-jump-nav a[aria-current="location"]');
      var current = jumpSections[0];
      var currentTop = current.section.getBoundingClientRect().top;
      jumpSections.forEach(function (item) {
        var itemTop = item.section.getBoundingClientRect().top;
        if (itemTop > threshold) return;

        if (Math.abs(itemTop - currentTop) > 8 || item.link === existingLink) {
          current = item;
          currentTop = itemTop;
        }
      });
      setCurrentJumpLink(current.link);
    }

    jumpLinks.forEach(function (link) {
      link.addEventListener('click', function () { setCurrentJumpLink(link); });
    });
    window.addEventListener('scroll', function () {
      if (!jumpFrame) jumpFrame = window.requestAnimationFrame(updateCurrentJumpLink);
    }, { passive: true });
    window.addEventListener('hashchange', updateCurrentJumpLink);
    window.requestAnimationFrame(updateCurrentJumpLink);

    var EVENT_TYPES = [
      { column: 7, label: 'General body meetings' },
      { column: 8, label: 'Social events / tabling' },
      { column: 9, label: 'Company info sessions' },
      { column: 10, label: 'Technical workshops' },
      { column: 11, label: 'Build nights / projects' },
      { column: 12, label: 'Volunteering / outreach' },
      { column: 13, label: 'Committee work sessions' }
    ];

    function jsonp(sheet, query) {
      return new Promise(function (resolve, reject) {
        var key = '__asmeSheet_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        var script = document.createElement('script');
        var timer = setTimeout(function () { cleanup(); reject(new Error('Sheet request timed out')); }, 15000);
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

    function displayValue(row, index) {
      var cell = row.c && row.c[index];
      if (!cell) return '';
      if (cell.f !== null && cell.f !== undefined) return String(cell.f).trim();
      return cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : '';
    }

    function updatedLabel(raw) {
      var match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
      if (!match) return raw ? 'Updated ' + raw : 'Updated automatically';
      var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      var hour = Number(match[4]);
      var minute = match[5];
      var period = hour >= 12 ? 'PM' : 'AM';
      var hour12 = hour % 12 || 12;
      return 'Updated ' + months[Number(match[2]) - 1] + ' ' + Number(match[3]) + ' at ' + hour12 + ':' + minute + ' ' + period + ' ET';
    }

    function setStatus(status) {
      var clean = (status || 'LOADING').toUpperCase();
      var label = clean === 'LIVE' ? 'Live' : clean === 'PAUSED' ? 'Paused' : clean === 'LOADING' ? 'Loading' : 'Testing';
      [statusBadge, leaderboardBadge].forEach(function (el) {
        if (!el) return;
        el.textContent = '';
        el.classList.remove('asme-status-badge--dev', 'asme-status-badge--resource', 'asme-status-badge--coming-soon');
        el.classList.toggle('asme-live-indicator', clean === 'LIVE');
        el.classList.add(clean === 'LIVE' ? 'asme-status-badge--resource' : 'asme-status-badge--dev');
        if (clean === 'LIVE') {
          var dot = document.createElement('span');
          dot.className = 'asme-live-dot';
          dot.setAttribute('aria-hidden', 'true');
          el.appendChild(dot);
        }
        var statusText = document.createElement('span');
        statusText.textContent = label;
        el.appendChild(statusText);
      });
      return clean;
    }

    function rankSnapshotMemberKey(member) {
      return String(member && member.name || '').trim().toLowerCase();
    }

    function getPreviousRankSnapshot(currentMembers) {
      var firstMember = currentMembers[0];
      var currentUpdated = firstMember && firstMember.updated ? String(firstMember.updated) : '';
      var currentPeriod = firstMember && firstMember.period ? String(firstMember.period) : '';
      if (!currentUpdated) return null;

      var currentRanks = {};
      var duplicateKeys = {};
      currentMembers.forEach(function (member) {
        var key = rankSnapshotMemberKey(member);
        if (!key || !Number.isFinite(member.rank) || member.rank <= 0 || duplicateKeys[key]) return;
        if (Object.prototype.hasOwnProperty.call(currentRanks, key)) {
          delete currentRanks[key];
          duplicateKeys[key] = true;
          return;
        }
        currentRanks[key] = member.rank;
      });

      var stored = null;
      try {
        stored = JSON.parse(window.localStorage.getItem(RANK_SNAPSHOT_KEY) || 'null');
      } catch (error) {
        stored = null;
      }

      var previous = null;
      if (stored && stored.current) {
        if (stored.current.updated === currentUpdated && stored.current.period === currentPeriod) {
          previous = stored.previous || null;
        } else if (stored.current.period === currentPeriod) {
          previous = stored.current;
        }
      }
      if (previous && previous.ranks) {
        Object.keys(duplicateKeys).forEach(function (key) { delete previous.ranks[key]; });
      }

      try {
        window.localStorage.setItem(RANK_SNAPSHOT_KEY, JSON.stringify({
          current: { updated: currentUpdated, period: currentPeriod, ranks: currentRanks },
          previous: previous
        }));
      } catch (error) {
        return null;
      }

      return previous && previous.ranks ? previous.ranks : null;
    }

    function createCrownIcon() {
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '2');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      var crown = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      crown.setAttribute('d', 'm2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z');
      var baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      baseLine.setAttribute('d', 'M5 20h14');
      svg.appendChild(crown);
      svg.appendChild(baseLine);
      return svg;
    }

    function createRankTrend(member, previousRanks) {
      var key = rankSnapshotMemberKey(member);
      if (!previousRanks || !Object.prototype.hasOwnProperty.call(previousRanks, key)) return null;

      var previousRank = Number(previousRanks[key]);
      if (!Number.isFinite(previousRank) || !Number.isFinite(member.rank)) return null;
      var change = previousRank - member.rank;
      var trend = document.createElement('span');
      trend.className = 'asme-rank-trend ' + (change > 0 ? 'asme-rank-trend--up' : change < 0 ? 'asme-rank-trend--down' : 'asme-rank-trend--same');
      trend.setAttribute('aria-label', change > 0 ? 'Up ' + change + (change === 1 ? ' place' : ' places') : change < 0 ? 'Down ' + Math.abs(change) + (change === -1 ? ' place' : ' places') : 'No rank change');

      var arrow = document.createElement('span');
      arrow.className = 'asme-rank-trend-icon';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = change > 0 ? '↑' : change < 0 ? '↓' : '—';
      trend.appendChild(arrow);
      if (change !== 0) {
        var amount = document.createElement('span');
        amount.setAttribute('aria-hidden', 'true');
        amount.textContent = String(Math.abs(change));
        trend.appendChild(amount);
      }
      return trend;
    }

    function animateNumber(el, target, prefix, suffix, duration) {
      if (!el) return;
      var end = Number(target);
      if (!Number.isFinite(end) || reduceMotion) {
        el.textContent = (prefix || '') + (Number.isFinite(end) ? end : target) + (suffix || '');
        return;
      }
      var startTime = null;
      function frame(timestamp) {
        if (!startTime) startTime = timestamp;
        var progress = Math.min((timestamp - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = (prefix || '') + Math.round(end * eased) + (suffix || '');
        if (progress < 1) window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);
    }

    function replayEntrance(el, className) {
      if (!el || reduceMotion) return;
      el.classList.remove(className);
      void el.offsetWidth;
      el.classList.add(className);
    }

    function renderValues(t) {
      if (!valuesGrid) return;
      valuesGrid.textContent = '';
      var rows = (t.rows || []).filter(function (r) { return value(r, 1) && value(r, 2); });
      if (!rows.length) { valuesGrid.textContent = 'Point values are temporarily unavailable.'; return; }
      rows.forEach(function (r, index) {
        var chip = document.createElement('div'); chip.className = 'asme-point-value-chip asme-data-enter';
        chip.style.setProperty('--asme-data-delay', Math.min(index * 35, 245) + 'ms');
        var name = document.createElement('span'); name.textContent = value(r, 4) || value(r, 1);
        var points = document.createElement('strong'); points.textContent = value(r, 2) + ' pts';
        chip.appendChild(name); chip.appendChild(points); valuesGrid.appendChild(chip);
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
          updated: displayValue(r, 6),
          eventTypes: EVENT_TYPES.map(function (type) { return { label: type.label, count: Number(value(r, type.column)) || 0 }; }),
          topType: value(r, 14)
        };
      }).filter(function (r) { return r.name && Number.isFinite(r.points); });
    }

    function setDashboardState(message, isError) {
      if (!dashboardState) return;
      dashboardState.hidden = false;
      dashboardState.textContent = message;
      dashboardState.classList.toggle('asme-member-dashboard-state--error', Boolean(isError));
      if (dashboard) dashboard.hidden = true;
    }

    function hideSearchResults() {
      if (searchResults) { searchResults.hidden = true; searchResults.textContent = ''; }
      if (searchInput) searchInput.setAttribute('aria-expanded', 'false');
    }

    function renderMember(member) {
      if (!member || !dashboard) return;
      if (dashboardState) dashboardState.hidden = true;
      dashboard.hidden = false;
      dashboard.setAttribute('aria-busy', 'false');
      replayEntrance(dashboard, 'asme-dashboard-enter');
      if (dashboardName) dashboardName.textContent = member.name;
      if (dashboardPeriod) dashboardPeriod.textContent = member.period || 'Current period';
      if (dashboardRank) {
        if (Number.isFinite(member.rank) && member.rank > 0) animateNumber(dashboardRank, member.rank, '#', '', 520);
        else dashboardRank.textContent = '—';
      }
      animateNumber(dashboardPoints, Number.isFinite(member.points) ? member.points : 0, '', '', 700);
      animateNumber(dashboardEvents, Number.isFinite(member.events) ? member.events : 0, '', '', 620);
      if (dashboardStatus) dashboardStatus.textContent = member.tier || 'Active';
      if (dashboardTopType) dashboardTopType.textContent = member.events > 0 ? (member.topType || 'Activity recorded') : 'No events yet';

      if (dashboardBreakdown) {
        dashboardBreakdown.textContent = '';
        var activeTypes = member.eventTypes.filter(function (type) { return type.count > 0; });
        if (!activeTypes.length) {
          var empty = document.createElement('p'); empty.className = 'asme-event-type-empty'; empty.textContent = 'No point-earning events yet.'; dashboardBreakdown.appendChild(empty);
          return;
        }
        var max = Math.max.apply(null, activeTypes.map(function (type) { return type.count; }));
        activeTypes.forEach(function (type, index) {
          var item = document.createElement('div'); item.className = 'asme-event-type-row asme-data-enter';
          item.style.setProperty('--asme-data-delay', Math.min(index * 45, 270) + 'ms');
          var label = document.createElement('span'); label.className = 'asme-event-type-label'; label.textContent = type.label;
          var track = document.createElement('span'); track.className = 'asme-event-type-track';
          var bar = document.createElement('span'); bar.className = 'asme-event-type-bar';
          var targetWidth = Math.max(14, (type.count / max) * 100) + '%';
          bar.style.width = reduceMotion ? targetWidth : '0%';
          var count = document.createElement('strong'); count.className = 'asme-event-type-count'; count.textContent = String(type.count);
          track.appendChild(bar); item.appendChild(label); item.appendChild(track); item.appendChild(count); dashboardBreakdown.appendChild(item);
          if (!reduceMotion) {
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(function () { bar.style.width = targetWidth; });
            });
          }
        });
      }
    }

    function chooseMember(member, scrollToDashboard) {
      if (!member) return;
      if (searchInput) searchInput.value = member.name;
      if (searchHint) searchHint.textContent = 'Showing ' + member.name + ' · Rank #' + member.rank;
      hideSearchResults();
      renderMember(member);
      if (scrollToDashboard) {
        var dashboardSection = document.getElementById('member-dashboard');
        if (dashboardSection) dashboardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    function matchingMembers(query) {
      var clean = String(query || '').trim().toLowerCase();
      if (!clean) return [];
      return members.filter(function (member) { return member.name.toLowerCase().indexOf(clean) !== -1; });
    }

    function renderSearchResults(query) {
      if (!searchResults || !searchInput) return;
      searchResults.textContent = '';
      var clean = String(query || '').trim();
      if (!clean) {
        hideSearchResults();
        if (searchHint) searchHint.textContent = 'Type at least one letter.';
        return;
      }
      var matches = matchingMembers(clean);
      if (!matches.length) {
        var noMatch = document.createElement('p'); noMatch.className = 'asme-member-search-empty'; noMatch.textContent = 'No public name matches “' + clean + '”.'; searchResults.appendChild(noMatch);
      } else {
        matches.slice(0, 8).forEach(function (member, index) {
          var button = document.createElement('button'); button.type = 'button'; button.className = 'asme-member-search-result asme-data-enter';
          button.style.setProperty('--asme-data-delay', Math.min(index * 28, 140) + 'ms');
          var name = document.createElement('strong'); name.textContent = member.name;
          var meta = document.createElement('span'); meta.textContent = '#' + member.rank + ' · ' + member.points + ' pts';
          button.appendChild(name); button.appendChild(meta);
          button.addEventListener('click', function () { chooseMember(member, false); });
          searchResults.appendChild(button);
        });
      }
      searchResults.hidden = false;
      searchInput.setAttribute('aria-expanded', 'true');
      if (searchHint) searchHint.textContent = matches.length ? matches.length + (matches.length === 1 ? ' match' : ' matches') : 'Try a different spelling.';
    }

    function renderDashboard(status) {
      if (!searchInput) return;
      if (status !== 'LIVE') {
        searchInput.disabled = true;
        searchInput.placeholder = 'Dashboard unavailable';
        if (searchHint) searchHint.textContent = 'The system is ' + status.toLowerCase() + '.';
        setDashboardState('Member dashboards appear when the point system is live.');
        return;
      }
      if (!members.length) {
        searchInput.disabled = true;
        if (searchHint) searchHint.textContent = 'No public names yet.';
        setDashboardState('No public member totals are available yet.');
        return;
      }
      searchInput.disabled = false;
      searchInput.placeholder = 'Start typing a name…';
      if (searchHint) searchHint.textContent = members.length + ' public ' + (members.length === 1 ? 'member' : 'members') + ' searchable.';
      setDashboardState('Search your name above to open your dashboard.');
      searchInput.addEventListener('input', function () { renderSearchResults(searchInput.value); });
      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') hideSearchResults();
        if (event.key === 'Enter') {
          var matches = matchingMembers(searchInput.value);
          if (matches.length === 1) { event.preventDefault(); chooseMember(matches[0], false); }
        }
      });
    }

    function renderLeaderboard(status) {
      rowsEl.textContent = '';
      rowsEl.setAttribute('aria-busy', 'false');
      if (status !== 'LIVE') {
        var state = document.createElement('p'); state.className = 'asme-leaderboard-state'; state.textContent = 'Leaderboard unavailable while the system is ' + status.toLowerCase() + '.'; rowsEl.appendChild(state);
        if (caption) caption.textContent = 'No member names are displayed.';
        return;
      }
      if (title && members[0] && members[0].period) title.textContent = 'Semester Leaderboard — ' + members[0].period;
      if (!members.length) { var empty = document.createElement('p'); empty.className = 'asme-leaderboard-state'; empty.textContent = 'No public totals yet.'; rowsEl.appendChild(empty); return; }
      var visibleMembers = members.slice(0, 10);
      var previousRanks = getPreviousRankSnapshot(members);
      visibleMembers.forEach(function (member, index) {
        var memberRank = Number.isFinite(member.rank) && member.rank > 0 ? member.rank : null;
        var row = document.createElement('div'); row.className = 'asme-leaderboard-row asme-data-enter'; row.tabIndex = 0; row.setAttribute('role', 'button'); row.setAttribute('aria-label', (memberRank ? 'Rank ' + memberRank + ', ' : '') + member.name + ', ' + member.points + ' points, ' + member.events + (member.events === 1 ? ' event' : ' events') + '. View member dashboard.');
        if (memberRank && memberRank <= 5) {
          row.classList.add('asme-leaderboard-row--rank-' + memberRank);
          row.setAttribute('data-rank', String(memberRank));
        }
        row.style.setProperty('--asme-data-delay', Math.min(index * 45, 360) + 'ms');
        var rank = document.createElement('span'); rank.className = 'asme-leaderboard-rank';
        if (memberRank === 1) {
          rank.classList.add('asme-leaderboard-rank--crown');
          rank.appendChild(createCrownIcon());
        } else {
          rank.textContent = memberRank ? String(memberRank) : '—';
        }
        var avatar = document.createElement('span'); avatar.className = 'asme-leaderboard-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = (member.name[0] || '?').toUpperCase();
        var memberCell = document.createElement('span'); memberCell.className = 'asme-leaderboard-member';
        var name = document.createElement('span'); name.className = 'asme-leaderboard-name'; name.textContent = member.name;
        memberCell.appendChild(name);
        if (memberRank === 1) {
          var rankLabel = document.createElement('span'); rankLabel.className = 'asme-leaderboard-tier'; rankLabel.textContent = 'Champion';
          memberCell.appendChild(rankLabel);
        }
        var trend = createRankTrend(member, previousRanks);
        if (trend) row.classList.add('asme-leaderboard-row--has-trend');
        var meta = document.createElement('span'); meta.className = 'asme-leaderboard-meta'; meta.textContent = member.events + (member.events === 1 ? ' event' : ' events');
        var score = document.createElement('strong'); score.className = 'asme-leaderboard-score'; score.textContent = member.points + ' pts';
        row.appendChild(rank); row.appendChild(avatar); row.appendChild(memberCell); if (trend) row.appendChild(trend); row.appendChild(meta); row.appendChild(score); rowsEl.appendChild(row);
        row.addEventListener('click', function () { chooseMember(member, true); });
        row.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseMember(member, true); } });
      });
      if (caption) {
        caption.textContent = '';
        var captionText = document.createElement('span');
        captionText.textContent = updatedLabel(members[0] && members[0].updated) + ' · Select a row to view details.';
        caption.appendChild(captionText);
        var pointTotals = {};
        var hasTie = visibleMembers.some(function (member) {
          var pointKey = String(member.points);
          if (pointTotals[pointKey]) return true;
          pointTotals[pointKey] = true;
          return false;
        });
        if (hasTie) {
          var tieNote = document.createElement('span');
          tieNote.className = 'asme-leaderboard-tie-note';
          tieNote.textContent = 'Tied point totals follow the sheet’s configured tie-break order.';
          caption.appendChild(tieNote);
        }
      }
    }

    setStatus('LOADING');

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
      if (valuesGrid) { valuesGrid.textContent = 'Point values are temporarily unavailable.'; valuesGrid.setAttribute('aria-busy', 'false'); }
      rowsEl.textContent = ''; rowsEl.setAttribute('aria-busy', 'false');
      var error = document.createElement('p'); error.className = 'asme-leaderboard-state asme-leaderboard-state--error'; error.textContent = 'Points are temporarily unavailable.'; rowsEl.appendChild(error);
      if (caption) caption.textContent = 'Please try again later.';
      if (searchInput) searchInput.disabled = true;
      if (searchHint) searchHint.textContent = 'Search unavailable.';
      setDashboardState('The member dashboard is temporarily unavailable.', true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
