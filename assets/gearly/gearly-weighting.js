/* Optional, local language weighting. Reads only the supplied intent and page data. */
(function (root) {
  'use strict';
  var stop = new Set('a an the is are was what where when how can could would i we you me my our your please find show tell do does have information about on in to for of with'.split(' '));
  function tokens(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/)
      .filter(function (token) { return token.length > 1 && !stop.has(token); });
  }
  function buildIDF(data, index) {
    var documents = [];
    (data && Array.isArray(data.intents) ? data.intents : []).forEach(function (intent) {
      if (!intent || typeof intent !== 'object') return;
      var examples = Array.isArray(intent.examples) ? intent.examples : [];
      var keywords = intent.keywords && typeof intent.keywords === 'object' ? Object.keys(intent.keywords) : [];
      documents.push(examples.join(' ') + ' ' + keywords.join(' '));
    });
    var records = Array.isArray(index) ? index : index && Array.isArray(index.records) ? index.records : [];
    records.forEach(function (record) {
      if (!record || typeof record !== 'object') return;
      documents.push([record.title, record.text, record.description,
        Array.isArray(record.keywords) ? record.keywords.join(' ') : '',
        Array.isArray(record.headings) ? record.headings.join(' ') : '',
        Array.isArray(record.sections) ? record.sections.map(function (section) { return section ? section.title + ' ' + (section.snippet || '') : ''; }).join(' ') : ''
      ].join(' '));
    });
    var frequencies = Object.create(null), weights = Object.create(null);
    documents.forEach(function (document) {
      new Set(tokens(document)).forEach(function (token) { frequencies[token] = (frequencies[token] || 0) + 1; });
    });
    Object.keys(frequencies).forEach(function (token) {
      weights[token] = 1 + Math.log((documents.length + 1) / (frequencies[token] + 1));
    });
    return {documents: documents.length, weights: weights};
  }
  function signal(idf, query, example) {
    var queryTokens = Array.from(new Set(tokens(query)));
    var exampleTokens = Array.from(new Set(tokens(example)));
    if (!queryTokens.length || !exampleTokens.length) return 0;
    var weights = idf && idf.weights && typeof idf.weights === 'object' ? idf.weights : {};
    function weight(token) { return Number.isFinite(weights[token]) && weights[token] > 0 ? weights[token] : 1; }
    function matches(a, b) { return a === b || Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a)); }
    var matchedWeight = 0, queryWeight = 0, exampleWeight = 0;
    queryTokens.forEach(function (token) {
      queryWeight += weight(token);
      if (exampleTokens.some(function (candidate) { return matches(token, candidate); })) matchedWeight += weight(token);
    });
    exampleTokens.forEach(function (token) { exampleWeight += weight(token); });
    var coverage = matchedWeight / queryWeight;
    var precisionWeight = exampleTokens.reduce(function (total, token) {
      return total + (queryTokens.some(function (candidate) { return matches(token, candidate); }) ? weight(token) : 0);
    }, 0);
    return Math.max(0, Math.min(1, .7 * coverage + .3 * precisionWeight / exampleWeight));
  }
  var api = {buildIDF: buildIDF, signal: signal};
  root.GearlyWeighting = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
