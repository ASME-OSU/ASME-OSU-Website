import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {registeredTargets, checkRegisteredTargets} from '../scripts/check-gearly-contract.mjs';
import {approvedURL, fetchPublicText, parsePublicTable, auditLive} from '../scripts/check-gearly-live.mjs';

const fixture = () => ({
  meta:{siteBase:'https://org.osu.edu/asme/',assetBase:'https://asme-osu.github.io/ASME-OSU-Website/',sheetID:'fixture-public-sheet'},
  pages:[{id:'home',url:'https://org.osu.edu/asme/',sourceFile:'Home Page.html',sections:[{id:'welcome',selector:'#welcome'}]}],
  tour:{steps:[{page:'home',selector:'#welcome'}]},
  intents:[{id:'joining',response:{cards:[{url:'https://org.osu.edu/asme/#welcome'}]},source:{page:'https://org.osu.edu/asme/',section:'#welcome'},actions:[{page:'https://org.osu.edu/asme/',selector:'#welcome'}]}]
});
const index = {records:[{url:'https://org.osu.edu/asme/',sections:[{id:'extra',selector:'#extra'}]}]};
const html = '<main id="welcome"><h1>Chapter</h1><section id="extra"></section></main>';
const gviz = rows => '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({status:'ok',table:{rows}}) + ');';
const response = body => new Response(body, {status:200});
function sources(overrides = {}) {
  return async url => {
    const parsed = new URL(url), route = parsed.hostname === 'docs.google.com' ? parsed.searchParams.get('sheet') : parsed.pathname;
    if (route in overrides) return overrides[route](url);
    if (route === '/asme/') return response(html);
    if (route === 'System_Status') return response(gviz([{c:[{v:'system_status'},{v:'LIVE'}]}]));
    if (parsed.hostname === 'docs.google.com') return response(gviz([]));
    const value = route.endsWith('calendar-events.json') ? {events:[]} : {items:[]};
    return response(JSON.stringify({...value,checkedAt:'2026-11-13T12:00:00Z'}));
  };
}

