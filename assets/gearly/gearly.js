/* Gearly: deterministic, local site guide. No query logging or generative service. */
(function (root) {
  'use strict';
  var VERSION = '2.0.0';
  var USE_IDF = true;
  var idfCache = new WeakMap();
  function array(value){return Array.isArray(value)?value:[];}
  function normalize(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function safeURL(value) { if (typeof value !== 'string' || !value.trim()) return null; try { var u = new URL(value, root.location ? root.location.href : 'https://org.osu.edu/asme/'); return ['https:', 'http:', 'mailto:'].includes(u.protocol) ? u.href : null; } catch (_) { return null; } }
  function validateData(raw) {
    var errors = []; if (!raw || typeof raw !== 'object' || !raw.meta || typeof raw.meta!=='object' || !Array.isArray(raw.intents) || !Array.isArray(raw.pages)) return {data:null, errors:['Missing meta, intents, or pages']};
    var data = Object.assign({}, raw), ids = new Set();
    function selectorOK(value) { if (!value) return true; try { if (root.document) root.document.querySelector(value); return typeof value === 'string'; } catch (_) { return false; } }
    data.intents = raw.intents.filter(function (i) { var ok = i && typeof i.id === 'string' && !ids.has(i.id) && Array.isArray(i.examples) && i.examples.length>0 && i.examples.every(function(e){return typeof e==='string';}) && i.response && typeof i.response.text === 'string'; if (!ok) { errors.push('Invalid or duplicate intent: ' + (i && i.id)); return false; } ids.add(i.id); i.requires = array(i.requires).filter(function(v){return typeof v==='string';}); i.response.cards = array(i.response.cards).filter(function(v){return v && typeof v==='object' && typeof v.title==='string' && safeURL(v.url);}); i.response.chips = array(i.response.chips).filter(function(v){return typeof v==='string' || (v && typeof v.label==='string');}); i.actions = array(i.actions).filter(function(a) { var ok = a && selectorOK(a.selector); if(ok && a.steps)a.steps=array(a.steps).filter(function(step){return step && typeof step.text==='string' && selectorOK(step.selector);}); if (!ok) errors.push('Invalid action selector: '+i.id); return ok; }); return true; });
    ids.clear(); data.pages = raw.pages.filter(function(p) { var ok = p && p.id && !ids.has(p.id) && typeof p.title === 'string' && safeURL(p.url); if (!ok) { errors.push('Invalid page: '+(p && p.id)); return false; } ids.add(p.id);p.keywords=array(p.keywords).filter(function(k){return typeof k==='string';}); p.sections = array(p.sections).filter(function(s) { return s && s.id && selectorOK(s.selector); }); return true; });
    data.events = array(raw.events).filter(function(e) { var ok = e && e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !isNaN(Date.parse(e.date)) && new Date(e.date).toISOString().slice(0,10)===e.date; if (!ok) errors.push('Invalid event date'); return ok; });
    data.officers = array(raw.officers).filter(function(o) { return o && o.role && typeof o.name === 'string'; }); data.faqs = array(raw.faqs).filter(function(f) { return f && typeof f.q === 'string' && typeof f.a === 'string'; }); data.entities = raw.entities && typeof raw.entities==='object'?raw.entities:{}; data.synonyms = raw.synonyms && typeof raw.synonyms==='object'?raw.synonyms:{}; data.intents.forEach(function(i){if(!i.keywords || typeof i.keywords!=='object' || Array.isArray(i.keywords))i.keywords={};Object.keys(i.keywords).forEach(function(k){if(typeof i.keywords[k]!=='number' || !Number.isFinite(i.keywords[k]) || i.keywords[k]<=0)delete i.keywords[k];});});data.fallback = Object.assign({clarifyThreshold:.15, lowThreshold:.35, highThreshold:.65}, raw.fallback); return {data:data,errors:errors};
  }
  function createState() { return {topic:null,lastIntent:null,lastEntity:null,slots:{},pendingQuestion:null,history:[],visitedPages:[],unresolvedCount:0,dismissedNudges:[],pendingAction:null}; }
  function contains(text, phrase) { return (' '+text+' ').includes(' '+normalize(phrase)+' '); }
  function distance(a,b) { var row=Array.from({length:b.length+1},function(_,i){return i;});for(var i=1;i<=a.length;i++){var prev=row[0];row[0]=i;for(var j=1;j<=b.length;j++){var old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=old;}}return row[b.length]; }
  function expand(text, data) { var out = text; Object.keys(data.synonyms || {}).forEach(function(key) { var terms = [key].concat(array(data.synonyms[key])); if (terms.some(function(t) { return contains(text,t); })) out += ' '+terms.map(normalize).join(' '); }); return out; }
  function entitySlot(kind) {
    if (kind === 'roles') return 'role';
    if (kind === 'companies') return 'company';
    if (kind === 'eventTypes') return 'eventType';
    return 'topic';
  }
  function extractEntities(text, data, now) { var result = {}, n = normalize(text); Object.keys(data.entities).forEach(function(kind){var best=null;array(data.entities[kind]).forEach(function(e){if(!e || typeof e!=='object')return;[e.id,e.name].concat(array(e.aliases)).filter(function(a){return typeof a==='string' && a;}).forEach(function(alias){if(contains(n,alias) && (!best || normalize(alias).length>best.length))best={id:e.id,length:normalize(alias).length};else if(contains(n,alias) && best && normalize(alias).length===best.length && e.id!==best.id)best.ambiguous=true;});});if(best && !best.ambiguous)result[entitySlot(kind)]=best.id;}); ['company','social','workshop','competition','meeting','volunteering'].forEach(function(t) {if(!result.eventType && (contains(n,t) || contains(n,t+'s')))result.eventType=t;}); if(result.eventType==='meeting'){if(result.company)result.eventType='company';else delete result.eventType;}var instant=new Date(now || Date.now()),parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant),calendar={};parts.forEach(function(p){calendar[p.type]=p.value;});var base=new Date(Date.UTC(Number(calendar.year),Number(calendar.month)-1,Number(calendar.day))); var from = new Date(base), to = new Date(base), range;
    if (/tomorrow/.test(n)) {from.setUTCDate(from.getUTCDate()+1);to=new Date(from);range='tomorrow';} else if (/today|tonight/.test(n)) range='today'; else if (/next week|this week/.test(n)) {from.setUTCDate(from.getUTCDate()-((from.getUTCDay()+6)%7)+(/next week/.test(n)?7:0));to=new Date(from);to.setUTCDate(to.getUTCDate()+6);range=/next/.test(n)?'next-week':'this-week';} else if (/next month|this month/.test(n)) {from.setUTCDate(1);if(/next month/.test(n))from.setUTCMonth(from.getUTCMonth()+1);to=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+1,0));range=/next/.test(n)?'next-month':'this-month';}
    if(!range){var weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];var day=weekdays.findIndex(function(d){return contains(n,d);});if(day>=0){from.setUTCDate(from.getUTCDate()+(day-from.getUTCDay()+7)%7);to=new Date(from);range=weekdays[day];}var explicit=String(text).match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);var named=n.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?) (\d{1,2})(?: (\d{4}))?\b/);if(explicit || named){var months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];var month=explicit?Number(explicit[1])-1:months.indexOf(named[1].slice(0,3)),date=Number((explicit || named)[2]),year=Number((explicit || named)[3] || base.getUTCFullYear());var candidate=new Date(Date.UTC(year,month,date));if(candidate.getUTCMonth()===month && candidate.getUTCDate()===date){from=candidate;to=new Date(from);range='explicit';}}}if(range)result.dateRange={from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10),label:range}; return result;
  }
  // Polite scaffolding is not evidence of a topic. Keep domain words and negations.
  var stopwords=new Set('i me my you your we our us a an the do does did can could would will should want wants like please kindly tell show see find get give provide know as reach help information info view assistant updates latest current now there very much just really on at in of for to from with by is are am was were be been it this that these those how what who when where any some about more up have has had need needs access receive invitation registration invitation which chapter new guys student students member members membership team list listed public details address questions real currently among first serves serve handles handle representing represents presenting organizes organize manages manage planned plan happen soon attend opportunities opportunity take part design engineering preparing prepare finding look score posted post newest recently past activities activity archive browse point direct helped lot friend nice day powered use generate answers navigate learn focus explain purpose organization organizations support financially levels level next week month year today tomorrow posts online own earn'.split(' '));
  function contentTokens(text) { return normalize(text).split(' ').filter(function(w){return w && !stopwords.has(w);}); }
  var tokenCache=new WeakMap();
  function topicTokens(data,text) {
    var cache=tokenCache.get(data);if(!cache){cache=new Map();tokenCache.set(data,cache);}var cacheKey=normalize(text);if(cache.has(cacheKey))return cache.get(cacheKey).slice();var n=cacheKey;Object.keys(data.synonyms || {}).forEach(function(key){array(data.synonyms[key]).slice().sort(function(a,b){return String(b).length-String(a).length;}).forEach(function(term){var alias=normalize(term);if(alias && contains(n,alias))n=(' '+n+' ').split(' '+alias+' ').join(' '+normalize(key)+' ').trim();});});
    var protectedWords=new Set();Object.keys(data.synonyms || {}).forEach(function(k){normalize(k).split(' ').forEach(function(w){protectedWords.add(w);});});var tokens=normalize(n).split(' ').filter(function(w){return w && (!stopwords.has(w) || protectedWords.has(w));}).map(function(w){return w.length>4 && /ies$/.test(w)?w.slice(0,-3)+'y':w.length>3 && /s$/.test(w) && !/ss$/.test(w)?w.slice(0,-1):w;});
    if(tokens.some(function(w){return w!=='asme' && w!=='osu';}))tokens=tokens.filter(function(w){return w!=='asme' && w!=='osu';});var result=Array.from(new Set(tokens));if(cache.size>2000)cache.clear();cache.set(cacheKey,result);return result.slice();
  }
  function prepareText(data,text) {
    var n=normalize(text),vocabulary=new Set();data.intents.forEach(function(i){i.examples.concat(Object.keys(i.keywords || {})).forEach(function(e){normalize(e).split(' ').forEach(function(w){vocabulary.add(w);});});});
    Object.keys(data.synonyms || {}).forEach(function(k){[k].concat(array(data.synonyms[k])).forEach(function(t){normalize(t).split(' ').forEach(function(w){vocabulary.add(w);});});});Object.keys(data.entities || {}).forEach(function(kind){array(data.entities[kind]).forEach(function(entity){if(entity && typeof entity==='object')[entity.id,entity.name].concat(array(entity.aliases)).filter(function(v){return typeof v==='string';}).forEach(function(t){normalize(t).split(' ').forEach(function(w){vocabulary.add(w);});});});});var tokens=n.split(' '),merged=[];
    for(var j=0;j<tokens.length;j++){var joined=tokens[j]+(tokens[j+1] || '');if(tokens[j+1] && !vocabulary.has(tokens[j]) && !vocabulary.has(tokens[j+1]) && joined.length>=5 && vocabulary.has(joined)){merged.push(joined);j++;}else merged.push(tokens[j]);}
    return merged.map(function(w){if(w.length<4 || stopwords.has(w) || vocabulary.has(w))return w;var choices=Array.from(vocabulary).filter(function(v){return v.length>=4 && distance(w,v)<=1;});return choices.length===1?choices[0]:w;}).join(' ');
  }
  function scoreIntents(data,text,state) {
    var queryEntities=extractEntities(text,data),n=prepareText(data,text),words=topicTokens(data,n);var slotTokens=new Set();if(queryEntities.company){var company=array(data.entities.companies).find(function(c){return c && c.id===queryEntities.company;});if(company)[company.id,company.name].concat(array(company.aliases)).filter(function(alias){return typeof alias==='string' && contains(n,alias);}).forEach(function(alias){topicTokens(data,alias).forEach(function(w){slotTokens.add(w);});});if(queryEntities.eventType)words=words.filter(function(w){return !slotTokens.has(w);});}if(/\b(?:hi|hello|hey|bye|goodbye|thanks|thank)\b/.test(expand(n,data)))words=words.filter(function(w){return w!=='gearly';});
    var expanded=expand(n,data);if(words.indexOf('gearly')<0)expanded=expanded.replace(/\bgearly\b/g,'');var expandedWords=new Set(topicTokens(data,expanded)),known=new Set();data.intents.forEach(function(intent){Object.keys(intent.keywords || {}).concat(intent.examples).forEach(function(k){topicTokens(data,k).forEach(function(w){known.add(w);});});});var knownWords=words.filter(function(w){return known.has(w);}),unknown=words.filter(function(w){return !known.has(w) && !slotTokens.has(w);});
    return data.intents.map(function(i){
      var examples=i.examples.map(normalize),exact=examples.includes(n) || normalize(i.id)===n || (i.label && normalize(i.label)===n),weights=i.keywords || {},matched=new Set(),strongest=0;
      Object.keys(weights).forEach(function(k){if(contains(expanded,k)){strongest=Math.max(strongest,Number(weights[k]) || 1);topicTokens(data,k).forEach(function(w){matched.add(w);});}});
      var explained=words.filter(function(w){return matched.has(w);}).length,keyword=strongest && words.length ? .84*explained/words.length : 0,similarity=0;
      examples.forEach(function(example){var tokens=topicTokens(data,example);if(!tokens.length || !words.length)return;var common=tokens.filter(function(w){return expandedWords.has(w);}).length,precision=words.filter(function(w){return tokens.includes(w) || (matched.has(w) && common>0);}).length/words.length,recall=common/tokens.length;
        if(precision && recall){var value=.92*(2*precision*recall/(precision+recall));if(!strongest && tokens.length===1 && data.intents.some(function(other){return other.id!==i.id && Object.keys(other.keywords || {}).some(function(k){return topicTokens(data,k).length===1 && topicTokens(data,k)[0]===tokens[0];});}))value=Math.min(value,.5);similarity=Math.max(similarity,value);}
      });
      if(strongest && explained>0 && knownWords.length){var supported=knownWords.filter(function(w){return matched.has(w);}).length;keyword=Math.max(keyword,.84);}var score=exact?1:Math.max(keyword,similarity);
      if(USE_IDF && root.GearlyWeighting && !exact && !unknown.length && score>=data.fallback.lowThreshold){
        var idf=idfCache.get(data);if(!idf){idf=root.GearlyWeighting.buildIDF(data,data.searchIndex || []);idfCache.set(data,idf);}
        var rare=Math.max.apply(null,i.examples.map(function(example){return root.GearlyWeighting.signal(idf,n,example);}));
        score=Math.min(.99,score+.04*rare);
      }
if(i.id==='contact' && /\b(?:real|human|person)\b/.test(n) && /\b(?:help|ask|contact|reach|talk)\b/.test(n))score=1;var role=extractEntities(n,data).role;if(!exact && role && i.id===role && !unknown.length)score=1;if(queryEntities.company && queryEntities.eventType==='company' && i.id==='company-sessions' && !unknown.length)score=1;if(!exact && unknown.length)score=Math.min(score,.3);
      // Optional fuzzy suggestions stay below the clarification threshold; lexical matching decides answers.
      if(root.Fuse && score>0 && score<data.fallback.lowThreshold && !exact){try{var f=new root.Fuse(i.examples,{includeScore:true,threshold:.3}).search(text)[0];if(f)score=Math.max(score,Math.min(data.fallback.lowThreshold-.01,(1-f.score)*.34));}catch(_){}}
      if(array(i.negations).some(function(k){return contains(normalize(text),k) || contains(n,k);}) || /\b(?:not|dont|never|no|cancel|quit|leave)\b/.test(n))score=Math.max(0,score-.8);
      if(state && state.lastIntent===i.id && score>0 && /^(what about|and |when |where )/.test(n))score=Math.min(1,score+.1);
      return {intent:i,score:score,evidence:matched};
    }).map(function(candidate,_,all){if(candidate.score===1)return candidate;all.forEach(function(other){if(other===candidate || !candidate.evidence.size || !other.evidence.size)return;var subset=Array.from(candidate.evidence).every(function(w){return other.evidence.has(w);});if(subset && other.evidence.size>candidate.evidence.size)candidate.score=Math.min(candidate.score,.45);if(['join','contact'].includes(candidate.intent.id) && !['join','contact','eligibility','about'].includes(other.intent.id) && other.score>=.8 && /\b(?:register|registration|sign up|contact|email)\b/.test(n))candidate.score=Math.min(candidate.score,.45);if(candidate.intent.id==='events' && other.intent.liveSource==='events' && other.intent.id!=='events' && other.score>=.65)candidate.score=Math.min(candidate.score,.45);});return candidate;}).map(function(candidate){delete candidate.evidence;return candidate;}).sort(function(a,b){return b.score-a.score || a.intent.id.localeCompare(b.intent.id);});
  }
  function extractMemberName(text, state) {
    var value = String(text || '').trim().replace(/[.!?]+$/, '').trim();
    if(personalPoints(value))return null;
    var patterns = [
      /^(?:(?:check|show|look up|find)\s+)?(?:my\s+)?(?:points|rank)\s+for\s+(.+)$/i,
      /^(?:check\s+)?(.+?)[’']s\s+(?:points|rank)[?]?$/i,
      /^how many points does\s+(.+?)\s+have[?]?$/i,
      /^(?:what is|what's)\s+(.+?)[’']s\s+rank[?]?$/i,
      /^where is\s+(.+?)\s+on the leaderboard[?]?$/i,
      /^(?:look up|find|my name is|i'm|i am|this is)\s+(.+?)(?:[’']s points)?[?]?$/i,
      /^(.+?)\s+points[?]?$/i
    ];
    var candidate = null;
    if (state && state.pendingSlot === 'memberName') {
      candidate = value.replace(/^(?:it's|its|under|my name is|i'm|i am|that's|the name is)\s+/i, '').replace(/\s*please\s*$/i, '');
    } else {
      patterns.some(function (pattern) {
        var match = value.match(pattern);
        if (match) candidate = match[1];
        return Boolean(match);
      });
    }
    if (!candidate) return null;
    candidate = candidate.trim().replace(/\s+/g, ' ');
    var excluded = /^(?:my|your|me|i|asme|events?|join|contact|photos?|pictures?|gallery|instagram|leaderboard|rank|points?|members?|career resources|upcoming events|the leaderboard|the calendar|calendar|resources|sponsorship|officers?|thanks|hello|help)$/i;
    if (candidate.length < 2 || candidate.length > 60 || !/^[\p{L} .’'\-]+$/u.test(candidate) || !/\p{L}/u.test(candidate) || excluded.test(candidate) || /^(?:my|your|our|the|a|an|not|dont|never)\b/i.test(candidate) || /\b(?:can|could|does|how|what|where|student|students|major|majors|participate|events|resources)\b/i.test(candidate)) return null;
    return candidate;
  }
  function personalPoints(text) {
    var value=normalize(text).replace(/^(?:please|can you|could you|would you)\s+/, '').replace(/\s+please$/, '');
    if(/\b(?:not|dont|never|cancel|quit|leave)\b/.test(value))return false;
    return /^(?:(?:what are|what is|whats|check|show|tell me|look up|find) )?my (?:points|rank|ranking)$/.test(value) || /^(?:how many points do i have|where do i rank)$/.test(value);
  }
  function followupRequest(text) {
    var value=normalize(text);
    if(/^(?:tell me more|when is it|show me that)$/.test(value))return {index:0,kind:value==='tell me more'?'more':'select'};
    var selected=value.match(/^(?:(?:show me|show|open|tell me about) )?(?:the )?(first|second|third|1st|2nd|3rd)(?: one| result| photo| event)?$/);
    if(!selected)return null;
    return {index:/^(?:second|2nd)$/.test(selected[1])?1:/^(?:third|3rd)$/.test(selected[1])?2:0,kind:'select'};
  }
  function match(data,text,state) {state=state || createState();var entities=extractEntities(text,data), n=normalize(text);
    var follow=!state.pendingQuestion && followupRequest(text);
    var prior=data.intents.find(function(i){return i.id===state.lastIntent;});
    if(follow && prior && (['events','gallery','instagram'].includes(prior.liveSource) || array(prior.actions).some(function(a){return a.type==='scrollTo';})))return {kind:'answer',intent:prior,score:1,candidates:[],entities:entities};
    var name = extractMemberName(text,state);
    var memberIntent = data.intents.find(function(i){return i.id === (n === 'check my points' ? 'member-points' : 'my-points');}) || data.intents.find(function(i){return i.id==='my-points';});
    if(memberIntent && (name || personalPoints(text) || state.pendingSlot === 'memberName')) return {kind:'answer',intent:memberIntent,score:1,candidates:[],entities:entities}; if(state.pendingQuestion && /^(the )?(first|second|third)( one)?$/.test(n)){var idx=/second/.test(n)?1:/third/.test(n)?2:0;text=state.pendingQuestion[idx] || text;n=normalize(text);entities=extractEntities(text,data);}
    if(state.lastEntity && /contact (him|her|them)|their email|his email|her email/.test(n)){return {kind:'answer',intent:{id:'contact-'+state.lastEntity,response:{text:'The Leadership page has current public contact details.',cards:[{title:'Leadership',url:new URL('leadership/',data.meta.siteBase || 'https://org.osu.edu/asme/').href}]}},score:1,candidates:[],entities:entities};}
    var clauseText=normalize(text);array(data.entities.companies).forEach(function(company){if(!company)return;[company.id,company.name].concat(array(company.aliases)).filter(function(alias){return typeof alias==='string' && /\band\b/.test(normalize(alias));}).forEach(function(alias){var brand=normalize(alias);if(contains(clauseText,brand))clauseText=(' '+clauseText+' ').split(' '+brand+' ').join(' company ').trim();});});var clauses=clauseText.split(/\s+(?:and|also|plus)\s+/i);if(clauses.length===2){var first=scoreIntents(data,clauses[0],state),other=scoreIntents(data,clauses[1],state);if(first[0] && other[0] && first[0].score>=data.fallback.highThreshold && other[0].score>=data.fallback.highThreshold && first[0].intent.id!==other[0].intent.id && (!first[1] || first[0].score-first[1].score>=data.fallback.clarifyThreshold || first[0].score===1) && (!other[1] || other[0].score-other[1].score>=data.fallback.clarifyThreshold || other[0].score===1))return {kind:'clarify',intent:first[0].intent,score:first[0].score,candidates:[first[0],other[0]],entities:entities};}var scores=scoreIntents(data,text,state), top=scores[0], second=scores[1], kind='fallback';if(top && top.score>=data.fallback.highThreshold && (!second || (top.score===1 && second.score<1) || top.score-second.score>=data.fallback.clarifyThreshold))kind='answer';else if(top && top.score>=data.fallback.lowThreshold)kind='clarify';
    if(state.lastIntent && entities.dateRange && /^(what about|and|next|this)/.test(n)){top={intent:data.intents.find(function(i){return i.id===state.lastIntent;}),score:1};kind=top.intent?'answer':'fallback';}return {kind:kind,intent:top && top.intent,score:top?top.score:0,candidates:scores.slice(0,3),entities:entities}; }
  var api={followupRequest:followupRequest,personalPoints:personalPoints,extractMemberName:extractMemberName,normalize:normalize,safeURL:safeURL,validateData:validateData,createState:createState,extractEntities:extractEntities,scoreIntents:scoreIntents,match:match};if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(!root.document)return;
  var script=root.document.currentScript, base=new URL('.',script && script.src || root.location.href).href, data, state=createState(), panel, input, list, chips, launcher, avatar, activity, finishTyping, conversationGeneration = 0, privateTurn = false, memberCandidates = [], clarifyQuestion = null, lastCards = [];
  var assetVersion=script && script.src ? new URL(script.src).searchParams.get('v') || VERSION : VERSION;
  try {var saved=JSON.parse(root.sessionStorage.getItem('gearly_state_v1'));if(saved && Array.isArray(saved.history)){state=Object.assign(state,saved);state.history=state.history.slice(-50);state.slots=state.slots || {};}}catch(_){}
  function persist() {
    var saved = Object.assign({}, state, {slots:Object.assign({}, state.slots)});
    delete saved.slots.memberName;
    delete saved.pendingSlot;
    delete saved.memberCandidates;
    if(['leaderboard','my-points'].includes(saved.lastIntent))saved.lastResult=[];
    try {root.sessionStorage.setItem('gearly_state_v1', JSON.stringify(saved));} catch (_) {}
  }
  function el(tag,cls,text){var e=root.document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;}
  function button(text,fn){var b=el('button','gearly-chip',text);b.type='button';b.addEventListener('click',fn);return b;}
  var syncLauncherMotion=function(){};
  function setAvatar(stateName){if(!avatar)return;avatar.dataset.state=stateName;var sprites=data.meta.sprites || {};var value=sprites[stateName] || sprites.idle;var path=typeof value==='string'?value:value && (value.path || value.file || value.url);if(path){var url=safeURL(new URL(path,base).href);if(url){avatar.replaceChildren();var img=el('img','gearly-avatar-image');img.src=url;img.alt='';avatar.append(img);}}}

  // Pose reactions share pointer and keyboard behavior; no timer or idle loop.
  function reactPose(control,image,file){
    var original=image.src,active=new URL('sprites/'+file,base).href;
    function update(){image.src=control.matches(':hover') || control.contains(root.document.activeElement)?active:original;}
    control.addEventListener('mouseenter',function(){image.src=active;});
    control.addEventListener('mouseleave',update);control.addEventListener('focusin',function(){image.src=active;});control.addEventListener('focusout',function(){root.setTimeout(update,0);});
  }
  // One early greeting, then infrequent waves. Keep the same image geometry for both poses.
  function setupLauncherMotion(){
    var still=new URL(data.meta.sprites.launcher || data.meta.sprites.idle,base).href;
    var config=data.meta.launcherAnimation || {},timer,objectURL,blob,epoch=0,lastPlayed=0,playing=false,loading=false;
    var motion=root.matchMedia('(prefers-reduced-motion: reduce)');
    var face=el('img','gearly-avatar-image');face.alt='';face.width=72;face.height=72;face.src=still;launcher.prepend(face);
    function eligible(){return panel.hidden && !root.document.hidden && !motion.matches && !!config.path;}
    function stop(){epoch++;root.clearTimeout(timer);playing=false;loading=false;face.src=still;launcher.dataset.animating='false';launcher.dataset.motion=motion.matches?'reduced-motion':'idle';if(objectURL){root.URL.revokeObjectURL(objectURL);objectURL=null;}}
    function schedule(retry){if(eligible())timer=root.setTimeout(play,retry || (lastPlayed?60000+Math.round(Math.random()*30000):8000+Math.round(Math.random()*4000)));}
    async function play(){
      if(!eligible() || playing || loading)return;
      var turn=epoch;loading=true;root.clearTimeout(timer);launcher.dataset.motion='loading';
      try{
        if(!blob){var response=await root.fetch(new URL(config.path,base).href);if(!response.ok)throw Error('Wave unavailable');blob=await response.blob();}
        if(turn!==epoch || !eligible())return;
        // New local URLs restart a single playthrough without another download.
        objectURL=root.URL.createObjectURL(blob);face.src=objectURL;
        if(face.decode)await face.decode();
        if(turn!==epoch || !eligible())return;
        loading=false;playing=true;lastPlayed=Date.now();launcher.dataset.waveCount=String(Number(launcher.dataset.waveCount || 0)+1);launcher.dataset.animating='true';launcher.dataset.motion='playing';
        timer=root.setTimeout(function(){stop();schedule();},config.durationMs || 6250);
      }catch(_){if(turn!==epoch)return;blob=null;stop();launcher.dataset.motion='retry-wait';schedule(90000);}
    }
    face.addEventListener('error',function(){if(face.src!==still){blob=null;stop();launcher.dataset.motion='retry-wait';schedule(90000);}});
    function greet(){if(!lastPlayed || Date.now()-lastPlayed>=60000)play();}
    launcher.addEventListener('mouseenter',greet);
    launcher.addEventListener('focusin',function(){if(launcher.matches(':focus-visible'))greet();});
    syncLauncherMotion=function(){stop();schedule();};
    root.document.addEventListener('visibilitychange',syncLauncherMotion);
    if(motion.addEventListener)motion.addEventListener('change',syncLauncherMotion);
    syncLauncherMotion();
  }
  function setChips(values){chips.replaceChildren();array(values).slice(0,6).forEach(function(v){var label=typeof v==='string'?v:v.label;chips.append(button(label,function(){ask(typeof v==='string'?v:v.query || label);}));});}
  function historyCards(cards) {
    return array(cards).slice(0,5).filter(function(card){return card && typeof card.title==='string' && safeURL(card.url);}).map(function(card){
      var saved={title:card.title.slice(0,180),url:safeURL(card.url)};
      if(typeof card.text==='string')saved.text=card.text.slice(0,1200);
      if(typeof card.detailAvailable==='boolean')saved.detailAvailable=card.detailAvailable;
      return saved;
    });
  }
  function message(text,who,cards){var imageCount=0;var item=el('div','gearly-message gearly-'+who);if(who==='bot'){var head=el('img','gearly-message-avatar');head.src=new URL('sprites/gearly-neutral-head.webp',base).href;head.alt='';head.width=28;head.height=28;item.prepend(head);}item.append(el('p','',text));array(cards).slice(0,5).forEach(function(card){if(!card || typeof card!=='object')return;var url=safeURL(card.url);if(!url)return;var a=el('a','gearly-card');a.href=url;
      if(card.image && imageCount < 3){
        var src=safeURL(card.image.src);
        if(src && new URL(src).protocol === 'https:'){
          var image=el('img');image.src=src;image.alt=typeof card.image.alt==='string'?card.image.alt:'';image.loading='lazy';image.decoding='async';
          ['width','height'].forEach(function(key){if(Number.isInteger(card.image[key]) && card.image[key]>0)image.setAttribute(key,String(card.image[key]));});
          if(card.image.width && card.image.height)image.style.aspectRatio=card.image.width+'/'+card.image.height;
          image.addEventListener('error',function(){image.remove();});a.append(image);imageCount++;
        }
      }
      a.append(el('strong','',card.title || 'Open page'));if(card.text)a.append(el('span','',card.text));if(new URL(url).origin!==root.location.origin){a.target='_blank';a.rel='noopener noreferrer';}item.append(a);});if(chips && chips.parentNode===list)list.insertBefore(item,chips);else list.append(item);list.scrollTop=list.scrollHeight;if(!privateTurn)state.history.push({text:text,who:who,cards:who==='bot' && !['leaderboard','my-points'].includes(state.lastIntent)?historyCards(cards):[]});state.history=state.history.slice(-50);persist();return item;}
  function currentPage(){var selected=new URLSearchParams(root.location.search).get('page');return data.pages.find(function(p){if(selected)return p.sourceFile===selected;try{return new URL(p.url,root.location.href).pathname.replace(/\/$/,'')===root.location.pathname.replace(/\/$/,'');}catch(_){return false;}}) || (root.location.hostname==='127.0.0.1'?data.pages.find(function(p){return p.id==='home';}):null);}
  function starterChips(){var page=currentPage();return page && array(page.suggestions).length?page.suggestions:['Events','Join','Careers','Tour'];}
  function reducedMotion(){return root.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function stopActivity(){if(activity){activity.remove();activity=null;}list.removeAttribute('aria-busy');}
  function startActivity(){stopActivity();activity=el('div','gearly-activity');activity.setAttribute('role','status');var thinking=el('img','gearly-activity-sprite');thinking.src=new URL('sprites/gearly-thinking-chin.webp',base).href;thinking.alt='';activity.append(thinking,el('span','gearly-activity-label','Finding the right page'));var dots=el('span','gearly-dots');dots.setAttribute('aria-hidden','true');for(var n=0;n<3;n++)dots.append(el('i'));activity.append(dots);list.append(activity);list.setAttribute('aria-busy','true');list.scrollTop=list.scrollHeight;}
  function delay(ms){return new Promise(function(resolve){root.setTimeout(resolve,ms);});}
  async function respond(text,cards,generation,started){
    if(!reducedMotion())await delay(Math.max(0,280-(Date.now()-started)));
    if(generation!==conversationGeneration)return false;
    stopActivity();setAvatar('typing');
    var item=message(text,'bot',cards),p=item.querySelector('p');
    if(reducedMotion())return true;
    // Announce a completed answer once, rather than every animated character.
    p.setAttribute('aria-hidden','true');p.textContent='';
    var links=Array.from(item.querySelectorAll('a'));links.forEach(function(link){link.hidden=true;});
    var label=el('span','gearly-typing-label','Gearly is typing');label.setAttribute('role','status');var typist=item.querySelector('.gearly-message-avatar');typist.classList.add('gearly-reply-sprite');item.insertBefore(label,p);
    var complete=function(){p.textContent='';p.removeAttribute('aria-hidden');p.append(el('span','',text));links.forEach(function(link){link.hidden=false;});label.remove();typist.classList.remove('gearly-reply-sprite');if(finishTyping===complete)finishTyping=null;};
    finishTyping=complete;
    var duration=Math.min(1000,Math.max(350,text.length*8)),began=Date.now();
    while(Date.now()-began<duration){if(generation!==conversationGeneration)return false;p.textContent=text.slice(0,Math.ceil(text.length*(Date.now()-began)/duration));list.scrollTop=list.scrollHeight;await delay(30);}
    if(generation!==conversationGeneration)return false;complete();list.scrollTop=list.scrollHeight;return true;
  }
  function welcome(){
    var greeting=message('Hi! I’m Gearly 👋 I can help you find events, join ASME, explore career resources, or take a tour.','bot');greeting.classList.add('gearly-welcome');
    var shortcuts=el('div','gearly-shortcuts');(topicShortcuts().length?topicShortcuts():array(data.pages).slice(0,4).map(function(page){return {label:page.title,query:page.title};})).forEach(function(shortcut){var control=button(shortcut.label,function(){if(shortcut.tour)startTour();else ask(shortcut.query);});control.className='gearly-shortcut';var shortcutSprite=el('img','gearly-shortcut-sprite');var file=shortcut.tour?'gearly-peeking-thumbs-up.webp':shortcut.query==='Events'?'gearly-calendar-presenting.webp':shortcut.query==='join'?'gearly-double-thumbs-up.webp':'gearly-executive-briefcase.webp';shortcutSprite.src=new URL('sprites/'+file,base).href;shortcutSprite.alt='';shortcutSprite.width=40;shortcutSprite.height=40;var shortcutLabel=el('span','',shortcut.label);control.replaceChildren(shortcutSprite,shortcutLabel);control.setAttribute('aria-label',shortcut.label);reactPose(control,shortcutSprite,shortcut.tour?'gearly-peeking-banner.webp':shortcut.query==='join'?'gearly-celebrating-jump.webp':shortcut.query==='Events'?'gearly-calendar-presenting.webp':'gearly-laptop-presenting.webp');shortcuts.append(control);});list.append(shortcuts);
  }
  function browseTopics(){list.querySelectorAll('.gearly-shortcuts').forEach(function(node){node.remove();});list.querySelectorAll('.gearly-welcome').forEach(function(node){node.classList.remove('gearly-welcome');});setChips(topicShortcuts().map(function(topic){return {label:topic.label,query:topic.query || 'tour'};}).concat(data.pages.filter(function(page){return !topicShortcuts().some(function(t){return t.pageId===page.id;});}).map(function(page){return {label:page.title,query:page.title};})));var first=chips.querySelector('button');if(first)first.focus();}
  function resetChat(){lastCards=[];privateTurn=false;memberCandidates=[];conversationGeneration++;if(finishTyping)finishTyping();stopActivity();state=createState();list.replaceChildren(chips);input.value='';persist();welcome();setChips(starterChips());setAvatar('idle');input.focus();}
  function startTour(){if(root.GearlyTour){close();root.GearlyTour.start();}}
  function open(){if(!panel)return;if(root.GearlyTour && root.GearlyTour.clearSection)root.GearlyTour.clearSection();if(root.GearlyTour && root.GearlyTour.dismissOffer)root.GearlyTour.dismissOffer();panel.hidden=false;launcher.hidden=true;launcher.setAttribute('aria-expanded','true');syncLauncherMotion();input.focus();}
  function close(){if(!panel)return;panel.hidden=true;launcher.hidden=false;launcher.setAttribute('aria-expanded','false');syncLauncherMotion();launcher.focus();}
  function placeSprite(action){var page=action.page || '';return /member-points/.test(page)?'gearly-growth-chart.webp':/calendar/.test(page)?'gearly-calendar-presenting.webp':/member-resources|sponsor/.test(page)?'gearly-executive-briefcase.webp':/join/.test(page)?'gearly-double-thumbs-up.webp':'gearly-pointing-right.webp';}
  function placeCard(action){
    var card=el('button','gearly-place-card');card.type='button';card.setAttribute('aria-label',action.label || 'Show this section');var image=el('img','gearly-place-sprite');image.src=new URL('sprites/gearly-peeking-side.webp',base).href;image.alt='';image.width=72;image.height=72;image.addEventListener('error',function(){image.remove();});var copy=el('span','gearly-place-copy');copy.append(el('strong','',action.title || action.label || 'Explore this section'));if(action.text)copy.append(el('span','',action.text));copy.append(el('span','gearly-place-cta',(action.label || 'Show me')+' →'));card.append(image,copy);reactPose(card,image,'gearly-winking-peek.webp');card.addEventListener('click',function(){close();if(!root.GearlyTour.showSection(action)){open();message('That section is unavailable here. Try its page link.','bot');}});return card;
  }
  function requestedSection(text,actions,entities){
    // Informational questions stay in chat. Explicit navigation opens a confirmed section.
    var n=normalize(text);if(!/\b(?:show|open|pull up|bring up|take me|go to|jump to|where is|where are|where can|where do|where am i)\b/.test(n))return null;
    if(entities && (entities.dateRange || entities.company || entities.eventType))return null;
    var sections=array(actions).filter(function(a){return a && ['scrollTo','openFaq'].includes(a.type) && a.page && a.selector;});
    if(/\bmy\b.*\b(?:rank|ranking|standing|points)\b|\bwhere am i\b/.test(n)){var personal=sections.find(function(a){return a.selector==='#member-dashboard';});if(personal)return personal;}
    return sections[0] || null;
  }
  function actionButtons(actions){array(actions).forEach(function(a){if(!a || typeof a!=='object')return;if(['scrollTo','openFaq'].includes(a.type) && a.page && root.GearlyTour && root.GearlyTour.showSection){var item=Array.from(list.querySelectorAll('.gearly-bot')).pop();if(item){var firstLink=item.querySelector('a.gearly-card');if(firstLink)item.insertBefore(placeCard(a),firstLink);else item.append(placeCard(a));}return;}chips.append(button(a.label || (a.type==='navigate'||a.type==='openLink'?'Take me there':'Show me'),function(){if(a.type==='tour' && root.GearlyTour){startTour();return;}if(a.type==='tour' && Array.isArray(a.steps)){var index=0;function step(){var st=a.steps[index],node;try{node=st && root.document.querySelector(st.selector);}catch(_){}if(!st)return;message(st.text || 'Explore this section.','bot');if(node){node.scrollIntoView({block:'center',behavior:'auto'});node.classList.add('gearly-highlight');root.setTimeout(function(){node.classList.remove('gearly-highlight');},3000);}setChips([]);chips.append(button('Skip',function(){setChips(['Events','Join','Contact']);}));if(index>0)chips.append(button('Back',function(){index--;step();}));if(index<a.steps.length-1)chips.append(button('Next',function(){index++;step();}));}step();return;}var target;try{target=a.selector && root.document.querySelector(a.selector);}catch(_){}if(a.type==='navigate'||a.type==='openLink'){var url=safeURL(a.url);if(url)root.location.assign(url);return;}if(!target){message("I can't point to that here. Use the page links above.",'bot');return;}if(a.type==='openFaq'){if(target.tagName==='DETAILS')target.open=true;else {var toggle=target.querySelector('button,[aria-expanded]');if(toggle && toggle.getAttribute('aria-expanded')!=='true')toggle.click();}}target.scrollIntoView({block:'center',behavior:'instant'});target.classList.add('gearly-highlight');root.setTimeout(function(){target.classList.remove('gearly-highlight');},3000);}));});}
  async function search(text) {
    var local=root.GearlySearch?await root.GearlySearch.find(text):[];
    var words=contentTokens(text), ranked=data.pages.map(function(page){var value=normalize(page.title+' '+(page.snippet || '')+' '+array(page.keywords).join(' '));return {page:page,hits:words.filter(function(word){return contains(value,word);}).length};}).filter(function(entry){return entry.hits>=Math.min(2,words.length) && entry.hits>0;}).sort(function(a,b){return b.hits-a.hits;}).slice(0,3);
    for(var entry of ranked){
      var card={title:entry.page.title,text:entry.page.snippet,url:entry.page.url};
      if(root.GearlySite){try{var html=await root.GearlySite.loadPage(entry.page.url,{origin:root.location.origin});var extracted=root.GearlySite.extract(text,html);if(extracted.matched)card.text=extracted.text;}catch(_){}}
      if(!local.some(function(item){return item.url===card.url;}))local.push(card);
    }
    return local.slice(0,3);
  }
  function teamCard(question) {
    var email = data.meta.contactEmail;
    if(typeof email !== 'string' || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email))return null;
    var cleaned = String(question || '').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email removed]').replace(/(?:\+?\d[\d ().-]{5,}\d)/g,'[phone removed]').slice(0,300);
    var subject = 'Question for ASME (from the website guide)';
    var body = 'Hello ASME team,\n\nI have a question from the website guide:\n'+cleaned+'\n\nThank you!';
    return {title:'Ask the ASME team',text:email,url:'mailto:'+email+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body)};
  }
  async function leadershipAnswer(text, result) {
    if(!root.GearlyContent || !/\b(?:who|president|treasurer|officers?|board|leadership|administrator|webmaster|chair|contact|email|previous)\b/i.test(text))return null;
    try {
      var snapshot=await root.GearlyContent.loadLeadership({siteBase:data.meta.siteBase,roles:data.entities.roles,snapshotURL:new URL('gearly-officers.json',base).href,origin:root.location.origin});
      var role = result.entities.role || (/\b(?:him|her|them|their|his)\b/i.test(text)?state.lastEntity:null);
      return root.GearlyContent.resolveLeadership(snapshot,text,{roles:data.entities.roles,roleId:role,siteBase:data.meta.siteBase});
    } catch (_) {return null;}
  }
  var siteSnapshot = {companies:[],tiers:[],faqs:[]}, siteSnapshotReady=Promise.resolve();
  function configureLive() {
    if(root.GearlyLive && root.GearlyLive.configure)root.GearlyLive.configure(Object.assign({},data.meta,{baseURL:data.meta.assetBase,companies:data.entities.companies,eventTypes:data.eventTypes,eventRules:data.eventRules}));
  }
  function derivedCompanies(companies) {
    return array(companies).map(function(company){var primary=company.name.split('|')[0].replace(/\b(?:incorporated|inc|llc|corporation|corp|ltd)\b\.?/gi,'');return Object.assign({},company,{id:normalize(primary).replace(/\band\b/g,'').trim().replace(/\s+/g,'-')});});
  }
  async function loadSiteSnapshot() {
    try {var response=await root.fetch(new URL('gearly-site.json',base).href,{signal:AbortSignal.timeout(5000)});if(response.ok){var snapshot=await response.json();if(snapshot && Array.isArray(snapshot.companies) && Array.isArray(snapshot.tiers) && Array.isArray(snapshot.faqs))siteSnapshot=snapshot;}}catch(_){}
  }
  async function refreshSite() {
    if(!root.GearlySite)return;
    await siteSnapshotReady;
    if(siteSnapshot.companies.length){data.entities.companies=derivedCompanies(siteSnapshot.companies);configureLive();}
    try {
      var discovered=await root.GearlySite.discoverPages({siteBase:data.meta.siteBase,excludedSlugs:data.excludedSlugs,enrichment:data.pages,origin:root.location.origin});
      if(discovered.length){data.pages=discovered;tokenCache.delete(data);if(root.GearlyTour)root.GearlyTour.configure({data:data,assetBase:base});}
    }catch(_){}
    try {var html=await root.GearlySite.loadPage(new URL('current-sponsors/',data.meta.siteBase).href,{origin:root.location.origin});var sponsors=root.GearlySite.parseSponsors(html,data.companyAliases);if(sponsors.companies.length){siteSnapshot.companies=sponsors.companies;siteSnapshot.tiers=sponsors.tiers;data.entities.companies=derivedCompanies(sponsors.companies);tokenCache.delete(data);configureLive();}}catch(_){}
  }
  function sponsorshipResponse(options, page) {
    return {text:'Sponsorship options from the Sponsor ASME page. '+(options.intro || ''),cards:options.tiers.map(function(tier){return {title:tier.name+(tier.price?' — '+tier.price:''),text:tier.perks.join('; '),url:page};})};
  }
  async function sourceAnswer(intent, text) {
    if(intent.static === true || !root.GearlySite || !intent.source)return null;
    var source=intent.source, page=data.pages.find(function(p){return p.url===source.page;});
    try {
      var html=await root.GearlySite.loadPage(source.page,{origin:root.location.origin});
      if(intent.id==='sponsorship' && root.GearlySite.parseSponsorship){var options=root.GearlySite.parseSponsorship(html);if(options.tiers.length)return sponsorshipResponse(options,source.page);}
      if(intent.id==='sponsors') {
        var sponsors=root.GearlySite.parseSponsors(html,data.companyAliases);
        if(sponsors.tiers.length)return {text:sponsors.tiers.map(function(tier){return tier.name+': '+tier.companies.map(function(c){return c.name;}).join(', ');}).join('\n'),cards:[{title:'From the '+(page?page.title:'Sponsors')+' page',url:source.page}]};
      }
      if(intent.id==='eligibility')siteSnapshot.faqs=root.GearlySite.parseFAQs(html);
      if(intent.id==='eligibility'){var faq=bestFAQ(text,siteSnapshot.faqs);if(faq)return {text:faq.answer,cards:[{title:'From the Join ASME page',url:source.page}]};}
      var extracted=root.GearlySite.extract(text,html,source.section);
      if(extracted.matched)return {text:extracted.text,cards:[{title:'From the '+(page?page.title:'chapter')+' page',url:source.page}]};
    }catch(_){}
    if(intent.id==='sponsorship' && siteSnapshot.sponsorship && siteSnapshot.sponsorship.tiers.length)return sponsorshipResponse(siteSnapshot.sponsorship,source.page);
    if(intent.id==='sponsors' && siteSnapshot.tiers.length)return {text:siteSnapshot.tiers.map(function(tier){return tier.name+': '+tier.companies.map(function(c){return c.name;}).join(', ');}).join('\n'),cards:[{title:'Sponsors',url:source.page}]};
    return null;
  }
  function bestFAQ(question, faqs) {
    var terms=contentTokens(question);
    if(!terms.length)return null;
    return array(faqs).map(function(faq){var words=contentTokens(faq.question);return {faq:faq,hits:terms.filter(function(term){return words.includes(term);}).length};}).filter(function(entry){return entry.hits>=Math.min(2,terms.length) && entry.hits/terms.length>=.6;}).sort(function(a,b){return b.hits-a.hits;})[0]?.faq || null;
  }
  async function faqAnswer(question) {
    if(!root.GearlySite)return null;
    try {var html=await root.GearlySite.loadPage(new URL('join/',data.meta.siteBase).href,{origin:root.location.origin});siteSnapshot.faqs=root.GearlySite.parseFAQs(html);}catch(_){}
    var faq=bestFAQ(question,siteSnapshot.faqs);
    return faq?{text:faq.answer,cards:[{title:'From the Join ASME page',url:new URL('join/',data.meta.siteBase).href}]}:null;
  }
  function topicShortcuts() {
    return array(data.featuredTopics).filter(function(topic){return topic.tour || data.pages.some(function(page){return page.id===topic.pageId;});});
  }
  function eventQuestion(text) {
    var n=normalize(text);
    if(/\b(?:dont|do not|never|cancel|delete|quit|leave|password|secret|private|chemistry|mortgage|bank|nba|another planet|reactor meltdown)\b/.test(n))return false;
    return /\b(?:events?|meetings?|gbm|info sessions?|bar social|matlab|competitions?)\b/.test(n) &&
      /\b(?:next|upcoming|when|where|tonight|today|tomorrow|october|oct|november|nov|december|dec|january|jan|rsvp|register|registration|sign up|food|bring|laptop|before|under|21|will|can i|happen|this week|next week)\b/.test(n);
  }
  function eventFollowup(text) {
    return /\b(?:it|that|there|they|them|its)\b/.test(normalize(text)) && /\b(?:rsvp|food|pizza|register|registration|bring|laptop|experience|knowledge|age|attend|where|when|location)\b/.test(normalize(text));
  }
  function pointHelp(text) {
    var n=normalize(text),url=new URL('member-points-page/',data.meta.siteBase).href;
    if(!/\bpoints?\b/.test(n) || /\b(?:exam|grades?|chemistry|mortgage|bank|nba|credit score)\b/.test(n))return null;
    if(/\b(?:missing|not showing|didnt get|did not get|incorrect|wrong)\b/.test(n))return {id:'student-missing-points',text:'Check your name and attendance on the Member Points page. If points are missing, ask the ASME team to check the event and attendance record; I cannot change points.',cards:[{title:'Find your points',url:url},teamCard(text)].filter(Boolean)};
    if(/\b(?:earn|earning|point values|how.*get points)\b/.test(n))return {id:'student-point-help',text:'The published point values are listed below. To see your total and attendance, open Member Points and search your name.',cards:[{title:'Find your points',url:url}],liveSource:'points',explainLive:true};
    return null;
  }
  async function ask(text){if(!data)return;open();text=String(text || '').trim().slice(0,500);if(!text)return;var requestGeneration=++conversationGeneration,started=Date.now();if(finishTyping)finishTyping();list.querySelectorAll('.gearly-shortcuts').forEach(function(node){node.remove();});list.querySelectorAll('.gearly-welcome').forEach(function(node){node.classList.remove('gearly-welcome');});input.value='';var followup=!state.pendingQuestion && followupRequest(text),selectedResult=followup?(lastCards[followup.index] || array(state.lastResult)[followup.index]):null;
    memberCandidates=[];privateTurn=Boolean(extractMemberName(text,state) || personalPoints(text) || state.pendingSlot==='memberName');message(text,'user');setAvatar('thinking');startActivity();var result=match(data,text,state), response;if(followup && !selectedResult && followup.kind==='select'){await respond(array(state.lastResult).length?'That answer has only '+state.lastResult.length+' result(s). Ask for the list again or select one of those results.':'Ask for events, photos, or resources first so I have a list to select from.',null,requestGeneration,started);return;}var previousIntent=state.lastIntent;var memberName=extractMemberName(text,state),wasPending=state.pendingSlot==='memberName';delete state.pendingSlot;
    var forceHandoff=array(data.handoffTopics).some(function(topic){return contains(normalize(text),topic);});
    if(root.GearlyStudent)await siteSnapshotReady;
    if(requestGeneration!==conversationGeneration)return;
    var student=!forceHandoff && !privateTurn && root.GearlyStudent?root.GearlyStudent.resolve(text,{snapshot:siteSnapshot,siteBase:data.meta.siteBase,contactEmail:data.meta.contactEmail}):null;
    student=student || (!forceHandoff && !privateTurn?pointHelp(text):null);
    var eventTurn=!forceHandoff && !privateTurn && ((!student && (eventQuestion(text) || eventFollowup(text))) || student && student.id==='student-guarantee' && eventQuestion(text));
    var eventSuffix=eventTurn && student?student.text:'',eventExtraCards=eventTurn && student?student.cards:[];
    if(eventTurn){
      var eventIntent=data.intents.find(function(intent){return intent.id==='events';});
      if(eventIntent){var eventEntities=extractEntities(text,data);if(eventFollowup(text) && state.lastLiveSource==='events' && state.eventContextId)eventEntities.selectedEventId=state.eventContextId;
        result={kind:'answer',intent:Object.assign({},eventIntent,{actions:[],requires:[],static:true}),entities:eventEntities,candidates:[]};
        if(eventFollowup(text) && state.lastLiveSource!=='events')result={kind:'answer',intent:{id:'event-clarification',static:true,response:{text:'Which event do you mean? Give its title so I can check the listing.',cards:[{title:'Events Calendar',url:new URL('calendar/',data.meta.siteBase).href}]},actions:[]},entities:{},candidates:[]};}
    }else if(student){result={kind:'answer',intent:{id:student.id,response:{text:student.text,cards:student.cards},liveSource:student.liveSource,actions:[],requires:[],static:true},entities:student.entities || {},candidates:[]};}
    if(!forceHandoff && !student && !eventTurn && followup && selectedResult && ['events','gallery','instagram'].includes(state.lastLiveSource))result={kind:'answer',intent:{id:state.lastIntent,response:{text:'Current public details.'},liveSource:state.lastLiveSource,actions:[],static:true},entities:{},candidates:[]};
    var leadership=!forceHandoff && !student && !eventTurn && root.GearlyContent?await leadershipAnswer(text,result):null;
    if(forceHandoff)result.kind='fallback';
    if(requestGeneration!==conversationGeneration)return;
    if(leadership && !leadership.matched && /\bwho is\b/i.test(text) && !result.entities.role)result.kind='fallback';
    if(leadership && leadership.matched){result=Object.assign({},result,{kind:'answer',intent:Object.assign({},result.kind==='answer'?result.intent:data.intents.find(function(i){return i.id==='officer';}),{response:{text:leadership.text,cards:leadership.cards}})});}
    if(normalize(text)==='none of these'){result.kind='fallback';text=clarifyQuestion || text;}
    if(result.kind==='clarify' && result.score<data.fallback.highThreshold && root.GearlySearch && root.GearlySearch.findSections){var possible=await root.GearlySearch.findSections(text);if(possible[0] && possible[0].coverage>=.8 && possible[0].score>=6)result.kind='fallback';}
    if(!forceHandoff && result.kind!=='answer' && !(result.intent && result.intent.static) && root.GearlySite){var faq=await faqAnswer(text);if(faq)result={kind:'answer',intent:{id:'faq',response:faq,actions:[]},entities:{},candidates:[]};}
    if(result.kind==='answer'){var i=result.intent;response=Object.assign({},i.response);
      if(i.id==='contact')response={text:'Email the ASME team at '+data.meta.contactEmail+'.',cards:[{title:'Email ASME',url:'mailto:'+data.meta.contactEmail}]};
      if(i.id==='social-media')response={text:'Follow @'+data.meta.instagramHandle+' on Instagram for chapter updates.',cards:[{title:'Chapter Instagram',url:'https://www.instagram.com/'+data.meta.instagramHandle+'/'}]};
      var sourced=root.GearlySite && !leadership?await sourceAnswer(i,text):null;
      if(requestGeneration!==conversationGeneration)return;if(sourced)response=Object.assign({},response,sourced);if(previousIntent===i.id && state.history.length>2 && state.history[state.history.length-3].text===text)response.text+=' The page links below can help you explore further.';state.unresolvedCount=0;state.pendingQuestion=null;if(state.lastIntent!==i.id || i.liveSource==='events' && !eventFollowup(text) && !/^(?:what about|and )/.test(normalize(text)))state.slots={};if(i.liveSource==='events' && !eventFollowup(text))delete state.slots.selectedEventId;Object.assign(state.slots,result.entities);state.lastIntent=i.id;state.topic=i.id;if(result.entities.role)state.lastEntity=result.entities.role;
      var section=privateTurn?null:requestedSection(text,i.actions,result.entities);if(section && root.GearlyTour && root.GearlyTour.showSection && !array(i.requires).some(function(slot){return !state.slots[slot];})){stopActivity();setAvatar('happy');persist();close();if(root.GearlyTour.showSection(section))return;open();startActivity();}
      if((i.liveSource || privateTurn) && root.GearlyLive && (!privateTurn || memberName)){try{var live=await root.GearlyLive.load(privateTurn?'member':i.liveSource,Object.assign({},state.slots,{query:selectedResult?selectedResult.title:text,name:memberName,selectedEventId:i.liveSource==='events' && selectedResult && selectedResult.id?selectedResult.id:state.slots.selectedEventId}));if(requestGeneration!==conversationGeneration)return;if(live){var priorText=response.text,priorCards=response.cards;response.text=live.text || response.text;response.cards=live.cards || response.cards;
        if(student && (student.explainLive || i.liveSource==='gallery')){response.text=priorText+' '+response.text;response.cards=['gallery','events'].includes(i.liveSource)?array(response.cards).concat(array(priorCards)):array(priorCards).concat(array(response.cards));}
        if(i.liveSource==='events'){state.eventContextId=live.primaryEventId || null;if(eventSuffix){response.text+=' '+eventSuffix;response.cards=array(response.cards).concat(array(eventExtraCards));}}
        if(selectedResult){
        var matchingCards=array(response.cards).filter(function(card){return selectedResult.id?card.id===selectedResult.id:card.title===selectedResult.title;});
        if(matchingCards.length===1){var selectedCard=matchingCards[0];response.cards=[selectedCard];response.text=selectedCard.detailAvailable===false?'Here is '+selectedCard.title+'. The public feed does not provide an additional description; open the source for more context.':'Here are the current details for '+selectedCard.title+'.';}
        else {response.cards=[];response.text='That exact result is no longer uniquely available. Ask for the list again to refresh it.';}
      }memberCandidates=live.candidates || [];if(live.noMatch && teamCard(text))response.cards=response.cards.concat([teamCard(text)]);var mediaSource=i.liveSource==='instagram' || i.liveSource==='gallery';if(live.updatedAt && Number.isFinite(new Date(live.updatedAt).getTime()))response.text+=' Updated '+(mediaSource?new Date(live.updatedAt).toLocaleDateString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric'}):new Date(live.updatedAt).toLocaleString())+'.';if(live.sourceLabel && !mediaSource)response.text+=' Source: '+live.sourceLabel+'.';}}catch(_){response.text+=' Live information is unavailable right now; check the linked page for the latest.';}}
      if(privateTurn && !memberName){if(!wasPending)state.pendingSlot='memberName';response={text:wasPending?'Please give the name listed on the public leaderboard.':"What name is on the leaderboard? I'll look it up.",chips:[]};}
      var missing=array(i.requires).find(function(s){return !state.slots[s];});if(missing && missing!=='memberName'){response={text:'Which '+missing.replace(/([A-Z])/g,' $1').toLowerCase()+' do you mean?',chips:missing==='eventType'?['Company events','Social events','Workshops']:['This week','Next week','Next month']};}if(!privateTurn && !['member','leaderboard'].includes(i.liveSource)){if(!followup){lastCards=array(response.cards).slice(0,5);state.lastResult=lastCards.map(function(card){var saved=historyCards([card])[0];if(saved && i.liveSource==='events' && typeof card.id==='string')saved.id=card.id.slice(0,500);return saved;}).filter(Boolean);}}else {lastCards=[];state.lastResult=[];}
      if(!await respond(response.text,response.cards,requestGeneration,started))return;setChips(response.chips);
      if(memberCandidates.length){memberCandidates.forEach(function(candidate){chips.append(button(candidate.label,function(){chooseMember(candidate);}));});}
      actionButtons(i.actions || response.actions);var latest=Array.from(list.querySelectorAll('.gearly-message')).pop();if(latest && latest.querySelector('.gearly-place-card'))list.scrollTop+=latest.getBoundingClientRect().top-list.getBoundingClientRect().top-8;
    }else if(result.kind==='clarify'){clarifyQuestion=text;state.pendingQuestion=result.candidates.map(function(c){return c.intent.examples[0];});if(!await respond('Which of these did you mean?',null,requestGeneration,started))return;setChips(result.candidates.map(function(c){return {label:c.intent.label || c.intent.id.replace(/[-_]/g,' '),query:c.intent.examples[0]};}).concat(['None of these']));}
    else {
      state.unresolvedCount++;
      var found=forceHandoff?[]:await search(text), sections=!forceHandoff && root.GearlySearch && root.GearlySearch.findSections?await root.GearlySearch.findSections(text):[];
      var best=sections[0], handoff=teamCard(text);
      response=found.length || best?'These pages or sections may help. You can also ask the ASME team.':'I could not confidently match that. You can ask the ASME team.';
      if(handoff)found=found.concat([handoff]);
      if(requestGeneration!==conversationGeneration)return;
      if(!await respond(response,found,requestGeneration,started))return;
      setChips(['Events','Join','Contact']);
      if(best && best.coverage>=.8 && best.score>=6)actionButtons([{type:'scrollTo',page:best.page,selector:best.selector,title:best.title,label:'Show '+best.title,text:best.snippet}]);
    }state.lastLiveSource=result.kind==='answer' && result.intent?result.intent.liveSource || null:null;setAvatar(result.kind==='answer'?'happy':'confused');persist();
    if(!privateTurn && new URLSearchParams(root.location.search).get('gearly_debug')==='1'){message(JSON.stringify({scores:result.candidates.map(function(c){return [c.intent.id,c.score];}),entities:result.entities}),'debug');}
  }
  async function chooseMember(candidate) {
    var generation = ++conversationGeneration;
    privateTurn = true;
    var live = await root.GearlyLive.load('member', {name:candidate.name,selection:candidate.selection});
    if(generation !== conversationGeneration)return;
    if(!await respond(live.text,live.cards,generation,Date.now()) || generation!==conversationGeneration)return;
    memberCandidates = [];
    setChips([]);
    persist();
  }
  async function build(){
    if(root.GearlySearch){root.GearlySearch.configure({assetBase:base});if(root.GearlySearch.sections){var registry=await root.GearlySearch.sections();if(root.GearlySearch.records)data.searchIndex=await root.GearlySearch.records();data.pages.forEach(function(page){page.sections=array(page.sections).concat(registry.filter(function(s){return s.page===page.url;}));});}}
    if(root.GearlyTour)root.GearlyTour.configure({data:data,assetBase:base});if(root.GearlySearch)root.GearlySearch.configure({assetBase:base});configureLive();var host=el('div','gearly-root');launcher=el('button','gearly-launcher');launcher.type='button';launcher.setAttribute('aria-label','Open Gearly, ASME website guide');launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','gearly-panel');launcher.addEventListener('click',open);var greeting=el('span','gearly-launcher-greeting','Hi! Need help?');greeting.setAttribute('aria-hidden','true');launcher.append(greeting);panel=el('section','gearly-panel');panel.id='gearly-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Gearly website guide');var header=el('div','gearly-header');avatar=el('span','gearly-avatar','⚙');avatar.dataset.state='idle';avatar.setAttribute('aria-hidden','true');var replay=button('⌖',startTour);replay.className='gearly-tour-replay';replay.setAttribute('aria-label','Website tour');replay.title='Website tour';if(!root.GearlyTour)replay.hidden=true;var identity=el('div','gearly-identity');identity.append(el('strong','','Gearly ✦'),el('span','gearly-subtitle','Your ASME website guide'));var clear=button('↺',resetChat);clear.className='gearly-icon-button';clear.setAttribute('aria-label','Clear chat');clear.title='Clear chat';var dismiss=button('×',close);dismiss.className='gearly-icon-button';dismiss.setAttribute('aria-label','Close');dismiss.title='Close';header.append(avatar,identity,replay,clear,dismiss);var context=el('div','gearly-context'),page=currentPage();context.append(el('span','','Helping with: '),el('strong','',page?page.title:'ASME'));var topics=button('Browse topics ↗',browseTopics);topics.className='gearly-text-button';context.append(topics);list=el('div','gearly-messages');list.setAttribute('role','log');list.setAttribute('aria-live','polite');list.setAttribute('aria-relevant','additions');chips=el('div','gearly-chips');var form=el('form','gearly-form');input=el('input','gearly-input');input.type='text';input.maxLength=500;input.setAttribute('aria-label','Ask Gearly about ASME');input.placeholder='Ask Gearly anything about ASME…';var send=el('button','gearly-send','➤');send.type='submit';send.setAttribute('aria-label','Send message');form.append(input,send);form.addEventListener('submit',function(e){e.preventDefault();ask(input.value);});var prompt=el('div','gearly-prompt');prompt.append(el('span','', 'Try: “How do I join ASME?”'));var more=button('See topics ↗',browseTopics);more.className='gearly-text-button';prompt.append(more);list.append(chips);panel.append(header,context,list,form,el('div','gearly-notice','Site guide · Live public data when available'));panel.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){var nodes=Array.from(panel.querySelectorAll('button,input,a[href]')).filter(function(n){return !n.disabled && !n.closest('[hidden]') && !(n.closest('.gearly-chips') && list.querySelector('.gearly-welcome'));}),first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey && root.document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && root.document.activeElement===last){e.preventDefault();first.focus();}}});['gearly-smiling-wave.webp','gearly-sitting-wave.webp','gearly-celebrating-jump.webp','gearly-laptop-presenting.webp','gearly-double-pointing.webp','gearly-winking-head.webp','gearly-thinking-chin.webp','gearly-peeking-banner.webp','gearly-peeking-thumbs-up.webp','gearly-peeking-side.webp','gearly-winking-peek.webp'].forEach(function(file){var preload=new root.Image();preload.src=new URL('sprites/'+file,base).href;});host.append(launcher,panel);root.document.body.append(host);var prior=state.history.slice(),hasConversation=prior.some(function(m){return m && m.who==='user';});state.history=[];if(hasConversation)prior.forEach(function(m){if(m && typeof m.text==='string')message(m.text,m.who==='user'?'user':'bot',m.who==='user'?[]:historyCards(m.cards));});if(!hasConversation)welcome();setChips(starterChips());setAvatar('idle');setupLauncherMotion();root.Gearly={open:open,close:close,ask:ask,version:VERSION};siteSnapshotReady=loadSiteSnapshot();refreshSite();if(root.GearlyTour && data.tour && data.tour.enabled!==false)root.setTimeout(function(){if(panel.hidden)root.GearlyTour.offer();},4000);
    root.fetch(base+'sprites.json').then(function(r){return r.ok?r.json():null;}).then(function(manifest){if(data.meta.sprites && data.meta.sprites.idle)return;var sprites=manifest && (manifest.sprites || manifest.assets);if(!Array.isArray(sprites))return;var sprite=sprites.find(function(s){return /idle|welcome|happy/i.test(s.state || s.id || s.name || s.label || '');}) || sprites[0];var path=sprite && (sprite.webFile || sprite.path || sprite.file || sprite.url);if(path){var url=safeURL(new URL(path,base).href);if(url){avatar.textContent='';var img=el('img','gearly-avatar-image');img.src=url;img.alt='';avatar.append(img);}}}).catch(function(){});
  }
  root.fetch(base+'gearly-data.json?v='+encodeURIComponent(assetVersion),{signal:AbortSignal.timeout(8000)}).then(function(r){if(!r.ok)throw Error('Data unavailable');return r.json();}).then(function(raw){var checked=validateData(raw);if(!checked.data || !checked.data.intents.length)throw Error('Invalid Gearly data');data=checked.data;if(data.meta.enabled===false)return;if(new URLSearchParams(root.location.search).get('gearly_debug')==='1' && checked.errors.length)root.console.warn('Gearly validation:',checked.errors);build();}).catch(function(e){root.console.warn('Gearly unavailable:',e.message);});
})(typeof window !== 'undefined' ? window : globalThis);
