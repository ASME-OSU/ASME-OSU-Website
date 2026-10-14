(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GearlySite = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';
  var cache = new Map();
  var MAX_BYTES = 2 * 1024 * 1024;
  var SITE = 'https://org.osu.edu/asme/';
  var stopwords = new Set('a an and are as at be can do does for from how i in is it me of on or our the their this to us was we what when where which who why with you your tell about please'.split(' '));
  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function normalize(value) {
    return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function documentFor(value, options) {
    if (value?.querySelector) return value;
    var Parser = options?.DOMParser || root.DOMParser;
    if (!Parser) throw new Error('DOMParser is required');
    return new Parser().parseFromString(String(value || ''), 'text/html');
  }
  function readable(element) {
    var copy = element.cloneNode(true);
    copy.querySelectorAll('script,style,noscript,template,form,input,textarea,button,[hidden],[aria-hidden="true"]').forEach(function (node) { node.remove(); });
    return clean(copy.textContent);
  }
  function approvedURL(value, options) {
    var url = new URL(value, SITE);
    if (url.protocol !== 'https:' || url.hostname !== 'org.osu.edu' || url.port || url.username || url.password || !url.pathname.startsWith('/asme/')) throw new Error('Unapproved public page URL');
    if (options?.origin && url.origin !== options.origin) throw new Error('Public pages must use the same origin');
    if (root.location?.origin && url.origin !== root.location.origin) throw new Error('Public pages must use the same origin');
    var decodedPath = decodeURIComponent(url.pathname);
    if (!decodedPath.startsWith('/asme/') || decodedPath.split('/').includes('..')) throw new Error('Unapproved public page path');
    if (/\/(?:wp-admin|wp-login\.php|wp-content|wp-includes|files)(?:\/|$)/i.test(decodedPath)) throw new Error('Not a public page URL');
    var discovery = url.pathname === '/asme/wp-json/wp/v2/pages' && url.search === '?per_page=100&_fields=id,link,title,excerpt';
    if (decodedPath.includes('/wp-json/') && !discovery) throw new Error('Not the approved public page list');
    if (url.search && !discovery) throw new Error('Public page query parameters are not allowed');
    return url;
  }
  async function request(url, options) {
    options = options || {};
    var key = url.href;
    var cached = cache.get(key);
    if (cached && Date.now() - cached.at < 600000) return cached.text;
    var controller = new AbortController();
    var timer;
    var timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () { controller.abort(); reject(new Error('Public page request timed out')); }, 8000);
    });
    try {
      var result = await Promise.race([timeout, (async function () {
        var response = await (options.fetch || root.fetch)(url.href, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) throw new Error('Public page unavailable');
        if (response.url) approvedURL(response.url, options);
        if (Number(response.headers?.get('content-length')) > MAX_BYTES) throw new Error('Public page exceeds size limit');
        var reader = response.body?.getReader();
        if (!reader) {
          var text = await response.text();
          if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Public page exceeds size limit');
          return text;
        }
        var decoder = new TextDecoder();
        var total = 0;
        var chunks = [];
        try {
          while (true) {
            var part = await reader.read();
            if (part.done) break;
            total += part.value.byteLength;
            if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Public page exceeds size limit'); }
            chunks.push(decoder.decode(part.value, { stream: true }));
          }
          chunks.push(decoder.decode());
          return chunks.join('');
        } finally { reader.releaseLock(); }
      })()]);
      cache.set(key, { at: Date.now(), text: result });
      return result;
    } finally { clearTimeout(timer); }
  }
  function aliasesFor(name, overrides) {
    var primary = clean(name).split('|')[0].trim();
    var stripped = primary.replace(/\b(?:incorporated|inc|llc|corporation|corp|ltd)\b\.?/gi, '').replace(/[,]+/g, '').trim();
    var extra = Array.isArray(overrides) ? overrides.filter(function (entry) { return normalize(entry.name) === normalize(name) || normalize(entry.name) === normalize(primary); }).flatMap(function (entry) { return entry.aliases || []; }) : (overrides?.[name] || overrides?.[primary] || []);
    return Array.from(new Set([name, primary, stripped, normalize(stripped), normalize(stripped).replace(/\band\b/g, '').replace(/\s+/g, ' ').trim()].concat(extra).map(clean).filter(Boolean)));
  }
  function parseSponsors(documentOrHtml, overrides, options) {
    var doc = documentFor(documentOrHtml, options);
    var companies = Array.from(doc.querySelectorAll('article.sponsor-card, .partner-card')).map(function (card) {
      var name = clean(card.querySelector('h3')?.textContent);
      if (!name) return null;
      var ribbon = card.querySelector('.sponsor-ribbon');
      var tier = clean(ribbon?.getAttribute('aria-label')).replace(/\s+Sponsor tier$/i, '');
      if (!tier) tier = clean(card.querySelector('.sponsor-card-tier-badge')?.getAttribute('alt')).replace(/\s+tier badge$/i, '');
      if (!tier) tier = clean(card.closest('section')?.querySelector('h2')?.textContent) || 'Supporters';
      var id = normalize(name.split('|')[0].replace(/\b(?:incorporated|inc|llc|corporation|corp|ltd)\b\.?/gi, '')).replace(/\band\b/g, '').trim().replace(/\s+/g, '-');
      return { id: id, name: name, aliases: aliasesFor(name, overrides), tier: tier };
    }).filter(Boolean);
    var groups = new Map();
    companies.forEach(function (company) {
      if (!groups.has(company.tier)) groups.set(company.tier, []);
      groups.get(company.tier).push(company);
    });
    return { companies: companies, tiers: Array.from(groups, function (entry) { return { name: entry[0], companies: entry[1] }; }) };
  }
  function parseSponsorship(documentOrHtml, options) {
    var doc=documentFor(documentOrHtml,options), table=doc.querySelector('[data-gearly="sponsor-tiers"]');
    if(!table)return {intro:'',tiers:[]};
    var header=table.closest('section')?.querySelector('.sponsor-section-header p');
    var tiers=Array.from(table.querySelectorAll('.sponsor-tier-card')).map(function(card){return {name:clean(card.querySelector('.sponsor-tier-name')?.textContent),price:clean(card.querySelector('.sponsor-tier-price')?.textContent),perks:Array.from(card.querySelectorAll('.sponsor-tier-perks li')).map(function(perk){return readable(perk);}).filter(Boolean)};}).filter(function(tier){return tier.name;});
    return {intro:header?readable(header):'',tiers:tiers};
  }
  function parseFAQs(documentOrHtml, options) {
    var doc = documentFor(documentOrHtml, options);
    return Array.from(doc.querySelectorAll('[data-gearly="join-faq"] details.join-faq-item')).map(function (item) {
      var question = clean(item.querySelector('summary')?.textContent);
      var copy = item.cloneNode(true);
      copy.querySelector('summary')?.remove();
      var answer = readable(copy);
      return question && answer ? { question: question, answer: answer } : null;
    }).filter(Boolean);
  }
  function tokens(value) { return Array.from(new Set(normalize(value).split(' ').filter(function (token) { return token.length > 2 && !stopwords.has(token); }))); }
  function extract(question, pageHTML, selector, options) {
    var empty = { matched: false, text: '', sentences: [] };
    var doc = documentFor(pageHTML, options);
    var section;
    try { section = doc.querySelector(selector || 'main') || (!selector ? doc.body : null); } catch (_) { return empty; }
    if (!section) return empty;
    var query = tokens(question);
    if (!query.length) return empty;
    var paragraphs = Array.from(section.querySelectorAll('p,li,dd')).filter(function (element) { return !element.parentElement?.closest('li,dd'); });
    if (!paragraphs.length) return empty;
    var sentences = paragraphs.flatMap(function (element) { return readable(element).match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || []; }).map(clean).filter(Boolean);
    var ranked = sentences.map(function (sentence, index) {
      var words = tokens(sentence);
      var overlap = query.filter(function (word) { return words.includes(word); }).length;
      return { sentence: sentence, index: index, overlap: overlap, score: overlap / query.length };
    }).filter(function (entry) { return entry.overlap >= Math.min(2, query.length) && entry.score >= 0.5; });
    ranked.sort(function (a, b) { return b.score - a.score || b.overlap - a.overlap || a.index - b.index; });
    var chosen = ranked.slice(0, 3).sort(function (a, b) { return a.index - b.index; }).map(function (entry) { return entry.sentence; });
    return chosen.length ? { matched: true, text: chosen.join(' '), sentences: chosen } : empty;
  }
  async function loadPage(url, options) {
    var approved = approvedURL(url, options);
    if (approved.pathname.includes('/wp-json/')) throw new Error('loadPage requires a public HTML page');
    return request(approved, options);
  }
  async function discoverPages(options) {
    options = options || {};
    var endpoint = approvedURL(new URL('wp-json/wp/v2/pages?per_page=100&_fields=id,link,title,excerpt', options.siteBase || SITE).href, options);
    var rows = JSON.parse(await request(endpoint, options));
    if (!Array.isArray(rows)) throw new Error('Invalid public page list');
    var excluded = (options.excludedSlugs || []).map(normalize);
    var seen = new Set();
    return rows.map(function (row) {
      if (!row || typeof row.link !== 'string' || !row.link) return null;
      var url;
      try { url = approvedURL(row.link, options); } catch (_) { return null; }
      if (url.pathname.includes('/wp-json/') || (row.status && row.status !== 'publish')) return null;
      var slug = decodeURIComponent(url.pathname.replace(/\/$/, '').split('/').pop() || 'home');
      if (excluded.includes(normalize(slug))) return null;
      var title = readable(documentFor(row.title?.rendered || '', options).body);
      if (!title || seen.has(url.href)) return null;
      seen.add(url.href);
      var snippet = readable(documentFor(row.excerpt?.rendered || '', options).body).slice(0, 300);
      var enrichment = (options.enrichment || []).find(function (page) { return page.url === url.href || page.path === url.pathname || page.id === slug; }) || {};
      return Object.assign({}, enrichment, { id: enrichment.id || slug, sourceId: row.id, slug: slug, title: title, url: url.href, snippet: snippet, sections: enrichment.sections || [] });
    }).filter(Boolean);
  }
  return { parseSponsors: parseSponsors, parseSponsorship:parseSponsorship,parseFAQs: parseFAQs, loadPage: loadPage, extract: extract, discoverPages: discoverPages, clearCache: function () { cache.clear(); } };
});
