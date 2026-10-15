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
function setup(responses, clock) {
  const requests = [];
  const TestDate = clock ? class extends Date {
    constructor(...args) { super(...(args.length ? args : [typeof clock === 'function' ? clock() : clock])); }
    static now() { return +new Date(typeof clock === 'function' ? clock() : clock); }
  } : Date;
  const context = { URL, AbortController, Date: TestDate, setTimeout, clearTimeout, fetch: async (url, options) => {
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


const octoberNow = '2026-10-15T16:00:00Z';
const octoberFeed = () => ({checkedAt:octoberNow, events:[
  {id:'autumn-break',title:'Autumn Break - no classes, offices open',start:'2026-10-15T12:00:00Z',end:'2026-10-17T12:00:00Z',allDay:true},
  {id:'matlab',title:'ASME MATLAB Info Session',start:'2026-10-22T21:30:00Z',end:'2026-10-22T22:30:00Z',location:'Scott Laboratory E141',description:'Matlab info session'},
  {id:'bar',title:'Bar Social',start:'2026-10-23T22:30:00Z',end:'2026-10-24T00:30:00Z'},
  {id:'bridge',title:'ASME Bridge Building Competition',start:'2026-11-05T22:30:00Z',location:'Scott Laboratory E141',description:'Bridge Building + Lesson'},
  {id:'weekly',title:'Weekly Chapter Meeting',start:'2027-01-14T22:30:00Z',location:'Scott E141'}
]});
test('October 15 next meeting selects the next chapter event and records stable context',async()=>{
  const {api}=setup([octoberFeed(),octoberFeed()],octoberNow);
  const next=await api.load('events',{query:'When and where is the next ASME meeting?',eventType:'meeting'});
  assert.deepEqual(Array.from(next.cards,c=>c.title),['ASME MATLAB Info Session','Bar Social','ASME Bridge Building Competition']);
  assert.equal(next.primaryEventId,'matlab');assert.match(next.text,/Location: Scott Laboratory E141/);
  assert.equal(next.cards[0].detailAvailable,true);assert.equal(next.cards[0].start,'2026-10-22T21:30:00Z');
  const followup=await api.load('events',{query:'Do I need to RSVP for it, and will there be food?',selectedEventId:next.primaryEventId});
  assert.equal(followup.cards.length,1);assert.equal(followup.cards[0].id,'matlab');
  assert.match(followup.text,/RSVP: The listing does not specify whether an RSVP or registration is required/);
  assert.match(followup.text,/Food: The listing does not specify whether food will be provided/);
});
test('fresh empty calendar date differs from stale and unavailable calendar feeds',async()=>{
  const range={from:'2026-10-15',to:'2026-10-15'};
  const fresh=await setup([octoberFeed()],octoberNow).api.load('events',{query:'Is there an ASME event tonight, October 15?',dateRange:range});
  assert.equal(fresh.availability,'fresh');assert.equal(fresh.cards.length,0);assert.match(fresh.text,/don't see a chapter event listed/);assert.equal(fresh.primaryEventId,undefined);
  const old={...octoberFeed(),checkedAt:'2026-10-09T12:00:00Z'};
  const stale=await setup([old],octoberNow).api.load('events',{dateRange:range});
  assert.equal(stale.availability,'stale');assert.equal(stale.stale,true);assert.match(stale.text,/can't confirm/);assert.doesNotMatch(stale.text,/No upcoming events match/);
  const missingDate=await setup([{events:[]}],octoberNow).api.load('events');assert.equal(missingDate.stale,true);assert.match(missingDate.text,/can't confirm/);
  for(const source of [new Error('Network failed'),{events:null},'malformed']){
    const unavailable=await setup([source],octoberNow).api.load('events',{dateRange:range});
    assert.equal(unavailable.availability,'unavailable');assert.equal(unavailable.cards.length,0);assert.match(unavailable.text,/can't confirm/);
  }
});
test('named MATLAB and Bar Social questions answer each unpublished practical detail',async()=>{
  const {api}=setup([octoberFeed(),octoberFeed()],octoberNow);
  const bar=await api.load('events',{query:'Where is the bar social on October 23, and can students under 21 attend?',eventType:'social',dateRange:{from:'2026-10-23',to:'2026-10-23'}});
  assert.equal(bar.cards[0].id,'bar');assert.equal(bar.primaryEventId,'bar');assert.equal(bar.cards[0].detailAvailable,false);
  assert.match(bar.text,/Location: The listing does not specify a location/);assert.match(bar.text,/Age eligibility: The listing does not specify whether students under 21 can attend/);
  const matlab=await api.load('events',{query:'Do I need to bring a laptop or know MATLAB before the MATLAB info session?'});
  assert.deepEqual(Array.from(matlab.cards,c=>c.id),['matlab']);assert.equal(matlab.primaryEventId,'matlab');
  assert.match(matlab.text,/Laptop: The listing does not specify whether you need to bring a laptop/);
  assert.match(matlab.text,/Prior knowledge \/ preparation: The listing does not specify whether prior knowledge or preparation is required/);
});
test('projects and competitions retain type filtering and company/date questions do not use sponsor assumptions',async()=>{
  const {api}=setup([octoberFeed(),octoberFeed()],octoberNow);
  const project=await api.load('events',{query:'What hands-on projects or design competitions can I get involved in through ASME?',eventType:'competition'});
  assert.deepEqual(Array.from(project.cards,c=>c.id),['bridge']);
  const company=await api.load('events',{query:'Will SpaceX be at the meeting tomorrow?',company:'spacex',dateRange:{from:'2026-10-16',to:'2026-10-16'}});
  assert.equal(company.cards.length,0);assert.match(company.text,/don't see a chapter event listed/);
});
test('detail requests without a primary selection ask which event and never assume the first',async()=>{
  const {api}=setup([octoberFeed(),octoberFeed(),octoberFeed()],octoberNow);
  const list=await api.load('events',{query:'Show upcoming events'});assert.equal(list.primaryEventId,undefined);
  const details=await api.load('events',{query:'Does it have food?'});assert.equal(details.needsEventSelection,true);assert.equal(details.primaryEventId,undefined);assert.match(details.text,/Which event/);
  const named=await api.load('events',{query:'Does MATLAB or the Bar Social have food?'});assert.equal(named.needsEventSelection,true);assert.deepEqual(Array.from(named.cards,c=>c.id),['matlab','bar']);
});
test('selected event IDs resolve exactly, remain usable after the event and fail explicitly when absent',async()=>{
  const source=octoberFeed();source.events.push({id:'past',title:'Earlier workshop',start:'2026-10-14T20:00:00Z',end:'2026-10-14T21:00:00Z',description:'Bring a laptop. No prior experience is required.'});
  const {api}=setup([source,source,source],octoberNow);
  const selected=await api.load('events',{eventId:'past',query:'Do I need a laptop or prior experience?'});
  assert.deepEqual(Array.from(selected.cards,c=>c.id),['past']);assert.equal(selected.primaryEventId,'past');assert.match(selected.text,/Bring a laptop/);assert.match(selected.text,/No prior experience is required/);
  const missing=await api.load('events',{selectedEventId:'deleted',query:'Does it have food?'});
  assert.equal(missing.cards.length,0);assert.equal(missing.selectedEventUnavailable,true);assert.equal(missing.primaryEventId,undefined);assert.match(missing.text,/previously selected event is unavailable/);
  const other=await api.load('events',{selectedEventId:'bar',query:'Does it have food?'});assert.equal(other.cards[0].id,'bar');assert.doesNotMatch(other.text,/Bring a laptop/);
});
test('description excerpts preserve explicit source wording without inferring policy from event titles',async()=>{
  const source={checkedAt:octoberNow,events:[{id:'pizza',title:'21+ pizza laptop beginners workshop',start:'2026-10-22T20:00:00Z',description:'This is a technical session. RSVP is not required. Food will not be provided. Bring a laptop if you have one. No prior experience is required. Students under 21 may attend.'}]};
  const answer=await setup([source],octoberNow).api.load('events',{selectedEventId:'pizza',query:'Do I need to RSVP, will there be food, should I bring a laptop, do I need prior knowledge, and can students under 21 attend?'});
  for(const evidence of ['RSVP is not required.','Food will not be provided.','Bring a laptop if you have one.','No prior experience is required.','Students under 21 may attend.']) assert.ok(answer.text.includes(evidence));
  const titleOnly=await setup([{checkedAt:octoberNow,events:[{...source.events[0],description:''}]}],octoberNow).api.load('events',{selectedEventId:'pizza',query:'Is there food, should I bring a laptop, and can students under 21 attend?'});
  assert.equal((titleOnly.text.match(/does not specify/g)||[]).length,3);
});
test('next events with tied starts do not create an arbitrary primary selection',async()=>{
  const source={checkedAt:octoberNow,events:[{id:'one',title:'One event',start:'2026-10-22T20:00:00Z'},{id:'two',title:'Two event',start:'2026-10-22T20:00:00Z'}]};
  const answer=await setup([source],octoberNow).api.load('events',{query:'Does the next event have food?'});
  assert.equal(answer.primaryEventId,undefined);assert.equal(answer.needsEventSelection,true);
});
test('ongoing events use their end time and fallback IDs are stable across queries',async()=>{
  const source={checkedAt:octoberNow,events:[{title:'Ongoing workshop',start:'2026-10-15T15:00:00Z',end:'2026-10-15T17:00:00Z'},{title:'Finished workshop',start:'2026-10-15T14:00:00Z',end:'2026-10-15T15:00:00Z'}]};
  const {api}=setup([source,source],octoberNow);
  const list=await api.load('events');assert.equal(list.cards.length,1);assert.match(list.cards[0].id,/event:ongoing workshop:/);
  const followup=await api.load('events',{selectedEventId:list.cards[0].id,query:'Where is it?'});assert.equal(followup.cards[0].id,list.cards[0].id);
});
test('refresh failure retains a stale snapshot but never reports a fresh empty calendar',async()=>{
  let now=+new Date(octoberNow);
  const {api}=setup([octoberFeed(),new Error('Network failed')],()=>now);
  const first=await api.load('events',{query:'What is next?'});assert.equal(first.availability,'fresh');now+=61000;
  const failed=await api.load('events',{query:'What is next?'});assert.equal(failed.availability,'stale');assert.equal(failed.stale,true);assert.equal(failed.cards[0].id,'matlab');assert.match(failed.text,/could not be refreshed/);
});

test('date-only all-day and ongoing multiday events preserve Eastern dates and exclusive end dates',async()=>{
  const source={checkedAt:octoberNow,events:[
    {id:'all-day',title:'All-day chapter workshop',start:'2026-10-15',allDay:true},
    {id:'ongoing',title:'Overnight chapter activity',start:'2026-10-14T21:00:00Z',end:'2026-10-16T01:00:00Z'},
    {id:'finished',title:'Ended all-day workshop',start:'2026-10-14',end:'2026-10-15',allDay:true},
    {id:'invalid',title:'Invalid interval',start:'2026-10-22T21:00:00Z',end:'2026-10-21T21:00:00Z'}]};
  const answer=await setup([source],octoberNow).api.load('events',{dateRange:{from:'2026-10-15',to:'2026-10-15'}});
  assert.deepEqual(Array.from(answer.cards,c=>c.id),['ongoing','all-day']);
  assert.match(answer.cards[1].text,/Oct 15, 2026 · All day/);
});
test('location may be quoted from the public description when the venue field is empty',async()=>{
  const answer=await setup([{checkedAt:octoberNow,events:[{id:'location',title:'Chapter activity',start:'2026-10-22T21:00:00Z',description:'Meet at Scott Laboratory E141.'}]}],octoberNow).api.load('events',{selectedEventId:'location',query:'Where is it?'});
  assert.match(answer.text,/Location: The public description says “Meet at Scott Laboratory E141/);
});

test('a next-week list has no arbitrary primary, while next named event selects its earliest occurrence',async()=>{
  const source={checkedAt:octoberNow,events:[{id:'matlab-one',title:'MATLAB workshop',start:'2026-10-22T21:00:00Z'},{id:'matlab-two',title:'MATLAB workshop',start:'2026-10-23T21:00:00Z'}]};
  const {api}=setup([source,source],octoberNow);
  const week=await api.load('events',{query:'What events are there next week?',dateRange:{from:'2026-10-19',to:'2026-10-25'}});assert.equal(week.primaryEventId,undefined);
  const next=await api.load('events',{query:'Does the next MATLAB event have food?'});assert.equal(next.primaryEventId,'matlab-one');assert.match(next.text,/Food: The listing does not specify/);
});
