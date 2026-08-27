(function () {
  'use strict';

  var IS_LOCAL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  var FEED_URL = IS_LOCAL ? '/data/calendar-events.json' : 'https://asme-osu.github.io/ASME-OSU-Website/data/calendar-events.json';
  var CACHE_KEY = 'asmeCalendarEventsV2';
  var TIME_ZONE = 'America/New_York';

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

  function upcomingEvents(feed) {
    var now = new Date();
    if (!feed || !Array.isArray(feed.events)) return [];
    return feed.events.filter(function (event) {
      var start = safeDate(event.start);
      var end = safeDate(event.end);
      return start && ((end && end > now) || start >= now);
    }).sort(function (a, b) {
      return safeDate(a.start) - safeDate(b.start);
    });
  }

  function monthLabel(date) {
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: TIME_ZONE });
  }

  function dayLabel(date) {
    return date.toLocaleDateString('en-US', { day: 'numeric', timeZone: TIME_ZONE });
  }

  function formatEventDate(event) {
    var start = safeDate(event.start);
    var end = safeDate(event.end);
    if (!start) return 'Date to be announced';

    var dateText = start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: TIME_ZONE
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
    month.textContent = start ? monthLabel(start) : 'TBA';
    day.textContent = start ? dayLabel(start) : '—';
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
      empty.innerHTML = '<strong>No upcoming events are published yet.</strong><span>Subscribe or check the full calendar below for the latest schedule.</span>';
      grid.appendChild(empty);
      return;
    }

    events.slice(0, 3).forEach(function (event, index) {
      grid.appendChild(buildEventCard(event, index));
    });
  }

  function render(feed) {
    var events = upcomingEvents(feed);
    renderHome(events);
    renderCalendarPage(events);
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
    var cached = readCache();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, 4500);

    if (cached) render(cached);

    fetch(FEED_URL + '?hour=' + Math.floor(Date.now() / 3600000), {
      cache: 'no-store',
      credentials: 'omit',
      signal: controller ? controller.signal : undefined
    }).then(function (response) {
      window.clearTimeout(timer);
      if (!response.ok) throw new Error('Calendar feed request failed');
      return response.json();
    }).then(function (feed) {
      writeCache(feed);
      render(feed);
    }).catch(function () {
      window.clearTimeout(timer);
      if (!cached) render({ events: [] });
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

  function init() {
    if (document.documentElement.getAttribute('data-asme-calendar-ready') === 'true') return;
    document.documentElement.setAttribute('data-asme-calendar-ready', 'true');
    removeBlogFromNavigation();
    initViewSwitch();
    if (document.getElementById('asmeFeaturedTitle') || document.getElementById('asmeCalendarUpcoming')) loadFeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
