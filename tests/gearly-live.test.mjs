import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../assets/gearly/gearly-live.js', import.meta.url), 'utf8');
function setup(responses) {
  const requests = [];
  const context = { URL, AbortController, Date, setTimeout, clearTimeout, fetch: async (url, options) => {
    requests.push({ url, options });
    const body = responses.shift(); if (body instanceof Error) throw body;
    return { ok: true, text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
  }};
  vm.runInNewContext(code, context); return { api: context.GearlyLive, requests };
}
const gviz = rows => '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ status: 'ok', table: { rows: rows.map(values => ({ c: values.map(v => ({v})) })) } }) + ');';
test('events are upcoming, chronological, Eastern Time, and links are safe', async () => {
  const { api, requests } = setup([{ checkedAt: new Date().toISOString(), events: [
    { title: 'Later', start: '2099-01-02T18:00:00Z', url: 'javascript:alert(1)' },
    { title: 'Earlier', start: '2099-01-01T18:00:00Z', location: 'Campus' },
    { title: 'Past', start: '2001-01-01T00:00:00Z' }, {title: 'Bad', start: 'invalid'}
  ] }]);
  const value = await api.load('events'); assert.equal(value.cards.length, 2);
  assert.equal(value.cards[0].title, 'Earlier'); assert.match(value.cards[0].text, /1:00 PM EST/);
  assert.equal(value.cards[1].url, 'https://org.osu.edu/asme/calendar/');
  await api.load('events'); assert.equal(requests.length, 1); assert.equal(requests[0].options.cache, 'no-store'); assert.equal(requests[0].options.credentials, 'omit');
});
test('leaderboard is gated and only exposes validated public columns', async () => {
  let instance = setup([gviz([['system_status', 'TESTING']])]);
  assert.equal((await instance.api.load('leaderboard')).cards.length, 0); assert.equal(instance.requests.length, 1);
  instance = setup([gviz([['system_status','LIVE']]), gviz([[2,'Public Name','Autumn',5,'private'],[1,'Leader','Autumn',10],[0,'Bad','Autumn',20]])]);
  const value = await instance.api.load('leaderboard'); assert.equal(value.cards.length, 2); assert.equal(value.cards[0].title, '#1 Leader');
  assert.ok(!JSON.stringify(value).includes('private')); assert.ok(instance.requests[1].url.includes('select%20A%2CB%2CC%2CD'));
});
test('malformed and unsupported sources return useful empty states', async () => {
  for (const body of ['not json', {items: null}, new Error('network')]) {
    const {api} = setup([body]); assert.equal((await api.load('instagram')).cards.length, 0);
  }
  const {api,requests} = setup([]); assert.equal((await api.load('secret')).cards.length, 0); assert.equal(requests.length, 0);
});
test('old snapshots are marked stale and unsafe social links fall back', async () => {
  const {api} = setup([{updatedAt:'2001-01-01',items:[{title:'Old post',permalink:'https://evil.example/',summary:'Hello'}]}]);
  const value = await api.load('instagram'); assert.equal(value.stale, true); assert.equal(value.cards[0].url,'https://www.instagram.com/asmeohiostate/');
});
test('GViz is parsed as JSON and never executed', async () => {
  const {api} = setup(['google.visualization.Query.setResponse({});globalThis.compromised=true;']);
  assert.equal((await api.load('leaderboard')).cards.length,0);
});
test('configuration uses a local feed base', async () => {
  const {api,requests} = setup([{generatedAt:new Date().toISOString(),items:[]}]);
  api.configure({baseURL:'http://localhost:8080/'}); await api.load('gallery');
  assert.equal(requests[0].url,'http://localhost:8080/data/google-photos-feed.json');
});
test('event date ranges use Eastern calendar days and cache filters independently', async () => {
  const source = {checkedAt:new Date().toISOString(),events:[
    {title:'Late evening workshop',start:'2099-01-02T02:00:00Z'},
    {title:'Company info session',start:'2099-01-02T18:00:00Z'},
    {title:'First-session classes',start:'2099-01-02T20:00:00Z'}
  ]};
  const {api,requests} = setup([source,source,source,source]);
  const first = await api.load('events',{dateRange:{from:'2099-01-01',to:'2099-01-01'}});
  assert.equal(first.cards.length,1); assert.equal(first.cards[0].title,'Late evening workshop');
  const second = await api.load('events',{dateRange:{from:'2099-01-02',to:'2099-01-02'}});
  assert.equal(second.cards.length,2); assert.equal(requests.length,2);
  await api.load('events',{dateRange:{from:'2099-01-01',to:'2099-01-01'}}); assert.equal(requests.length,2);
  const company = await api.load('events',{eventType:'company'}); assert.equal(company.cards.length,1);
  const missing = await api.load('events',{company:'nonexistent'}); assert.equal(missing.cards.length,0); assert.match(missing.text,/No upcoming events match/);
});
test('verified company aliases classify named events, exclude unrelated and canceled events',async()=>{
 const source={checkedAt:new Date().toISOString(),events:[
  {title:'ASME Pratt & Whitney Event',start:'2099-01-01T18:00:00Z'},
  {title:'RTX career talk',start:'2099-01-02T18:00:00Z'},
  {title:'Pickleball social',start:'2099-01-03T18:00:00Z'},
  {title:'Pratt and Whitney',start:'2099-01-04T18:00:00Z',status:'cancelled'},
  {title:'RTX workshop',start:'2099-01-05T18:00:00Z',cancelled:true}
 ]};
 const {api}=setup([source,source]);api.configure({companies:[{id:'pratt-whitney',name:'Pratt & Whitney',aliases:['Pratt and Whitney','RTX']}]});
 const company=await api.load('events',{eventType:'company'});assert.equal(company.cards.length,2);
 const alias=await api.load('events',{company:'pratt-whitney'});assert.equal(alias.cards.length,2);assert.equal(alias.cards[0].title,'ASME Pratt & Whitney Event');
});
test('gallery unsafe source falls back to verified pictures route',async()=>{
 const {api}=setup([{generatedAt:new Date().toISOString(),albumUrl:'javascript:bad',items:[{alt:'Chapter photo'}]}]);
 assert.equal((await api.load('gallery')).cards[0].url,'https://org.osu.edu/asme/pictures/');
});
