import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/gearly/gearly.js','utf8');
const raw=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json'));
const fresh=JSON.parse(fs.readFileSync('tests/gearly/fresh-2026-11-13.json'));
const context={module:{exports:{}},URL,console};vm.runInNewContext(source,context);const engine=context.module.exports;
const data=engine.validateData(structuredClone(raw)).data;
async function start(setup){
 const dom=new JSDOM('<main>Chapter site</main>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:true,json:async()=>structuredClone(raw)});setup?.(w);w.eval(source);
 for(let n=0;n<50&&!w.Gearly;n++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(w.Gearly);
 return {dom,w,ask:text=>w.Gearly.ask(text),reply:()=>[...w.document.querySelectorAll('.gearly-bot')].at(-1)?.textContent};
}
for(const [text,intent] of fresh.single)test('fresh single: '+text,()=>{const got=engine.match(data,text);assert.equal(got.kind,'answer');assert.equal(got.intent.id,intent);});
for(const [text,intents] of fresh.compound)test('fresh compound: '+text,()=>assert.deepEqual(Array.from(engine.planQuestions(data,text),plan=>plan.result.intent.id),intents));
for(const text of fresh.noCompound)test('safe compound boundary: '+text,()=>assert.equal(engine.planQuestions(data,text).length,0));
const eventState=()=>Object.assign(engine.createState(),{lastIntent:'events',lastLiveSource:'events',slots:{company:'pratt-whitney',eventType:'company',dateRange:{from:'2099-01-01',to:'2099-01-31',label:'this-month'},selectedEventId:'old'}});
for(const [text,key,expected] of fresh.refinement)test('fresh event refinement: '+text,()=>{const result=engine.eventRefinement(data,text,eventState());assert.ok(result);assert.equal(key==='clarifyTime'?result[key]:key==='dateRange'?result.entities[key].label:result.entities[key],expected);if(result.entities){assert.equal(result.entities.company,'pratt-whitney');assert.equal(result.entities.selectedEventId,undefined);}});
for(const text of fresh.unsafeRefinement)test('safe event refinement boundary: '+text,()=>assert.equal(engine.eventRefinement(data,text,eventState()),null));
test('filters are contextual and can be cleared independently',()=>{
 assert.equal(engine.eventRefinement(data,'only workshops',engine.createState()),null);
 const state=eventState();Object.assign(state.slots,{afterMinutes:1020,beforeMinutes:1300});
 for(const [query,key] of [['all types','eventType'],['any company','company'],['any time','afterMinutes']]){const got=engine.eventRefinement(data,query,state);assert.ok(got);assert.equal(got.entities[key],undefined);assert.equal(got.entities.dateRange.from,'2099-01-01');}
});
test('combined answers render both topics in one reply and one user history turn',async()=>{
 const page=await start();await page.ask('How do I join and are there dues?');assert.match(page.reply(),/1\. How do I join/);assert.match(page.reply(),/2\. are there dues/);assert.match(page.reply(),/free|dues/i);assert.doesNotMatch(page.reply(),/Which of these/);
 assert.equal(page.w.document.querySelectorAll('.gearly-user').length,1);assert.equal(JSON.parse(page.w.sessionStorage.getItem('gearly_state_v1')).lastIntent,'dues');page.dom.window.close();
});
test('compound live answers use their own source and cancellation discards late answers',async()=>{
 let resolve;const page=await start(w=>{w.GearlyLive={configure(){},load:()=>new Promise(done=>resolve=done)};});const pending=page.ask('How do I join and show upcoming events?');
 for(let n=0;n<20&&!resolve;n++)await Promise.resolve();assert.ok(resolve);await page.ask('never mind');resolve({text:'Late compound event result',cards:[],sourceLabel:'Calendar'});await pending;
 assert.doesNotMatch(page.w.document.querySelector('.gearly-messages').textContent,/Late compound event result/);assert.match(page.reply(),/No problem/);assert.equal(JSON.parse(page.w.sessionStorage.getItem('gearly_state_v1')).lastIntent,null);page.dom.window.close();
});
test('event UI refinements preserve company and date filters, and clarify ambiguous hours',async()=>{
 const calls=[];const page=await start(w=>{w.GearlyLive={configure(){},load:async(kind,options)=>{calls.push(structuredClone(options));return {text:'Filtered calendar results',cards:[],updatedAt:'2026-11-13T01:00:00Z',sourceLabel:'Calendar'};}};});
 await page.ask('Pratt and Whitney events next month');await page.ask('only workshops');await page.ask('anything after 5?');assert.match(page.reply(),/5 AM or 5 PM/);assert.equal(calls.length,2);
 await page.ask('after 5 pm');assert.equal(calls.at(-1).afterMinutes,1020);assert.equal(calls.at(-1).eventType,'workshop');assert.equal(calls.at(-1).company,'pratt-whitney');assert.equal(calls.at(-1).dateRange.label,'next-month');
 await page.ask('what about next week?');assert.equal(calls.at(-1).afterMinutes,1020);assert.equal(calls.at(-1).eventType,'workshop');assert.equal(calls.at(-1).dateRange.label,'next-week');page.dom.window.close();
});
test('recovery names actual choices and supplies a relevant page; browsing topics is actionable',async()=>{
 const page=await start();await page.ask('career events');assert.match(page.reply(),/Do you mean/);assert.ok([...page.w.document.querySelectorAll('.gearly-bot')].at(-1).querySelector('a.gearly-card'));
 await page.ask('unrecognized quantum duck');await page.ask('Browse topics');assert.ok(page.w.document.querySelectorAll('.gearly-chip').length>3);page.dom.window.close();
});
test('freshness is explicit, Eastern Time and honest about missing or invalid timestamps',()=>{
 assert.match(engine.sourceNote({sourceLabel:'Calendar',updatedAt:'2026-01-15T23:00:00Z'}),/Jan 15, 2026.*6:00 PM EST/);
 assert.match(engine.sourceNote({sourceLabel:'Points'}),/Refresh time unavailable/);
 for(const updatedAt of ['invalid','2099-01-01'])assert.match(engine.sourceNote({updatedAt}),/Refresh time unavailable/);
 assert.match(engine.sourceNote({updatedAt:'2026-01-15',stale:true}),/Older snapshot/);
});
test('compound public leaderboard answers cannot save names',async()=>{
 const page=await start(w=>{w.GearlyLive={configure(){},load:async()=>({text:'Public leaderboard',cards:[{title:'PRIVATE TEST NAME',url:'https://org.osu.edu/asme/member-points-page/'}]})};});
 await page.ask('show leaderboard and how do I join');assert.doesNotMatch(page.w.sessionStorage.getItem('gearly_state_v1'),/PRIVATE TEST NAME/);assert.equal(engine.planQuestions(data,'show leaderboard and how do I join').length,0);page.dom.window.close();
});
test('mixed-source compound selections use the selected card context in either order',async()=>{
 for(const query of ['career resources and upcoming events','upcoming events and career resources']){
  const calls=[];const page=await start(w=>{w.GearlyLive={configure(){},load:async(kind,options)=>{calls.push({kind,options});return {text:'Upcoming events',cards:[{id:'event-one',title:'Event One',url:'https://org.osu.edu/asme/calendar/'}]};}};});
  await page.ask(query);const eventFirst=query.startsWith('upcoming');const before=calls.length;await page.ask(eventFirst?'show the second result':'show the first result');assert.equal(calls.length,before);assert.match(page.reply(),/Member Resources|Career/i);
  await page.ask(eventFirst?'show the first result':'show the second result');assert.equal(calls.at(-1).kind,'events');assert.equal(calls.at(-1).options.selectedEventId,'event-one');assert.match(page.reply(),/Event One/);page.dom.window.close();
 }
});
test('ambiguous minutes clarify and accept a natural typed period; filter deletions stick',async()=>{
 const calls=[];const page=await start(w=>{w.GearlyLive={configure(){},load:async(kind,options)=>{calls.push(structuredClone(options));return {text:'Calendar',cards:[]};}};});
 await page.ask('Pratt and Whitney events next month');await page.ask('and only workshops');await page.ask('anything after 5:30?');assert.match(page.reply(),/5:30 AM or 5:30 PM/);await page.ask('PM');assert.equal(calls.at(-1).afterMinutes,1050);
 await page.ask('what about all types');assert.equal(calls.at(-1).eventType,undefined);assert.equal(calls.at(-1).company,'pratt-whitney');await page.ask('and any company');assert.equal(calls.at(-1).company,undefined);await page.ask('what about any time');assert.equal(calls.at(-1).afterMinutes,undefined);assert.equal(calls.at(-1).dateRange.label,'next-month');page.dom.window.close();
});
test('compound clauses are deduplicated and contact includes the configured email link',async()=>{
 assert.deepEqual(Array.from(engine.planQuestions(data,'join and join and dues'),p=>p.result.intent.id),['join','dues']);const page=await start();await page.ask('how do I join and contact ASME');assert.match(page.reply(),/asme@osu.edu/);assert.ok([...page.w.document.querySelectorAll('.gearly-bot')].at(-1).querySelector('a[href="mailto:asme@osu.edu"]'));page.dom.window.close();
});
test('points source read time is distinct from its unknown update time',()=>{
 const note=engine.sourceNote({sourceLabel:'Public points',checkedAt:'2026-01-15T23:00:00Z'});assert.match(note,/Refresh time unavailable/);assert.match(note,/Read Jan 15, 2026.*6:00 PM EST/);assert.doesNotMatch(note,/Updated/);
});
test('a company brand containing and stays one clause within a compound question',()=>{
 const plans=engine.planQuestions(data,'Pratt and Whitney events and how do I join');assert.equal(plans.length,2);assert.equal(plans[0].result.entities.company,'pratt-whitney');assert.equal(plans[1].result.intent.id,'join');
});
test('compound competition answers retain student guidance and live competition filters',async()=>{
 const calls=[];const snapshot=JSON.parse(fs.readFileSync('assets/gearly/gearly-site.json'));const page=await start(w=>{w.eval(fs.readFileSync('assets/gearly/gearly-student.js','utf8'));w.fetch=async url=>({ok:true,json:async()=>structuredClone(String(url).includes('gearly-site.json')?snapshot:raw)});w.GearlyLive={configure(){},load:async(kind,options)=>{calls.push({kind,options:structuredClone(options)});return {text:'Competition calendar listing',cards:[{title:'Design Challenge',id:'competition-one',url:'https://org.osu.edu/asme/calendar/'}]};}};});
 await page.ask('design competitions and how do I join');assert.ok(calls.some(call=>call.kind==='events'&&call.options.eventType==='competition'));assert.match(page.reply(),/chapter participation|project opportunities/i);assert.match(page.reply(),/Competition calendar listing/);page.dom.window.close();
});
test('a new compound question clears an earlier pending time clarification',async()=>{
 let calls=0;const page=await start(w=>{w.GearlyLive={configure(){},load:async()=>{calls++;return {text:'Events',cards:[]};}};});await page.ask('events');await page.ask('after 5?');await page.ask('career resources and upcoming events');const before=calls;await page.ask('PM');assert.equal(calls,before);page.dom.window.close();
});
test('saved mixed officer cards retain their own role for later contact followups',async()=>{
 const setup=w=>{w.GearlyContent={loadLeadership:async()=>({}),resolveLeadership:(_snapshot,text,options)=>{const role=options.roleId || (/president/i.test(text)?'president':'treasurer');return {matched:true,text:'Current '+role,cards:[{title:'Officer '+role,url:'https://org.osu.edu/asme/leadership/#'+role}]};}};};
 const first=await start(setup);await first.ask('who is the president and who is the treasurer');const saved=first.w.sessionStorage.getItem('gearly_state_v1');first.dom.window.close();
 const replay=await start(w=>{w.sessionStorage.setItem('gearly_state_v1',saved);setup(w);});await replay.ask('show the first result');await replay.ask('their email');assert.match(replay.reply(),/Current president/);assert.doesNotMatch(replay.reply(),/Current treasurer/);replay.dom.window.close();
});
test('selecting an ambiguous member also shows the actual public sheet read time',async()=>{
 const page=await start(w=>{w.GearlyLive={configure(){},load:async(_kind,options)=>options.selection?{text:'Public matched member',cards:[],checkedAt:'2026-01-15T23:00:00Z',sourceLabel:'Public leaderboard'}:{text:'Choose a match',cards:[],candidates:[{label:'Avery Example · Autumn',name:'Avery Example',selection:'public-row:1'}]}};});
 await page.ask('my points');await page.ask('Avery Example');[...page.w.document.querySelectorAll('.gearly-chip')].find(button=>button.textContent.includes('Avery Example')).click();
 for(let n=0;n<20&&!/Read Jan/.test(page.reply());n++)await new Promise(resolve=>setTimeout(resolve,2));assert.match(page.reply(),/Read Jan 15, 2026.*6:00 PM EST/);assert.doesNotMatch(page.w.sessionStorage.getItem('gearly_state_v1'),/Avery Example/);page.dom.window.close();
});
