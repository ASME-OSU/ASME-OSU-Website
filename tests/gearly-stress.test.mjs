import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/gearly/gearly.js','utf8');
const config=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json','utf8'));
const context={module:{exports:{}},URL,console};vm.runInNewContext(source,context);const engine=context.module.exports;
const data=engine.validateData(structuredClone(config)).data;
async function start(setup){
 const dom=new JSDOM('<main>Chapter site</main>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});w.fetch=async()=>({ok:true,json:async()=>structuredClone(config)});setup?.(w);w.eval(source);
 for(let n=0;n<50&&!w.Gearly;n++)await new Promise(resolve=>setTimeout(resolve,2));assert.ok(w.Gearly);return {dom,w,ask:text=>w.Gearly.ask(text),reply:()=>[...w.document.querySelectorAll('.gearly-bot')].at(-1)?.textContent};
}
test('a points-name prompt can be canceled or replaced with a different topic',async()=>{
 for(const next of ['cancel','never mind','no thanks','show upcoming events','where is the GroupMe']){
  let calls=[];const page=await start(w=>{w.GearlyLive={configure(){},load:async(kind)=>{calls.push(kind);return {text:'Published event listing',cards:[]};}};});
  await page.ask('my points');assert.match(page.reply(),/What name/);await page.ask(next);
  assert.doesNotMatch(page.reply(),/Please give the name|What name|could not confidently/,next);
  if(['cancel','never mind','no thanks'].includes(next)){assert.match(page.reply(),/No problem/);assert.equal(calls.length,0);}
  if(next==='show upcoming events')assert.ok(calls.includes('events'));
  page.dom.window.close();
 }
});
test('date followups never turn unrelated questions into a confident old-topic answer',()=>{
 for(const previous of ['join','events','careers'])for(const query of ['what about nuclear reactors next week','what about my chemistry exam tomorrow','and mortgage rates next month']){
  const state=engine.createState();state.lastIntent=previous;assert.notEqual(engine.match(data,query,state).kind,'answer',previous+': '+query);
 }
 const state=engine.createState();state.lastIntent='events';const result=engine.match(data,'what about next week',state);assert.equal(result.kind,'answer');assert.equal(result.intent.liveSource,'events');
});
test('followups can select the fourth and fifth cards that Gearly displays',()=>{
 for(const [text,index] of [['show the fourth one',3],['open the 5th result',4],['the fifth photo',4]])assert.equal(engine.followupRequest(text)?.index,index,text);
});
test('rapid requests resolved in reverse order only show the newest live reply',async()=>{
 const waiting=[];const page=await start(w=>{w.GearlyLive={configure(){},load:()=>new Promise(resolve=>waiting.push(resolve))};});
 const first=page.ask('events');for(let n=0;n<20&&!waiting.length;n++)await Promise.resolve();
 const second=page.ask('show photos');for(let n=0;n<20&&waiting.length<2;n++)await Promise.resolve();assert.equal(waiting.length,2);
 waiting[1]({text:'Newest photo response',cards:[]});await second;waiting[0]({text:'Stale event response',cards:[]});await first;
 assert.match(page.reply(),/Newest photo response/);assert.doesNotMatch(page.w.document.querySelector('.gearly-messages').textContent,/Stale event response/);assert.equal(page.w.document.querySelector('.gearly-messages').hasAttribute('aria-busy'),false);page.dom.window.close();
});
test('clearing while page help is loading never restores a canceled answer',async()=>{
 let resolve;const page=await start(w=>{w.GearlySearch={configure(){},records:()=>new Promise(done=>resolve=done)};});
 const pending=page.ask('explain this page');page.w.document.querySelector('[aria-label="Clear chat"]').click();resolve([{id:'home',url:'https://org.osu.edu/asme/',sections:[{title:'Canceled section'}]}]);await pending;
 assert.doesNotMatch(page.w.document.querySelector('.gearly-messages').textContent,/Canceled section|You’re on Home/);assert.ok(page.w.document.querySelector('.gearly-welcome'));page.dom.window.close();
});
test('malformed and extreme input does not crash matching or create executable message markup',async()=>{
 const samples=['',' '.repeat(500),'👋'.repeat(250),'\u0000'.repeat(500),'<img src=x onerror=alert(1)>','javascript:alert(1)','a'.repeat(500),"'".repeat(500),'e\u0301'.repeat(250),'???'.repeat(150)];
 for(const text of samples)assert.doesNotThrow(()=>engine.match(data,text,engine.createState()),text.slice(0,30));
 const page=await start();for(const text of ['<script>window.attacked=true</script>','<img src=x onerror=alert(1)>'])await page.ask(text);
 assert.equal(page.w.document.querySelector('.gearly-messages script'),null);assert.equal(page.w.document.querySelector('.gearly-messages img[onerror]'),null);assert.equal(page.w.attacked,undefined);page.dom.window.close();
});

test('offline live sources leave a useful answer and clear the busy state',async()=>{
 const page=await start(w=>{w.GearlyLive={configure(){},load:async()=>{throw Error('offline');}};});
 await page.ask('events');assert.match(page.reply(),/unavailable|check the linked page/i);assert.equal(page.w.document.querySelector('.gearly-activity'),null);assert.equal(page.w.document.querySelector('.gearly-messages').hasAttribute('aria-busy'),false);page.dom.window.close();
});
test('common conversational wrappers preserve confident website topics',()=>{
 let checked=0;
 for(const intent of data.intents.filter(intent=>!['greeting','thanks','goodbye','identity'].includes(intent.id))){
  const q=intent.examples[0],base=engine.match(data,q,engine.createState());if(base.kind!=='answer'||base.intent.id!==intent.id)continue;
  for(const variant of ['Hey Gearly, '+q,q+', thanks!','please '+q,q.toUpperCase()]){
   const got=engine.match(data,variant,engine.createState());assert.equal(got.kind,'answer',variant);assert.equal(got.intent.id,base.intent.id,variant);checked++;
  }
 }
 assert.ok(checked>=120,'exercise at least 120 independently phrased topic variants');
});
test('a typed member name still works after small talk and never leaks into saved history',async()=>{
 const seen=[];const page=await start(w=>{w.GearlyLive={configure(){},load:async(kind,options)=>{seen.push([kind,options.name]);return {text:'Public points result for Avery Example',cards:[]};}};});
 await page.ask('my points');await page.ask('hello');await page.ask('Avery Example');assert.ok(seen.some(([kind,name])=>kind==='member'&&name==='Avery Example'));assert.doesNotMatch(page.w.sessionStorage.getItem('gearly_state_v1'),/Avery Example/);page.dom.window.close();
});

test('off-topic and negated pronoun followups do not reuse an event response',async()=>{
 for(const q of ['where is it on another planet','do not attend it']){
  let calls=0;const page=await start(w=>{w.GearlyLive={configure(){},load:async()=>{calls++;return {text:'Known event details',cards:[]};}};});await page.ask('events');await page.ask(q);assert.equal(calls,1,q);assert.doesNotMatch(page.reply(),/Known event details/,q);page.dom.window.close();
 }
});
test('corrupt or unavailable session storage does not break a chat turn',async()=>{
 for(const mode of ['malformed','denied']){
  const page=await start(w=>{if(mode==='malformed')w.sessionStorage.setItem('gearly_state_v1','{broken json');else Object.defineProperty(w,'sessionStorage',{get(){throw Error('denied');}});});
  await page.ask('how do i join');assert.match(page.reply(),/newsletter|Join page/i);page.w.document.querySelector('[aria-label="Clear chat"]').click();assert.ok(page.w.document.querySelector('.gearly-welcome'));page.dom.window.close();
 }
});

test('fifth-card selection renders the exact selected card and out-of-range selection explains the available count',async()=>{
 const cards=Array.from({length:5},(_,n)=>({title:'Photo '+(n+1),url:'https://org.osu.edu/asme/pictures/#photo-'+(n+1)}));const page=await start(w=>{w.GearlyLive={configure(){},load:async()=>({text:'Published photo list',cards})};});
 await page.ask('show photos');await page.ask('show me the fifth result');assert.match(page.reply(),/Photo 5/);assert.doesNotMatch(page.reply(),/Photo 1/);assert.equal([...page.w.document.querySelectorAll('.gearly-bot')].at(-1).querySelectorAll('.gearly-card').length,1);
 await page.ask('show me the fourth one');assert.match(page.reply(),/Photo 4/);page.dom.window.close();
 const short=await start(w=>{w.GearlyLive={configure(){},load:async()=>({text:'Two photos',cards:cards.slice(0,2)})};});await short.ask('show photos');await short.ask('the fifth one');assert.match(short.reply(),/only 2 result/);short.dom.window.close();
});
test('canceling a live request prevents the late answer from returning',async()=>{
 let resolve;const page=await start(w=>{w.GearlyLive={configure(){},load:()=>new Promise(done=>resolve=done)};});const pending=page.ask('events');for(let n=0;n<20&&!resolve;n++)await Promise.resolve();assert.ok(resolve);
 await page.ask('never mind');resolve({text:'Canceled event response',cards:[]});await pending;assert.doesNotMatch(page.w.document.querySelector('.gearly-messages').textContent,/Canceled event response/);assert.match(page.reply(),/No problem/);assert.equal(JSON.parse(page.w.sessionStorage.getItem('gearly_state_v1')).lastIntent,null);page.dom.window.close();
});

test('friendly greeting variants work in both the chat and the matching engine',()=>{
 for(const text of ['Hello there friend','Hey there buddy!','Hi Gearly','howdy pal','good evening mate']){assert.ok(engine.socialReply(text));const got=engine.match(data,text,engine.createState());assert.equal(got.kind,'answer',text);assert.equal(got.intent.id,'greeting',text);}
 assert.equal(engine.socialReply('hello friend, where is the GroupMe?'),null);
});
