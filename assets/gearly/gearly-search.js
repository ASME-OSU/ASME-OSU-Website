/* Lazy local retrieval from approved public page text. No crawler or generated answers. */
(function(root){
  'use strict';
  var url, pending;
  var stop=new Set('a an the is are was what where when how can could would i we you me my our your please find show tell do does have information about on in to for of with'.split(' '));
  function tokens(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(function(t){return t.length>1 && !stop.has(t);});}
  function rank(records,query){
    var terms=Array.from(new Set(tokens(query)));if(!terms.length)return [];
    return records.filter(function(r){if(!r || typeof r.title!=='string' || typeof r.url!=='string')return false;try{var u=new URL(r.url);return u.origin==='https://org.osu.edu' && u.pathname.startsWith('/asme/') && !u.username && !u.password;}catch(_){return false;}}).map(function(r){
      var title=new Set(tokens(r.title+' '+(Array.isArray(r.keywords)?r.keywords.join(' '):''))),headings=new Set(tokens((Array.isArray(r.headings)?r.headings:[]).join(' '))),body=new Set(tokens(r.text));
      var hits=0,score=0;terms.forEach(function(t){function has(set){return set.has(t) || (t.length>=4 && Array.from(set).some(function(s){return s.startsWith(t);}));}if(has(title)){score+=6;hits++;}else if(has(headings)){score+=3;hits++;}else if(has(body)){score++;hits++;}});
      return {record:r,score:score,coverage:hits/terms.length};
    }).filter(function(v){return v.coverage>=.6 && v.score>0;}).sort(function(a,b){return b.coverage-a.coverage || b.score-a.score || a.record.id.localeCompare(b.record.id);}).slice(0,3).map(function(v){return {title:v.record.title,text:v.record.description,url:v.record.url};});
  }
  function safeRecord(record) {
    if (!record || typeof record.id !== 'string' || typeof record.url !== 'string') return false;
    try {
      var route = new URL(record.url);
      return route.origin === 'https://org.osu.edu' && route.pathname.startsWith('/asme/') && !route.username && !route.password;
    } catch (_) { return false; }
  }
  function safeSection(section, record) {
    return section && typeof section.id === 'string' && section.pageId === record.id &&
      typeof section.title === 'string' && typeof section.selector === 'string' &&
      (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(section.selector) || /^\[data-gearly='[A-Za-z][A-Za-z0-9_-]*'\]$/.test(section.selector)) &&
      !/modal/i.test(section.selector);
  }
  function rankSections(records, query) {
    var terms = Array.from(new Set(tokens(query)));
    if (!terms.length) return [];
    var ranked = [];
    records.filter(safeRecord).forEach(function (record) {
      (Array.isArray(record.sections) ? record.sections : []).forEach(function (section) {
        if (!safeSection(section, record)) return;
        var title = new Set(tokens(section.title + ' ' + (Array.isArray(section.keywords) ? section.keywords.join(' ') : '')));
        var body = new Set(tokens(section.snippet));
        var score = 0, hits = 0;
        function has(set, term) {
          return set.has(term) || term.length >= 4 && Array.from(set).some(function (word) { return word.startsWith(term); });
        }
        terms.forEach(function (term) {
          if (has(title, term)) { score += 6; hits++; }
          else if (has(body, term)) { score++; hits++; }
        });
        var coverage = hits / terms.length;
        if (coverage < .6 || score <= 0) return;
        ranked.push({
          id: section.id,
          page: record.url,
          snippet: section.snippet,
          title: section.title,
          text: section.snippet,
          url: record.url,
          pageId: record.id,
          pageTitle: record.title,
          selector: section.selector,
          score: score,
          coverage: coverage,
          action: {type: 'scrollTo', page: record.url, selector: section.selector, title: section.title, label: 'Show ' + section.title}
        });
      });
    });
    return ranked.sort(function (a, b) { return b.coverage - a.coverage || b.score - a.score || a.pageId.localeCompare(b.pageId) || a.selector.localeCompare(b.selector); }).slice(0, 3);
  }
  async function readIndex() {
    if (!url) return [];
    if (!pending) pending = root.fetch(url, {signal: AbortSignal.timeout(5000)}).then(function (response) {
      if (!response.ok) throw Error('Index unavailable');
      return response.json();
    }).then(function (data) {
      if (!data || !Array.isArray(data.records)) throw Error('Invalid index');
      return data.records;
    }).catch(function (error) { pending = null; throw error; });
    return pending;
  }
  root.GearlySearch = {
    configure: function (options) { url = new URL('gearly-index.json', options.assetBase).href; pending = null; },
    find: async function (query) { try { return rank(await readIndex(), query); } catch (_) { return []; } },
    findSections: async function (query) { try { return rankSections(await readIndex(), query); } catch (_) { return []; } },
    sections: async function () {
      try {
        var records = await readIndex(), sections = [];
        records.filter(safeRecord).forEach(function (record) {
          (Array.isArray(record.sections) ? record.sections : []).filter(function (section) { return safeSection(section, record); }).forEach(function (section) {
            sections.push({id: section.id, pageId: record.id, page: record.url, selector: section.selector, title: section.title, snippet: section.snippet});
          });
        });
        return sections;
      } catch (_) { return []; }
    },
    records: async function(){try{return await readIndex();}catch(_){return [];}},
    rankSections: rankSections
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = {rank: rank, records: async function(){try{return await readIndex();}catch(_){return [];}},
    rankSections: rankSections};
})(typeof window!=='undefined'?window:globalThis);
