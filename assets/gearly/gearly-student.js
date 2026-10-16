/* Grounded student answers: explicit actions first, with copy from approved site sources. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GearlyStudent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function normalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\bgroup me\b/g, 'groupme')
      .replace(/\bjon\b/g, 'join').replace(/\s+/g, ' ').trim();
  }
  function resolve(question, options) {
    options = options || {};
    var snapshot = options.snapshot || {}, source = snapshot.student;
    var q = normalize(question);
    if (!q || !source || !Array.isArray(source.resources) || !Array.isArray(snapshot.faqs)) return null;
    // These are answer records, not a replacement for privacy, leadership, or sponsor routing.
    if (/\b(?:passwords?|secret|api key|access token|admin|private data|reactor meltdown|chemistry exam|another planet)\b/.test(q)) return null;
    if (/\b(?:dont|do not|never|stop|quit|leave|cancel|unsubscribe|not interested)\b.{0,30}\b(?:join|groupme|newsletter|photos?|calendar|contact|show|subscribe)\b/.test(q)) return null;
    if (/\b(?:sponsorship|sponsor asme|become a sponsor|donate|donation|president|treasurer|leaderboard|member points|my points)\b/.test(q)) return null;
    if (/\b(?:gallery|photos?|groupme)\b/.test(q) && /\band\b/.test(q) && /\b(?:officers|newsletter|calendar)\b/.test(q)) return null;
    var base = options.siteBase || 'https://org.osu.edu/asme/';
    var email = options.contactEmail || 'asme@osu.edu';
    var contact = { title: 'Email ASME OSU', url: 'mailto:' + email };
    function page(path, title) { return { title: title, url: new URL(path, base).href }; }
    function faq(pattern) { return snapshot.faqs.find(function (entry) { return pattern.test(normalize(entry.question)); })?.answer || ''; }
    function resource(pattern) { return source.resources.find(function (entry) { return pattern.test(normalize(entry.title)); }); }
    function card(entry, text) { return entry && entry.url ? { title: entry.title, url: entry.url, text: text === undefined ? entry.text || '' : text } : null; }
    function result(id, text, cards, extra) {
      if (!text) return null;
      return Object.assign({ id: 'student-' + id, text: text, cards: (cards || []).filter(Boolean) }, extra || {});
    }
    var join = page('join/', 'Join ASME OSU');
    var packet = resource(/^career packet$/), ecs = resource(/^ecs career advising$/), national = resource(/^asme student resources$/);
    var eligibility = faq(/mechanical engineering major/), firstYear = faq(/first year students/), updates = faq(/hear about upcoming events/);
    var fee = faq(/membership fee/), involved = faq(/more involved/), events = faq(/kinds of events/);
    var signupCards = [card(source.signup), card(source.groupme)];

    if (/\bguarantee(?:d)?\b/.test(q) && /\b(?:internship|job|employment)\b/.test(q)) {
      return result('guarantee', 'ASME membership does not guarantee an internship or job. The published career resources offer preparation and recruiting help; hiring decisions are made by employers.', [card(packet), card(ecs)]);
    }
    if (/\bresume book\b/.test(q) || (/\b(?:submit|upload|share|send)\b/.test(q) && /\bresume\b/.test(q))) {
      var book = resource(/resume book/);
      return book ? result('resume-book', 'Use the résumé submission form. ' + book.text, [card(book)]) : null;
    }
    if (/\b(?:what should i wear|what do i wear|what to wear|dress code|attire|dress for)\b/.test(q)) {
      return packet ? result('attire', 'Start with the Career Packet for career preparation. I do not see event-specific attire instructions in these chapter sources; check the event announcement or contact ' + email + ' for the expected dress code.', [card(packet), contact]) : null;
    }
    if (/\boffice\b/.test(q) && !/\b(?:microsoft|word|excel|office 365)\b/.test(q)) {
      return result('office', (source.officeLocation ? 'The chapter office is listed as ' + source.officeLocation + '. ' : 'I do not see a chapter office location published. ') + 'I do not see office hours published; contact ' + email + ' to confirm availability.', [contact, page('', 'ASME OSU contact information')]);
    }
    if (/\bnewsletter\b/.test(q) && /\b(?:not getting|not receiving|havent received|missing|signed up but|problem|contact|never received|isnt arriving|isnt coming|dont get)\b/.test(q)) {
      return result('newsletter-help', 'For a newsletter signup or delivery problem, contact ' + email + '. The chapter lists the board as the contact for membership questions.', [contact, card(source.signup)]);
    }
    if (!/\b(?:scholarships?|internships?)\b/.test(q) && /\b(?:member|membership|join|asme)\b/.test(q) && /\b(?:gpa|grade point|application)\b/.test(q)) {
      return result('membership-requirements', (firstYear ? firstYear + ' ' : '') + 'I do not see a published minimum GPA or membership application requirement. The Join page provides newsletter signup and GroupMe access; contact ' + email + ' to confirm any other requirements.', signupCards.concat([contact]));
    }
    if (/\b(?:attend every|attendance requirement|minimum attendance|stay a member|class conflict|miss meetings|miss a meeting|mandatory attendance)\b/.test(q)) {
      return result('attendance', 'I do not see a published requirement to attend every meeting or a minimum attendance policy. Contact ' + email + ' about your schedule or class conflict.', [join, contact]);
    }
    if (/\bcalendar\b/.test(q) && /\b(?:add|subscribe|subscription|sync|google calendar|import)\b/.test(q)) {
      var calendar = resource(/^event calendar$/);
      var subscribe = calendar?.links?.find(function (link) { return /subscribe/i.test(link.title); });
      return subscribe ? result('calendar-subscribe', 'Open “Subscribe in Google Calendar,” sign in to Google if prompted, and confirm adding the ASME calendar. This opens the subscription link so you can add it yourself.', [{ title: 'Subscribe in Google Calendar', url: subscribe.url }, card(calendar)]) : null;
    }
    if (/\b(?:volunteer|help plan|help organize|committee opportunities)\b/.test(q) || (/\b(?:join|apply|become|get involved)\b/.test(q) && /\b(?:executive board|leadership|committee)\b/.test(q))) {
      return result('volunteer', involved, [card(resource(/^chapter leadership$/)), join]);
    }
    if (/\b(?:design competitions?|hands on projects?|project teams?)\b/.test(q)) {
      return national ? result('student-opportunities', national.text + ' I’ll check the chapter calendar for upcoming competitions. Contact ' + email + ' about chapter participation and project opportunities.', [card(national), contact], { liveSource: 'events', entities: { eventType: 'competition' }, explainLive: true }) : null;
    }
    if (/\bscholarships?\b/.test(q)) {
      return national ? result('scholarships', national.text + ' Check the national resource for current scholarships and requirements. I do not have a verified current chapter scholarship listing in these sources; contact ' + email + ' about chapter opportunities.', [card(national), contact]) : null;
    }
    if (/\bsae\b/.test(q) && /\b(?:difference|compare|comparison|versus|vs|asme and|asme or)\b/.test(q)) {
      return result('comparison', (events ? 'ASME OSU: ' + events + ' ' : '') + 'These ASME chapter sources do not verify SAE at Ohio State’s current scope or activities, so I cannot make a reliable comparison of the two chapters.', [page('aboutus/', 'About ASME OSU'), join]);
    }
    if (/\b(?:photos?|pictures?|gallery)\b/.test(q) && (/\b(?:see|view|find|where|show|past|events|gallery)\b/.test(q) || /^(?:photos|pictures|gallery)$/.test(q))) {
      var gallery = resource(/^event photos/);
      return gallery ? result('photos', gallery.text, [card(gallery)], { liveSource: 'gallery' }) : null;
    }
    if (/\bgroupme\b/.test(q) && (/\b(?:join|link|invite|invitation|where|access|how)\b/.test(q) || /^(?:asme(?: osu)? )?groupme$/.test(q))) {
      return source.groupme ? result('groupme', source.groupme.text, [card(source.groupme)]) : null;
    }
    if (/\b(?:dues|membership fee|membership cost|pay for national|national.*membership too|free to join|cost to join|costs to join)\b/.test(q)) {
      // Promotions in the source are not presented as verified current checkout terms.
      var free = fee.match(/[^.!?]*newsletter[^.!?]*free[.!?]/i)?.[0]?.trim() || '';
      var separate = fee.match(/ASME National membership is separate/i)?.[0] || '';
      var costs = fee.match(/[^.!?]*costs for special[^.!?]*[.!?]/i)?.[0]?.trim() || '';
      return result('fees', [free, separate ? separate + '; check ASME National for current membership terms.' : '', costs].filter(Boolean).join(' '), [join, card(resource(/^join asme national$/), '')]);
    }
    if (/\b(?:never been|first time|new to asme|newcomer|just show up)\b/.test(q) && /\b(?:event|meeting|asme|attend)\b/.test(q)) {
      return result('newcomer', (firstYear ? firstYear + ' ' : '') + 'Use the newsletter and GroupMe to find an event. Check that event’s announcement for RSVP or registration instructions; these sources do not establish a blanket no-RSVP policy.', signupCards);
    }
    if (/\b(?:interview|behavioral|technical interview)\b/.test(q) && /\b(?:practice|prep|prepare|preparation|questions|help|resources)\b/.test(q)) {
      return packet && ecs ? result('interview', packet.text + ' ' + ecs.text, [card(packet), card(ecs)]) : null;
    }
    if (/\b(?:resume|internships?|career|handshake)\b/.test(q) && (/\b(?:help|resources?|tips|finding|find|first internship|strategy|advising|where|review|improve)\b/.test(q) || /^(?:career resources|resume help|handshake)$/.test(q))) {
      var internship = /\binternships?\b/.test(q), second = internship ? resource(/^handshake$/) : ecs;
      return packet ? result('career', packet.text + (second ? ' ' + second.text : ''), [card(packet), card(second)]) : null;
    }
    var joining = /\b(?:join|sign up|signup|member|eligible|eligibility)\b/.test(q);
    var chapterContext = /\b(?:asme|newsletter|freshman|first year|aerospace|major|membership)\b/.test(q);
    var generalJoining = /^(?:(?:please|hi|hello|hey) )?(?:how (?:do|can) i (?:join|sign up)|can i join|am i eligible|who can join|eligibility|become a member|join|sign up|signup)(?: please)?$/.test(q);
    var eventSignup = /\b(?:rsvp|register|registration|matlab|bar social|event|session|meeting|under 21)\b/.test(q);
    if (joining && !eventSignup && (chapterContext || generalJoining)) {
      var welcome = eligibility.replace(/^(?:yes|no)[.!]\s*/i, '');
      var firstYearFact = firstYear.replace(/^(?:yes|no)[.!]\s*/i, '').split(/(?<=[.!?])\s+/)[0];
      return result('join', ['Yes.', welcome, /\b(?:freshman|first year)\b/.test(q) ? firstYearFact : '', updates.split(/(?<=[.!?])\s+/)[0]].filter(Boolean).join(' '), signupCards);
    }
    return null;
  }
  return { resolve: resolve, normalize: normalize };
});