test('all registered and indexed selectors, source selectors, internal fragments and action links are enforced', async () => {
  const data = fixture(), read = async () => html;
  assert.deepEqual(await checkRegisteredTargets(data,index,read),[]);
  assert.equal(registeredTargets(data,index).length,5);
  const missing = await checkRegisteredTargets(data,index,async () => '<main id="welcome"></main>');
  assert.match(missing.join('\n'), /Indexed section extra: selector #extra/);
  data.intents[0].actions[0].selector = '#gone';
  data.intents[0].response.cards[0].url = 'https://org.osu.edu/asme/#gone';
  data.intents[0].source.page = 'https://org.osu.edu/asme/deleted/';
  const errors = (await checkRegisteredTargets(data,index,read)).join('\n');
  assert.match(errors,/Action joining: selector #gone/);
  assert.match(errors,/fragment #gone/);
  assert.match(errors,/Source joining: page is not registered/);
  data.intents[0].actions.push({url:'https://org.osu.edu/asme/deleted/'});
  assert.match((await checkRegisteredTargets(data,index,read)).join('\n'),/chapter destination is not registered/);
});

test('live requests allow approved HTTPS paths and reject credentials, lookalike paths, arbitrary config and redirect escapes', async () => {
  const data = fixture();
  for (const url of ['https://org.osu.edu/asme/','https://asme-osu.github.io/ASME-OSU-Website/data/calendar-events.json','https://docs.google.com/spreadsheets/d/fixture-public-sheet/gviz/tq']) assert.equal(approvedURL(url,data),true,url);
  for (const url of ['http://org.osu.edu/asme/','https://user:pass@org.osu.edu/asme/','https://org.osu.edu/asme-lookalike/','https://org.osu.edu/asme/../private','https://example.com/asme/','https://docs.google.com/spreadsheets/d/some-other-sheet/gviz/tq']) assert.equal(approvedURL(url,data),false,url);
  assert.equal(approvedURL('https://evil.example/asme/',{...data,meta:{...data.meta,siteBase:'https://evil.example/asme/'}}),false);
  let calls=0;
  await assert.rejects(fetchPublicText('https://org.osu.edu/asme/',data,async () => {calls++;return new Response(null,{status:302,headers:{location:'https://evil.example/'}});}),/Unapproved/);
  assert.equal(calls,1);
  calls=0;
  await assert.rejects(fetchPublicText('https://org.osu.edu/asme/',data,async () => {calls++;return new Response(null,{status:302,headers:{location:'/asme/'}});}),/excessive redirects/);
  assert.equal(calls,4);
  await assert.rejects(fetchPublicText('https://org.osu.edu/asme/',data,async () => response('x'.repeat(2_000_001))),/Oversized/);
});

test('public table health parsing uses JSON without executing wrappers or trailing scripts', () => {
  assert.deepEqual(parsePublicTable(gviz([])),[]);
  for (const text of ['bad','google.visualization.Query.setResponse({});globalThis.compromised=true;',gviz([]).replace('"ok"','"error"')]) assert.throws(() => parsePublicTable(text));
  assert.equal(globalThis.compromised,undefined);
});

test('published health audit catches missing anchors, unavailable pages, broken feed schemas and stale sources', async () => {
  const data = fixture(), now = Date.parse('2026-11-13T13:00:00Z');
  let report=await auditLive(data,index,{fetcher:sources(),now});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.warnings,[]);assert.equal(report.checks.length,7);
  assert.equal(report.checks[0].targets,2);
  report=await auditLive(data,index,{fetcher:sources({
    '/asme/':async()=>response('<main id="welcome"></main>'),
    '/ASME-OSU-Website/data/calendar-events.json':async()=>response(JSON.stringify({events:[],checkedAt:'2001-01-01'})),
    '/ASME-OSU-Website/data/instagram-feed.json':async()=>response('{}'),
    'Point_Values_Public':async()=>new Response('down',{status:503})
  }),now});
  assert.match(report.errors.join('\n'),/published target missing.*#extra/);
  assert.match(report.errors.join('\n'),/instagram: Missing items array/);
  assert.match(report.errors.join('\n'),/Point_Values_Public: HTTP 503/);
  assert.match(report.warnings.join('\n'),/calendar: published snapshot is older/);
  report=await auditLive(data,index,{fetcher:sources({'/asme/':async()=>new Response('down',{status:404})}),now});
  assert.match(report.errors.join('\n'),/Page home: HTTP 404/);
});

test('health audit queries export availability without downloading member identities or totals', async () => {
  const seen=[], fetcher=sources();
  await auditLive(fixture(),index,{now:Date.parse('2026-11-13T13:00:00Z'),fetcher:async(url,options)=>{seen.push(url);return fetcher(url,options);}});
  const tables=seen.filter(url=>new URL(url).hostname==='docs.google.com').map(url=>new URL(url));
  assert.equal(tables.length,3);
  for (const url of tables.filter(url=>url.searchParams.get('sheet')!=='System_Status')) assert.equal(url.searchParams.get('tq'),'select A limit 1');
});

test('current generated index targets and all source/action contracts match current checked-in pages', async () => {
  const data=JSON.parse(await fs.readFile('assets/gearly/gearly-data.json','utf8'));
  const currentIndex=JSON.parse(await fs.readFile('assets/gearly/gearly-index.json','utf8'));
  assert.deepEqual(await checkRegisteredTargets(data,currentIndex,file=>fs.readFile(file,'utf8')),[]);
});


test('shared targets provisioned in published templates are reported separately, without executing site scripts', async () => {
  const data=fixture();data.tour.steps.push({page:'home',selector:'#asme-site-header'});
  const report=await auditLive(data,index,{now:Date.parse('2026-11-13T13:00:00Z'),fetcher:sources({'/asme/':async()=>response(html+'<template><header id="asme-site-header"></header></template><script>globalThis.healthInjected=true</script>')})});
  assert.deepEqual(report.errors,[]);assert.equal(report.checks[0].templateTargets,1);assert.equal(globalThis.healthInjected,undefined);
});
