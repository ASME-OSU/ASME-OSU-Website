(function () {
  'use strict';

  var IS_LOCAL = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  var FEED_URL = IS_LOCAL ? '/data/calendar-events.json' : 'https://asme-osu.github.io/ASME-OSU-Website/data/calendar-events.json';
  var SOCIAL_HUB_URL = 'https://asme-osu.github.io/ASME-Social-Hub';
  var campaigns = [];
  var currentFeed = null;
  var CACHE_KEY = 'asmeCalendarEventsV4';
  var TIME_ZONE = 'America/New_York';
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

  function campaignPageFor(event) {
    var start = safeDate(event.start);
    if (!start) return '';
    var matches = campaigns.filter(function (campaign) {
      if (!campaign || campaign.demo || campaign.deletedAt || campaign.cancelled) return false;
      if (!/^\d{4}-\d{2}$/.test(campaign.year || '') || !/^[a-z0-9][a-z0-9_-]{0,179}$/i.test(campaign.id || '')) return false;
      var campaignStart = safeDate(campaign.start);
      if (!campaignStart || campaignStart.getTime() !== start.getTime() || Boolean(campaign.allDay) !== Boolean(event.allDay)) return false;
      var source = campaign.source || {};
      if (source.uid) return source.uid === event.id;
      if (source.calendarUid) return event.id === source.calendarUid + '::' + start.toISOString();
      // Manually created campaigns have no calendar identity. Require both the
      // exact start time and title; never guess from a recurring title alone.
      return cleanText(campaign.title).toLowerCase() === cleanText(event.title).toLowerCase();
    });
    if (matches.length !== 1) return '';
    var page = new URL(SOCIAL_HUB_URL + '/event.html');
    page.searchParams.set('year', matches[0].year);
    page.searchParams.set('id', matches[0].id);
    return page.href;
  }

  function loadCampaigns() {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, 4500);
    fetch(SOCIAL_HUB_URL + '/data/archive-index.json', {
      cache: 'no-store', credentials: 'omit', signal: controller ? controller.signal : undefined
    }).then(function (response) {
      if (!response.ok) throw new Error('Campaign archive request failed');
      return response.json();
    }).then(function (archive) {
      if (!archive || !Array.isArray(archive.campaigns)) throw new Error('Malformed campaign archive');
      campaigns = archive.campaigns;
      if (currentFeed) render(currentFeed);
    }).catch(function () {
      // Missing/unavailable campaign data leaves calendar cards informational.
    }).finally(function () { window.clearTimeout(timer); });
  }

  function buildEventCard(event, index) {
    var start = safeDate(event.start);
    var campaignPage = campaignPageFor(event);
    var card = document.createElement(campaignPage ? 'a' : 'article');
    var dateBlock = document.createElement('div');
    var month = document.createElement('span');
    var day = document.createElement('strong');
    var copy = document.createElement('div');
    var title = document.createElement('h3');
    var meta = document.createElement('p');
    var location = document.createElement('p');

    card.className = 'acp-event-card' + (index === 0 ? ' acp-event-card--next' : '');
    if (campaignPage) {
      card.href = campaignPage;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.style.color = 'inherit';
      card.style.textDecoration = 'none';
      card.setAttribute('aria-label', cleanText(event.title) + ' — find out more (opens in a new tab)');
    }
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
    if (campaignPage) {
      var hint = document.createElement('p');
      hint.className = 'acp-event-more';
      hint.textContent = 'Click on the event to find out more. ↗';
      copy.appendChild(hint);
    }

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
    currentFeed = feed;
    var events = upcomingEvents(feed).filter(isChapterEvent);
    renderHome(events);
    renderCalendarPage(events);
  }

  // Older WordPress page copies still contain the rehearsal panel. Remove it
  // when loading the shared script so production stays clean before a CMS edit.
  function removePreviewInterface() {
    var page = document.querySelector('.asme-cal-page');
    if (!page) return;
    page.querySelectorAll('.acp-preview-controls, #asmeCalendarPreviewHelp, #asmeCalendarStatus').forEach(function (element) { element.remove(); });
    var badge = page.querySelector('.acp-live-badge');
    if (badge) badge.replaceChildren('Chapter events');
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
      if (!feed || !Array.isArray(feed.events)) throw new Error('Malformed calendar feed');
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
    removePreviewInterface();
    if (document.getElementById('asmeCalendarUpcoming')) loadCampaigns();
    if (document.getElementById('asmeFeaturedTitle') || document.getElementById('asmeCalendarUpcoming')) loadFeed();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
