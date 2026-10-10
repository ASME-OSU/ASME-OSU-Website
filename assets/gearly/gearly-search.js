/* Lazy local retrieval from approved public page text. No crawler or generated answers. */
(function(root){
  'use strict';
  var url, pending;
  var stop=new Set('a an the is are was what where when how can could would i we you me my our your please find show tell do does have information about on in to for of with'.split(' '));
  function tokens(value){return String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(/\s+/).filter(function(t){return t.length>1 && !stop.has(t);});}
  function rank(records,query){
    var terms=Array.from(new Set(tokens(query)));if(!terms.length)return [];
    return records.filter(function(r){if(!r || typeof r.title!=='string' || typeof r.url!=='string')return false;try{var u=new URL(r.url);return u.origin==='https://org.osu.edu' && u.pathname.startsWith('/asme/');}catch(_){return false;}}).map(function(r){
      var title=new Set(tokens(r.title+' '+(Array.isArray(r.keywords)?r.keywords.join(' '):''))),headings=new Set(tokens((Array.isArray(r.headings)?r.headings:[]).join(' '))),body=new Set(tokens(r.text));
      var hits=0,score=0;terms.forEach(function(t){function has(set){return set.has(t) || (t.length>=4 && Array.from(set).some(function(s){return s.startsWith(t);}));}if(has(title)){score+=6;hits++;}else if(has(headings)){score+=3;hits++;}else if(has(body)){score++;hits++;}});
      return {record:r,score:score,coverage:hits/terms.length};
    }).filter(function(v){return v.coverage>=.6 && v.score>0;}).sort(function(a,b){return b.coverage-a.coverage || b.score-a.score || a.record.id.localeCompare(b.record.id);}).slice(0,3).map(function(v){return {title:v.record.title,text:v.record.description,url:v.record.url};});
  }
  root.GearlySearch={configure:function(options){url=new URL('gearly-index.json',options.assetBase).href;pending=null;},find:async function(query){if(!url)return [];try{if(!pending)pending=root.fetch(url,{signal:AbortSignal.timeout(5000)}).then(function(r){if(!r.ok)throw Error('Index unavailable');return r.json();}).then(function(d){if(!d || !Array.isArray(d.records))throw Error('Invalid index');return d.records;}).catch(function(e){pending=null;throw e;});return rank(await pending,query);}catch(_){return [];}}};
  if(typeof module!=='undefined' && module.exports)module.exports={rank:rank};
})(typeof window!=='undefined'?window:globalThis);
