import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const fixtureConfig = {
  baseURL: 'https://asme-osu.github.io/ASME-OSU-Website/',
  sheetID: readFileSync(new URL('../Member Points Integration.js', import.meta.url), 'utf8').match(/var EXPORT_ID = '([^']+)'/)[1],
  siteBase: 'https://org.osu.edu/asme/',
  instagramHandle: 'asmeohiostate',
  eventTypes: {social: ['social', 'pickleball'], workshop: ['workshop'], company: ['company', 'info session'], volunteering: ['volunteering'], competition: ['competition'], meeting: ['meeting']}
};
const siteData = JSON.parse(readFileSync(new URL('../assets/gearly/gearly-data.json', import.meta.url), 'utf8'));
const code = readFileSync(new URL('../assets/gearly/gearly-live.js', import.meta.url), 'utf8');
function setup(responses) {
  const requests = [];
  const context = { URL, AbortController, Date, setTimeout, clearTimeout, fetch: async (url, options) => {
    requests.push({ url, options });
    const body = responses.shift(); if (body instanceof Error) throw body;
    return { ok: true, text: async () => typeof body === 'string' ? body : JSON.stringify(body) };
  }};
  vm.runInNewContext(code, context);
  context.GearlyLive.configure(Object.assign({}, fixtureConfig, siteData.meta, {eventRules: siteData.eventRules, eventTypes: siteData.eventTypes || fixtureConfig.eventTypes}));
  return { api: context.GearlyLive, requests };
}
const gviz = (rows, labels = []) => '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify({ status: 'ok', table: { cols: labels.map(label => ({label})), rows: rows.map(values => ({ c: values.map(v => ({v})) })) } }) + ');';
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

test('upcoming-event answers contain only the next three chronological matches',async()=>{
 const {api}=setup([{checkedAt:new Date().toISOString(),events:[6,4,2,5,1,3].map(day=>({title:'Event '+day,start:'2099-01-0'+day+'T18:00:00Z'}))}]);
 const value=await api.load('events');assert.deepEqual(Array.from(value.cards,c=>c.title),['Event 1','Event 2','Event 3']);
});

