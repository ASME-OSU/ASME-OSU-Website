(function () {
  'use strict';

  var IS_LOCAL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  var FEED_URL = IS_LOCAL ? '/data/calendar-events.json' : 'https://asme-osu.github.io/ASME-OSU-Website/data/calendar-events.json';
  var CACHE_KEY = 'asmeCalendarEventsV3';
  var TIME_ZONE = 'America/New_York';
  var previewYear = '', activeFeed = null, fictionalSource = false, loadGeneration = 0;
  var NON_CHAPTER_EVENT_TITLE_PATTERNS = [
    /\bclasses begin\b/i,
    /\benrollment census date\b/i,
    /\blast day of regularly scheduled\b/i,
    /\bfinal exams?\b/i,
    /^(?:autumn|spring|thanksgiving) break\b/i,
    /\bacademic winter recess\b/i,
    /\bcommencement\b/i,
    /\binitial fee due date\b/i,
    /\bnew year'?s day\b/i,
    /\bno classes\b/i,
    /\boffices (?:closed|open)\b/i
  ];

  function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function safeDate(value) {
    var date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function calendarDateKey(event) {
    var date = safeDate(event.start);
    if (!date) return '';
    var parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: event.allDay ? 'UTC' : TIME_ZONE }).formatToParts(date).map(function (part) { return [part.type, part.value]; }));
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function validatePreviewYear(year) {
    var match = year.match(/^(\d{4})-(\d{4})$/);
    if (!match || Number(match[2]) !== Number(match[1]) + 1) throw new Error('Enter consecutive academic years, such as 2027-2028.');
    return match;
  }

  function upcomingEvents(feed) {
    var now = new Date();
    if (!feed || !Array.isArray(feed.events)) return [];
    var bounds = previewYear ? validatePreviewYear(previewYear) : null;
    return feed.events.filter(function (event) {
      var start = safeDate(event.start), end = safeDate(event.end);
      if (!start) return false;
      if (bounds) { var key = calendarDateKey(event); return key >= bounds[1] + '-08-01' && key < bounds[2] + '-08-01'; }
      return (end && end > now) || start >= now;
    }).sort(function (a, b) { return safeDate(a.start) - safeDate(b.start); });
  }

  function fictionalFeed(year) {
    var bounds = validatePreviewYear(year), start = Number(bounds[1]);
    return { generatedAt: new Date().toISOString(), events: [
      { id: 'fictional-fall-' + year, title: 'TEST ONLY — Fall workshop — DO NOT PUBLISH', start: start + '-09-15T22:00:00.000Z', end: start + '-09-15T23:00:00.000Z', location: 'Fictional training room' },
      { id: 'fictional-spring-' + year, title: 'TEST ONLY — Spring workshop — DO NOT PUBLISH', start: (start + 1) + '-01-15T23:00:00.000Z', end: (start + 1) + '-01-16T00:00:00.000Z', location: 'Fictional training room' }
    ] };
  }

  function isChapterEvent(event) {
    var title = cleanText(event && event.title);
    if (!title) return false;
    return !NON_CHAPTER_EVENT_TITLE_PATTERNS.some(function (pattern) {
      return pattern.test(title);
    });
  }

  function monthLabel(date, allDay) {
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: allDay ? 'UTC' : TIME_ZONE });
  }

  function dayLabel(date, allDay) {
    return date.toLocaleDateString('en-US', { day: 'numeric', timeZone: allDay ? 'UTC' : TIME_ZONE });
  }

  function formatEventDate(event) {
    var start = safeDate(event.start);
    var end = safeDate(event.end);
    if (!start) return 'Date to be announced';

    var dateText = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: event.allDay ? 'UTC' : TIME_ZONE
    });
    if (event.allDay) return dateText + ' · All day';

    var startTime = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TIME_ZONE
    });
    var endTime = end ? end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: TIME_ZONE
    }) : '';
    return dateText + ' · ' + startTime + (endTime ? '–' + endTime : '');
  }

  function renderHome(events) {
    var title = document.getElementById('asmeFeaturedTitle');
    var description = document.getElementById('asmeFeaturedDescription');
    var date = document.getElementById('asmeFeaturedDate');
    var location = document.getElementById('asmeFeaturedLocation');
    if (!title || !description || !date || !location) return;

    if (!events.length) {
      title.textContent = 'Explore the ASME calendar';
      description.textContent = 'New meetings, company sessions, socials, and competitions are added throughout the semester.';
      date.textContent = 'Calendar available';
      location.textContent = 'ASME OSU';
      return;
    }

    var event = events[0];
    title.textContent = cleanText(event.title) || 'Upcoming ASME Event';
    description.textContent = cleanText(event.description) || 'Join ASME OSU for our next chapter event. Check the full calendar for details and updates.';
    date.textContent = formatEventDate(event);
    location.textContent = cleanText(event.location) || 'Location TBA';
  }

  function buildEventCard(event, index) {
    var start = safeDate(event.start);
    var card = document.createElement('article');
    var dateBlock = document.createElement('div');
    var month = document.createElement('span');
    var day = document.createElement('strong');
    var copy = document.createElement('div');
    var title = document.createElement('h3');
    var meta = document.createElement('p');
    var location = document.createElement('p');

    card.className = 'acp-event-card' + (index === 0 ? ' acp-event-card--next' : '');
    dateBlock.className = 'acp-event-date';
    month.textContent = start ? monthLabel(start, event.allDay) : 'TBA';
    day.textContent = start ? dayLabel(start, event.allDay) : '—';
    dateBlock.appendChild(month);
    dateBlock.appendChild(day);

    copy.className = 'acp-event-copy';
    title.textContent = cleanText(event.title) || 'Upcoming ASME event';
    meta.className = 'acp-event-meta';
    meta.textContent = formatEventDate(event);
    location.className = 'acp-event-location';
    location.textContent = cleanText(event.location) || 'Location TBA';
    copy.appendChild(title);
    copy.appendChild(meta);
    copy.appendChild(location);

    card.appendChild(dateBlock);
    card.appendChild(copy);
    return card;
  }

  function renderCalendarPage(events) {
    var grid = document.getElementById('asmeCalendarUpcoming');
    if (!grid) return;
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');

    if (!events.length) {
      var empty = document.createElement('div');
      empty.className = 'acp-event-empty';
      empty.innerHTML = '<strong>No events are available for this view.</strong><span>Check the chapter calendar and snapshot coverage for the latest schedule.</span>';
      grid.appendChild(empty);
      return;
    }

    events.slice(0, 3).forEach(function (event, index) {
      grid.appendChild(buildEventCard(event, index));
    });
  }

  function render(feed) {
    activeFeed = feed;
    var events = upcomingEvents(feed).filter(isChapterEvent);
    renderHome(events);
    renderCalendarPage(events);
    var status = document.getElementById('asmeCalendarStatus');
    var coverage = fictionalSource ? '' : feed.windowStart && feed.windowEnd ? ' Snapshot coverage ' + feed.windowStart.slice(0, 10) + ' through ' + feed.windowEnd.slice(0, 10) + '; dates outside this range are unavailable.' : ' Snapshot coverage is not supplied; check the full chapter calendar for missing dates.';
    if (status) status.textContent = (fictionalSource ? 'FICTIONAL REHEARSAL — no Google events. ' : 'Chapter generated snapshot. ') + events.length + ' event(s) for ' + (previewYear || 'upcoming dates') + ' · generated ' + (feed.generatedAt || 'time unavailable') + (feed.checkedAt ? ' · source checked ' + feed.checkedAt : '') + ' · read ' + new Date().toLocaleString() + '. Refresh rereads JSON; the hourly job reads Google.' + coverage;
    var clear = document.getElementById('asmeCalendarClearFictional');
    if (clear) clear.hidden = !fictionalSource;
    var label = document.getElementById('acp-calendar-label');
    if (label) label.textContent = previewYear ? 'Chapter calendar — ' + previewYear.replace('-', '–') + ' preview · Eastern Time' : 'ASME Events · Eastern Time';
    var frame = document.getElementById('asmeCalendarFrame');
    if (frame) {
      frame.hidden = fictionalSource;
      if (previewYear && !fictionalSource) {
        var url = new URL(frame.src), start = previewYear.slice(0, 4), end = previewYear.slice(5);
        url.searchParams.set('dates', start + '0801/' + end + '0731'); frame.src = url.toString();
      } else if (!fictionalSource) { var sourceUrl = new URL(frame.src); sourceUrl.searchParams.delete('dates'); frame.src = sourceUrl.toString(); }
    }
  }

  function initPreviewControls() {
    var input = document.getElementById('asmeCalendarYear');
    if (!input) return;
    function apply() {
      try { var selectedYear = input.value.trim(); if (selectedYear) validatePreviewYear(selectedYear); previewYear = selectedYear; render(activeFeed || { events: [] }); }
      catch (error) { document.getElementById('asmeCalendarStatus').textContent = error.message; }
    }
    document.getElementById('asmeCalendarPreview').addEventListener('click', apply);
    document.getElementById('asmeCalendarUpcomingView').addEventListener('click', function () { input.value = ''; previewYear = ''; render(activeFeed || { events: [] }); });
    document.getElementById('asmeCalendarRefresh').addEventListener('click', function () { fictionalSource = false; loadFeed(); });
    document.getElementById('asmeCalendarFictional').addEventListener('click', function () {
      var year = input.value.trim();
      if (!year) { var now = new Date(), start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1; year = start + '-' + (start + 1); input.value = year; }
      try { var feed = fictionalFeed(year); loadGeneration++; previewYear = year; fictionalSource = true; render(feed); }
      catch (error) { document.getElementById('asmeCalendarStatus').textContent = error.message; }
    });
    document.getElementById('asmeCalendarClearFictional').addEventListener('click', function () { if (fictionalSource) render(Object.assign({}, activeFeed, { events: [] })); });
  }

  function readCache() {
    try {
      var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY));
      return cached && cached.feed ? cached.feed : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(feed) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), feed: feed }));
    } catch (error) {}
  }

  function loadFeed() {
    var generation = ++loadGeneration;
    var cached = readCache();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 4500);

    if (cached) render(cached);
    var status = document.getElementById("asmeCalendarStatus");
    if (status) status.textContent = "Reading generated chapter snapshot…";

    fetch(FEED_URL + '?hour=' + Math.floor(Date.now() / 3600000), {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      window.clearTimeout(timer);
      if (!response.ok) throw new Error('Calendar feed request failed');
      return response.json();
    }).then(function (feed) {
      if (generation !== loadGeneration) return;
      if (!feed || !Array.isArray(feed.events)) throw new Error("Malformed calendar snapshot");
      fictionalSource = false;
      writeCache(feed);
      render(feed);
    }).catch(function () {
      window.clearTimeout(timer);
      if (generation !== loadGeneration) return;
      if (!cached) render({ events: [] });
      if (status) status.textContent = cached ? "Snapshot request failed; showing cached chapter events. Retry Refresh chapter snapshot." : "Calendar snapshot unavailable. Open the chapter calendar or retry Refresh chapter snapshot.";
    });
  }

  function initViewSwitch() {
    var frame = document.getElementById('asmeCalendarFrame');
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-calendar-mode]'));
    if (!frame || !buttons.length) return;

    function setView(mode) {
      var url = new URL(frame.src);
      if (url.searchParams.get('mode') !== mode) {
        url.searchParams.set('mode', mode);
        frame.src = url.toString();
      }
      frame.title = mode === 'MONTH' ? 'ASME OSU monthly events calendar' : 'ASME OSU upcoming events calendar';
      buttons.forEach(function (candidate) {
        var active = candidate.getAttribute('data-calendar-mode') === mode;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    setView(window.matchMedia('(max-width: 700px)').matches ? 'AGENDA' : 'MONTH');

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var mode = button.getAttribute('data-calendar-mode') || 'AGENDA';
        setView(mode);
      });
    });
  }

  function removeBlogFromNavigation() {
    Array.prototype.slice.call(document.querySelectorAll('.main-navigation a[href]')).forEach(function (link) {
      try {
        var url = new URL(link.href, window.location.href);
        if (url.pathname.replace(/\/+$/, '') === '/asme/blog') {
          var item = link.closest('li');
          if (item) item.remove();
        }
      } catch (error) {}
    });
  }

  function removeWordPressInfoArtifacts() {
    /* wpautop can place blank paragraphs beside or inside the copy wrapper.
       Do not touch paragraphs with text or meaningful descendants such as the
       email/link. A whitespace-only or br-only paragraph is formatting only. */
    Array.prototype.slice.call(document.querySelectorAll('.asme-cal-page .acp-info-item p')).forEach(function (paragraph) {
      if (!paragraph.textContent.trim() && !paragraph.querySelector('a, button, input, select, textarea, img, svg, iframe')) {
        paragraph.hidden = true;
        // The live WordPress markup wraps copy in an extra div; its empty p
        // retains a theme margin unless display is explicitly reset.
        paragraph.style.setProperty('display', 'none', 'important');
      }
    });
  }

  function init() {
    if (document.documentElement.getAttribute('data-asme-calendar-ready') === 'true') return;
    document.documentElement.setAttribute('data-asme-calendar-ready', 'true');
    removeBlogFromNavigation();
    removeWordPressInfoArtifacts();
    initViewSwitch();
    initPreviewControls();
    if (document.getElementById('asmeFeaturedTitle') || document.getElementById('asmeCalendarUpcoming')) loadFeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
