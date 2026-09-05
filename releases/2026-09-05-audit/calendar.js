(function () {
  'use strict';
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var FEED_URL = local ? '/data/calendar-events.json' : 'https://asme-osu.github.io/ASME-OSU-Website/data/calendar-events.json';
  var CACHE_KEY = 'asmeCalendarEventsV4';
  var TIME_ZONE = 'America/New_York';
  var MAX_AGE = 3 * 60 * 60 * 1000;
  var lastFeed = null, lastState = 'loading', shown = 3;
  var NON_CHAPTER = /classes begin|enrollment census date|last day of regularly scheduled|final exams?|^(?:autumn|spring|thanksgiving) break|academic winter recess|commencement|initial fee due date|new year.?s day|no classes|offices (?:closed|open)/i;
  function clean(value) { return typeof value === 'string' ? value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : ''; }
  function date(value) { var d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  function upcoming(feed, chapterOnly) {
    return feed.events.filter(function (e) { var start = date(e.start), end = date(e.end); return start && (end ? end > new Date() : start >= new Date()) && (!chapterOnly || !NON_CHAPTER.test(clean(e.title))); }).sort(function (a,b) { return new Date(a.start) - new Date(b.start); });
  }
  function format(e) {
    var start = date(e.start), end = date(e.end);
    var text = start.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:TIME_ZONE });
    if (e.allDay) return text + ' · All day';
    var options = { hour:'numeric', minute:'2-digit', timeZone:TIME_ZONE };
    return text + ' · ' + start.toLocaleTimeString('en-US', options) + (end ? '–' + end.toLocaleTimeString('en-US', options) : '') + ' ET';
  }
  function googleEvent(e) {
    function stamp(v) { return date(v).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
    var start = stamp(e.start), end = date(e.end) ? stamp(e.end) : start;
    if (e.allDay) { start = start.slice(0,8); end = end.slice(0,8); }
    var url = new URL('https://calendar.google.com/calendar/render');
    url.search = new URLSearchParams({ action:'TEMPLATE', text:clean(e.title), dates:start+'/'+end, details:clean(e.description)+'\nCheck https://org.osu.edu/asme/calendar/ for schedule changes.', location:clean(e.location), ctz:TIME_ZONE }).toString();
    return url.href;
  }
  function link(text, href) { var a=document.createElement('a'); a.textContent=text; a.href=href; a.target='_blank'; a.rel='noopener noreferrer'; return a; }
  function actions(e) {
    var wrap=document.createElement('div'); wrap.className='asme-event-actions';
    wrap.appendChild(link('Add this event',googleEvent(e)));
    if (clean(e.location)) wrap.appendChild(link('Directions', 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(clean(e.location))));
    return wrap;
  }
  function details(e) {
    var el=document.createElement('details'); el.className='asme-event-details';
    var summary=document.createElement('summary'); summary.textContent='Event details';
    var p=document.createElement('p'); p.textContent=clean(e.description)||'Additional details have not been published. Check the full calendar or chapter announcements before attending.';
    el.append(summary,p,actions(e));
    var note=document.createElement('small'); note.textContent='Adding one event saves a copy. Subscribe to the chapter calendar for automatic schedule updates.'; el.appendChild(note);
    return el;
  }
  function card(e) {
    var el=document.createElement('article'); el.className='acp-event-card';
    var day=document.createElement('div'); day.className='acp-event-date';
    var month=document.createElement('span'), num=document.createElement('strong');
    month.textContent=date(e.start).toLocaleDateString('en-US',{month:'short',timeZone:TIME_ZONE}); num.textContent=date(e.start).toLocaleDateString('en-US',{day:'numeric',timeZone:TIME_ZONE}); day.append(month,num);
    var copy=document.createElement('div'); copy.className='acp-event-copy';
    var title=document.createElement('h3'); title.textContent=clean(e.title)||'ASME event';
    var meta=document.createElement('p'); meta.className='acp-event-meta'; meta.textContent=format(e);
    var where=document.createElement('p'); where.className='acp-event-location'; where.textContent=clean(e.location)||'Location TBA';
    copy.append(title,meta,where,details(e));el.append(day,copy);return el;
  }
  function statusText(feed,state) {
    if (state==='error') return 'Upcoming events could not be loaded. The full Google Calendar is available below.';
    var generated=feed&&date(feed.generatedAt);
    var updated=generated?'Last refreshed '+generated.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:TIME_ZONE})+' ET.':'';
    if (state==='stale') return 'Showing saved events. '+updated+' Check the full calendar for recent changes.';
    return updated || 'Schedule loaded from the chapter calendar.';
  }
  function render(feed,state) {
    lastFeed=feed;lastState=state;
    var valid=feed&&Array.isArray(feed.events);
    var chapter=valid?upcoming(feed,true):[];
    var title=document.getElementById('asmeFeaturedTitle');
    if(title) {
      var description=document.getElementById('asmeFeaturedDescription'), when=document.getElementById('asmeFeaturedDate'), where=document.getElementById('asmeFeaturedLocation'), controls=document.getElementById('asmeFeaturedActions');
      var event=chapter[0];
      if(event) { title.textContent=clean(event.title);description.textContent=clean(event.description)||'Explore the details and join the chapter at our next event.';when.textContent=format(event);where.textContent=clean(event.location)||'Location TBA';if(controls) {controls.replaceChildren(details(event));controls.appendChild(link('Full calendar →','https://org.osu.edu/asme/calendar/'));} }
      else {title.textContent=state==='error'?'Check the chapter calendar':'More chapter events are on the way';description.textContent=state==='error'?'We could not load the event preview. Open the calendar for the latest schedule.':'Subscribe to hear when new chapter events are announced.';when.textContent='';where.textContent='';if(controls)controls.replaceChildren(link('View calendar →','https://org.osu.edu/asme/calendar/'));}
      var homeStatus=document.getElementById('asmeFeaturedStatus');if(!homeStatus){homeStatus=document.createElement('p');homeStatus.id='asmeFeaturedStatus';homeStatus.className='asme-calendar-status';description.after(homeStatus);} homeStatus.textContent=state==='stale'||state==='error'?statusText(feed,state):'';
    }
    var grid=document.getElementById('asmeCalendarUpcoming');if(!grid)return;
    grid.replaceChildren();grid.setAttribute('aria-busy','false');
    var include=document.getElementById('asmeIncludeAcademicDates');
    var events=valid?upcoming(feed,!(include&&include.checked)):[];
    if(!events.length){var empty=document.createElement('p');empty.className='acp-event-empty';empty.textContent=state==='error'?'The event list is unavailable. Please use the full calendar below.':'No upcoming events are currently listed in this view.';grid.appendChild(empty);}
    events.slice(0,shown).forEach(function(e){grid.appendChild(card(e));});
    var status=document.getElementById('asmeCalendarStatus');if(status)status.textContent=statusText(feed,state);
    var more=document.getElementById('asmeMoreEvents');if(more)more.hidden=events.length<=shown;
  }
  function readCache() {try{var cache=JSON.parse(localStorage.getItem(CACHE_KEY));return cache&&cache.feed&&Array.isArray(cache.feed.events)?cache:null;}catch(e){return null;} }
  function stateFor(feed,savedAt) {var generated=date(feed.generatedAt);return Date.now()-(generated?generated.getTime():savedAt)>MAX_AGE?'stale':'ready';}
  function load() {
    var cached=readCache();if(cached)render(cached.feed,stateFor(cached.feed,cached.savedAt));
    var controller=new AbortController();var timer=setTimeout(function(){controller.abort();},7000);
    fetch(FEED_URL+'?hour='+Math.floor(Date.now()/3600000),{cache:'no-store',credentials:'omit',signal:controller.signal}).then(function(response){if(!response.ok)throw new Error('Unavailable');return response.json();}).then(function(feed){if(!feed||!Array.isArray(feed.events))throw new Error('Invalid feed');try{localStorage.setItem(CACHE_KEY,JSON.stringify({savedAt:Date.now(),feed:feed}));}catch(e){}render(feed,stateFor(feed,Date.now()));}).catch(function(){render(cached?cached.feed:null,cached?'stale':'error');}).finally(function(){clearTimeout(timer);});
  }
  function init() {
    if(document.documentElement.dataset.asmeCalendarReady)return;document.documentElement.dataset.asmeCalendarReady='true';
    var frame=document.getElementById('asmeCalendarFrame');var buttons=Array.from(document.querySelectorAll('[data-calendar-mode]'));
    function setView(mode){if(!frame)return;var url=new URL(frame.src);if(url.searchParams.get('mode')!==mode){url.searchParams.set('mode',mode);frame.src=url.href;}frame.title=mode==='MONTH'?'ASME full monthly calendar':'ASME full upcoming calendar';buttons.forEach(function(b){var active=b.dataset.calendarMode===mode;b.classList.toggle('is-active',active);b.setAttribute('aria-pressed',String(active));});}
    setView(matchMedia('(max-width: 700px)').matches?'AGENDA':'MONTH');buttons.forEach(function(b){b.addEventListener('click',function(){setView(b.dataset.calendarMode);});});
    var academic=document.getElementById('asmeIncludeAcademicDates');if(academic)academic.addEventListener('change',function(){shown=3;render(lastFeed,lastState);});
    var more=document.getElementById('asmeMoreEvents');if(more)more.addEventListener('click',function(){shown+=3;render(lastFeed,lastState);});
    if(document.getElementById('asmeFeaturedTitle')||document.getElementById('asmeCalendarUpcoming'))load();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