const galleryURL = 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/example.jpg';
const freshMedia = items => ({generatedAt:new Date().toISOString(),items});
const publicMember = (name, period='Autumn') => [1,name,period,20,3,'Active','2026-10-01',1,2,0,0,0,0,0,'Social events / tabling'];
test('image URLs reject alternate hosts, paths, protocols and credentials', () => {
  const {api} = setup([]);
  assert.equal(api.safeImageURL(galleryURL),galleryURL);
  for(const url of [galleryURL.replace('https:','http:'),galleryURL.replace('asme-osu.github.io','evil.example'),galleryURL.replace('/assets/gallery/','/assets/private/'),galleryURL.replace('https://','https://user:pass@'),galleryURL.replace('/assets/gallery/','/assets/gallery/../')]) assert.equal(api.safeImageURL(url),null);
  api.configure({baseURL:'http://localhost:8080/preview/'});
  assert.equal(api.safeImageURL('https://asme-osu.github.io/preview/assets/gallery/example.jpg'),'https://asme-osu.github.io/preview/assets/gallery/example.jpg');
  assert.equal(api.safeImageURL('http://localhost:8080/preview/assets/gallery/example.jpg'),null);
});
test('Instagram always returns only the newest post, even when an older post matches the query',async()=>{
  const source=freshMedia([
    {title:'Robotics workshop',timestamp:'2026-09-01',imageUrl:galleryURL,imageWidth:320,imageHeight:180,alt:'Robot'},
    ...[1,2,3,4].map(day=>({title:'Social '+day,timestamp:'2026-10-0'+day,imageUrl:galleryURL,imageWidth:-1,imageHeight:1.5}))
  ]);
  const {api,requests}=setup([source,source,source]);
  for(const query of ['show robot photos','nonexistent','show latest photos']) {
    const latest=await api.load('instagram',{query});
    assert.equal(latest.text,'Latest Instagram post.');
    assert.deepEqual(Array.from(latest.cards,c=>c.title),['Social 4']);
    assert.equal(latest.cards[0].image.width,undefined); assert.equal(latest.cards[0].image.height,undefined);
  }
  await api.load('instagram',{query:'nonexistent'}); assert.equal(requests.length,3);
});
test('gallery keeps topical matching and up to three photos',async()=>{
  const items=[{id:'robot',alt:'Robot workshop',takenAt:'2026-09-01',thumbnailUrl:galleryURL,width:320,height:180},
    ...[1,2,3,4].map(day=>({id:'social'+day,alt:'Social '+day,takenAt:'2026-10-0'+day}))];
  const {api}=setup([freshMedia(items),{}, {},freshMedia(items),{}, {}]);
  const match=await api.load('gallery',{query:'robot photos'});
  assert.equal(match.cards.length,1);assert.equal(match.cards[0].title,'Robot workshop');assert.equal(match.cards[0].image.width,320);
  const latest=await api.load('gallery',{query:'latest photos'});
  assert.deepEqual(Array.from(latest.cards,c=>c.title),['Social 4','Social 3','Social 2']);
});
test('meeting filters use the same next events as general event requests',async()=>{
  const source={checkedAt:new Date().toISOString(),events:[
    {title:'Weekly Chapter Meeting',start:'2099-02-01T18:00:00Z'},
    {title:'MATLAB Info Session',start:'2099-01-01T18:00:00Z'},
    {title:'Bridge Competition',start:'2099-01-02T18:00:00Z'}]};
  const {api}=setup([source]);
  const value=await api.load('events',{eventType:'meeting'});
  assert.equal(value.cards[0].title,'MATLAB Info Session');
  assert.deepEqual(Array.from((await api.load('events')).cards,c=>c.title),Array.from(value.cards,c=>c.title));
});
test('gallery labels use Eastern dates, closest events, ties, cancellations and manual overrides',async()=>{
  const items=[
    {id:'manual',takenAt:'2026-09-02T02:00:00Z',alt:'Feed manual',thumbnailUrl:galleryURL,imageUrl:'https://evil.example/x'},
    {id:'exact',takenAt:'2026-09-02T02:00:00Z',alt:'Feed exact'},
    {id:'near',takenAt:'2026-09-05T18:00:00Z',alt:'Feed near'},
    {id:'tie',takenAt:'2026-09-09T18:00:00Z',alt:'Feed tie'}
  ];
  const events=[
    {title:'Eastern exact',start:'2026-09-01T18:00:00Z'},
    {title:'Prior day',start:'2026-09-04'},
    {title:'Cancelled',start:'2026-09-05',cancelled:true},
    {title:'Cancelled status',start:'2026-09-05',status:'canceled'},
    {title:'Tie before',start:'2026-09-08'},
    {title:'Tie after',start:'2026-09-10'}
  ];
  const {api}=setup([freshMedia(items),{events},{manual:'Manual title'},freshMedia(items),{events},{manual:'Manual title'}]);
  const exact=await api.load('gallery',{query:'Eastern exact'}); assert.equal(exact.cards[0].title,'Eastern exact');
  const latest=await api.load('gallery'); assert.deepEqual(Array.from(latest.cards,c=>c.title),['Feed tie','Prior day','Manual title']);
  assert.equal(latest.cards[2].image.src,galleryURL);
});
test('failed or ambiguous calendar labeling falls back to feed labels',async()=>{
  for(const history of [new Error('Unavailable'),{events:[]},{events:[{title:'One',start:'2026-09-01'},{title:'Two',start:'2026-09-01'}]}]) {
    const {api}=setup([freshMedia([{alt:'Feed label',takenAt:'2026-09-01T18:00:00Z'}]),history,{}]);
    assert.equal((await api.load('gallery')).cards[0].title,'Feed label');
  }
  const {api}=setup([freshMedia([]),{},{}]); assert.equal((await api.load('gallery')).cards[0].title,'Open the source');
});
test('member column labels mirror the public integration exactly',()=>{
  const integration=readFileSync(new URL('../Member Points Integration.js',import.meta.url),'utf8');
  const types=Array.from(integration.match(/var EVENT_TYPES = \[([^]*?)\];/)[1].matchAll(/column: (\d+), label: '([^']+)'/g),m=>({column:Number(m[1]),label:m[2]}));
  assert.deepEqual(JSON.parse(JSON.stringify(setup([]).api.EVENT_TYPES)),types);
});
test('member lookup gates every request, caches public rows and keeps the full public breakdown',async()=>{
  const {api,requests}=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Álvaro Example')]),gviz([['system_status','LIVE']]),gviz([['system_status','TESTING']])]);
  const answer=await api.load('member',{name:'Example Alvaro'});
  assert.equal(answer.cards[0].title,'Álvaro Example · #1');
  assert.match(answer.cards[0].text,/20 points · 3 events · Autumn · Active/);assert.match(answer.cards[0].text,/General body meetings: 1/);assert.match(answer.cards[0].text,/Social events \/ tabling: 2/);
  assert.match(answer.text,/cannot verify/);
  assert.equal((await api.load('member',{name:'Alvarp Example'})).cards.length,1);
  assert.equal(requests.filter(r=>r.url.includes('Leaderboard_Public')).length,1);
  assert.match(decodeURIComponent(requests[1].url),/select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O where B is not null/);
  assert.ok(!requests.some(r=>r.url.includes('Alvaro')||r.url.includes('Example')));
  assert.equal((await api.load('member',{name:'Alvaro Example'})).cards.length,0);
});
test('member disambiguation selection resolves exact period row and zero/many matches stay empty',async()=>{
  const {api}=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Taylor Example','Autumn'),publicMember('Taylor Example','Spring')]),gviz([['system_status','LIVE']]),gviz([['system_status','LIVE']])]);
  const choices=await api.load('member',{name:'Taylor Ex'}); assert.equal(choices.candidates.length,2);assert.equal(choices.candidates[1].label,'Taylor Example · Spring');
  const selected=await api.load('member',{selection:choices.candidates[1].selection}); assert.equal(selected.cards.length,1); assert.match(selected.cards[0].text,/Spring/);
  const missing=await api.load('member',{name:'Unknown Name'});assert.equal(missing.noMatch,true);assert.match(missing.cards[0].url,/#member-dashboard$/);
  const many=setup([gviz([['system_status','LIVE']]),gviz(Array.from({length:6},(_,i)=>publicMember('Taylor Example '+String.fromCharCode(65+i))))]);
  const result=await many.api.load('member',{name:'Taylor'});assert.match(result.text,/last name or full name/);assert.equal(result.cards.length,0);
});
test('failed member status checks never return cached totals',async()=>{
  const {api}=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Taylor Example')]),new Error('Status unavailable')]);
  assert.equal((await api.load('member',{name:'Taylor Example'})).cards.length,1);
  assert.equal((await api.load('member',{name:'Taylor Example'})).cards.length,0);
});

test('configured event vocabulary classifies new phrases without adapter changes',async()=>{
  const source={checkedAt:new Date().toISOString(),events:[
    {title:'Laser cutter orientation',start:'2099-01-01T18:00:00Z'},
    {title:'Laser cutter orientations',start:'2099-01-02T18:00:00Z'},
    {title:'Technical workshop',start:'2099-01-03T18:00:00Z'}
  ]};
  const {api}=setup([source]);api.configure({eventTypes:{workshop:['laser cutter orientation']}});
  const result=await api.load('events',{eventType:'workshop'});
  assert.deepEqual(Array.from(result.cards,card=>card.title),['Laser cutter orientation']);
});
test('public category labels prefer GViz header labels with per-column fallbacks',async()=>{
  const labels=Array(15).fill('');labels[7]='Chapter sessions';labels[8]='Community gatherings';
  const {api}=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Taylor Example')],labels)]);
  const answer=await api.load('member',{name:'Taylor Example'});
  assert.match(answer.cards[0].text,/Chapter sessions: 1/);assert.match(answer.cards[0].text,/Community gatherings: 2/);
  assert.ok(!answer.cards[0].text.includes('General body meetings:'));
  const fallback=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Taylor Example')],['Rank'])]);
  assert.match((await fallback.api.load('member',{name:'Taylor Example'})).cards[0].text,/General body meetings: 1/);
});
test('configured constants determine public request URLs and partial updates preserve prior settings',async()=>{
  const {api,requests}=setup([gviz([['system_status','LIVE']]),gviz([publicMember('Taylor Example')]),freshMedia([{title:'Post',permalink:'javascript:unsafe'}])]);
  api.configure({sheetID:'public_test_sheet',assetBase:'https://asme-osu.github.io/ASME-OSU-Website/',siteBase:'https://org.osu.edu/asme/',contactEmail:'team@example.org',instagramHandle:'example.chapter'});
  api.configure({eventTypes:{meeting:['chapter assembly']}});
  await api.load('member',{name:'Taylor Example'});
  assert.match(requests[0].url,/\/d\/public_test_sheet\/gviz\/tq/);
  assert.match(requests[1].url,/sheet=Leaderboard_Public/);
  assert.equal((await api.load('instagram')).cards[0].url,'https://www.instagram.com/example.chapter/');
  assert.throws(()=>api.configure({sheetID:'id?sheet=Private'}),/Invalid public sheet ID/);
  assert.throws(()=>api.configure({instagramHandle:'unsafe/path'}),/Invalid Instagram handle/);
  assert.throws(()=>api.configure({siteBase:'https://evil.example/asme/'}),/Invalid public site base/);
});
test('unconfigured adapter does not request any implicit feed or sheet',async()=>{
  let requests=0;const context={URL,AbortController,Date,setTimeout,clearTimeout,fetch:async()=>{requests++;throw Error('Unexpected request');}};
  vm.runInNewContext(code,context);
  for(const kind of ['member','leaderboard','points','gallery','instagram','events']) assert.equal((await context.GearlyLive.load(kind)).cards.length,0);
  assert.equal(requests,0);
});


test('academic dates do not consume the three chapter results and generic info sessions are not company events',async()=>{
 const events=[{title:'Final Exams',start:'2099-01-01'},{title:'Autumn Break',start:'2099-01-02'},{title:'MATLAB Info Session',start:'2099-01-03'},...['Social event','Workshop','Company recruiting'].map((title,i)=>({title,start:'2099-01-0'+(i+4)}))];
 const {api}=setup([{events},{events}]);
 assert.deepEqual(Array.from((await api.load('events')).cards,c=>c.title),['MATLAB Info Session','Social event','Workshop']);
 assert.deepEqual(Array.from((await api.load('events',{eventType:'company'})).cards,c=>c.title),['Company recruiting']);
});


test('adding deadline and other vocabulary leaves general, company and workshop answers unchanged on the current feed', async () => {
  const feed = JSON.parse(readFileSync(new URL('../data/calendar-events.json',import.meta.url),'utf8'));
  const baseline = JSON.parse(readFileSync(new URL('../assets/gearly/gearly-data.json',import.meta.url),'utf8'));
  baseline.eventTypes = {...baseline.eventTypes};
  delete baseline.eventTypes.deadline;
  delete baseline.eventTypes['academic-support'];
  delete baseline.eventTypes['ice-skating'];
  baseline.eventTypes.social = baseline.eventTypes.social.filter(word => !['skating','ice skating','friendsgiving','sweets with swe'].includes(word));
  for (const filter of [{},{eventType:'company'},{eventType:'workshop'}]) {
    const before = setup([feed]).api;
    before.configure({eventTypes:baseline.eventTypes, companies:siteData.entities.companies});
    const after = setup([feed]).api;
    after.configure({companies:siteData.entities.companies});
    assert.deepEqual(JSON.parse(JSON.stringify((await after.load('events',filter)).cards)), JSON.parse(JSON.stringify((await before.load('events',filter)).cards)));
  }
});

test('social filters include ice skating in range; deadlines never override academic exclusions', async () => {
  const events = [{title:'ASME Ice Skating Event',start:'2099-01-15'},{title:'Initial Fee Due Date',start:'2099-01-16'},{title:'Chapter competition deadline',start:'2099-01-17'}];
  const {api} = setup([{events},{events}]);
  const social = await api.load('events',{eventType:'social',dateRange:{from:'2099-01-01',to:'2099-01-31'}});
  assert.deepEqual(Array.from(social.cards,c=>c.title),['ASME Ice Skating Event']);
  assert.deepEqual(Array.from((await api.load('events',{eventType:'deadline'})).cards,c=>c.title),['Chapter competition deadline']);
});


test('specific skating requests reach the skating event in the current feed even when other socials are earlier', async () => {
  const feed = JSON.parse(readFileSync(new URL('../data/calendar-events.json',import.meta.url),'utf8'));
  const {api} = setup([feed]);
  const value = await api.load('events',{eventType:'ice-skating'});
  assert.deepEqual(Array.from(value.cards,c=>c.title),['ASME Ice Skating Event']);
});
