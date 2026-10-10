import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const context={module:{exports:{}},URL,console};vm.runInNewContext(fs.readFileSync(new URL('../assets/gearly/gearly.js',import.meta.url),'utf8'),context);const e=context.module.exports;
const raw={meta:{siteBase:'/asme'},synonyms:{join:['signup']},pages:[{id:'join',title:'Join',url:'/asme/join/'}],intents:[{id:'join',examples:['how do i join'],keywords:{join:3},negations:['quit'],response:{text:'Join us'}},{id:'events',examples:['events','next events'],keywords:{events:3},response:{text:'Events'}}],entities:{roles:[{id:'president',aliases:['pres']}]} };
const data=e.validateData(raw).data;
test('exact and synonym answers are deterministic',()=>{assert.equal(e.match(data,'How do I join?',e.createState()).intent.id,'join');assert.equal(e.match(data,'signup').kind,'answer');assert.deepEqual(e.scoreIntents(data,'signup'),e.scoreIntents(data,'signup'));});
test('nonsense and negation do not claim confidence',()=>{assert.equal(e.match(data,'purple space bananas').kind,'fallback');assert.notEqual(e.match(data,'quit join').kind,'answer');});
test('validator discards duplicate IDs, unsafe URLs, malformed dates',()=>{const r=e.validateData({...raw,pages:[...raw.pages,{id:'bad',title:'Unsafe',url:'javascript:alert(1)'}],intents:[...raw.intents,raw.intents[0]],events:[{title:'Bad',date:'nonsense'}]});assert.equal(r.data.intents.length,2);assert.equal(r.data.pages.length,1);assert.equal(r.data.events.length,0);assert.ok(r.errors.length>=3);assert.equal(e.validateData(null).data,null);});
test('entities and date followups resolve without networking',()=>{const entities=e.extractEntities('pres next week',data,new Date('2026-10-10T12:00:00Z'));assert.equal(entities.role,'president');assert.equal(entities.dateRange.label,'next-week');const s=e.createState();s.lastIntent='events';assert.equal(e.match(data,'what about next month',s).intent.id,'events');});
test('URL protocol guard blocks executable URLs',()=>{for(const u of ['javascript:alert(1)','data:text/html,x','file:///etc/passwd'])assert.equal(e.safeURL(u),null);assert.ok(e.safeURL('mailto:asme@example.org'));});
test('non-array nested data is discarded safely',()=>{const r=e.validateData({...raw,events:{bad:true},officers:4,faqs:'bad',intents:[{...raw.intents[0],actions:{}}],pages:[{...raw.pages[0],sections:{}}]});assert.equal(r.data.events.length,0);assert.equal(r.data.intents[0].actions.length,0);assert.equal(r.data.pages[0].sections.length,0);});
test('date ranges use Eastern calendar independently of runtime timezone',()=>{const original=process.env.TZ;try{for(const zone of ['Pacific/Auckland','Asia/Tokyo','America/Los_Angeles','UTC']){process.env.TZ=zone;const r=e.extractEntities('today',data,new Date('2026-10-11T02:00:00Z'));assert.equal(r.dateRange.from,'2026-10-10');assert.equal(e.extractEntities('tomorrow',data,new Date('2026-10-11T02:00:00Z')).dateRange.from,'2026-10-11');assert.equal(e.extractEntities('Oct 14',data,new Date('2026-10-11T02:00:00Z')).dateRange.from,'2026-10-14');}}finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}});
test('malformed nested entities and keyword values never crash matching',()=>{const broken=e.validateData({...raw,entities:{roles:[null,'bad',{id:'president',aliases:'not an array'}],topics:{}},intents:[{...raw.intents[0],keywords:{join:{bad:true},other:Infinity}},raw.intents[1]]}).data;assert.doesNotThrow(()=>e.match(broken,'president'));assert.equal(Object.keys(broken.intents[0].keywords).length,0);});
test('two confident distinct clauses request one choice',()=>{const m=e.match(data,'how do i join and events');assert.equal(m.kind,'clarify');assert.deepEqual(Array.from(m.candidates,c=>c.intent.id),['join','events']);});

test('malformed response collections and slot requirements are safely discarded', () => {
  const raw = JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json', 'utf8'));
  raw.intents[0].requires = 'company';
  raw.intents[0].response.cards = { title: 'Broken' };
  raw.intents[0].response.chips = [null, 4, 'Events'];
  const checked = e.validateData(raw);
  assert.equal(checked.data.intents[0].requires.length, 0);
  assert.equal(checked.data.intents[0].response.cards.length, 0);
  assert.equal(checked.data.intents[0].response.chips.length, 1);
  assert.doesNotThrow(() => e.match(checked.data, 'join'));
});
