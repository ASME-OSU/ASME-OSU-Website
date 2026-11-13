import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const source=fs.readFileSync('assets/gearly/gearly.js','utf8');
const raw=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start({motion=false,live,history}={}){
 const dom=new JSDOM('<main>Chapter</main>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:!motion});w.fetch=async()=>({ok:true,json:async()=>structuredClone(raw)});
 if(live)w.GearlyLive={configure(){},load:live};if(history)w.sessionStorage.setItem('gearly_state_v1',history);
 w.eval(source);for(let n=0;n<50&&!w.Gearly;n++)await wait(2);assert.ok(w.Gearly);
 const list=w.document.querySelector('.gearly-messages');let top=0,writes=[];
 // JSDOM has no layout. Supply a bounded scrolling viewport and content geometry
 // to exercise actual UI scrolling, asynchronous delivery and keyboard controls.
 function height(node){
  if(node.classList.contains('gearly-message')){if(node.classList.contains('gearly-user'))return 70;return Math.max(parseFloat(node.style.minHeight)||0,(node.querySelector('p')?.textContent.length||0)>180?720:130);}
  if(node.classList.contains('gearly-chips'))return 90;
  if(node.classList.contains('gearly-activity'))return 40;return 100;
 }
 Object.defineProperties(list,{
  clientHeight:{get:()=>300},
  scrollHeight:{get:()=>[...list.children].reduce((sum,node)=>sum+height(node),28)},
  scrollTop:{get:()=>top,set:value=>{const next=Math.max(0,Math.min(Number(value)||0,list.scrollHeight-list.clientHeight));writes.push(next);if(next!==top){top=next;queueMicrotask(()=>{if(!w.closed)list.dispatchEvent(new w.Event('scroll'));});}}}
 });
 list.getBoundingClientRect=()=>({top:100,bottom:400,height:300});
 const original=w.HTMLElement.prototype.getBoundingClientRect;
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(this.classList.contains('gearly-message')){let y=114-top;for(const node of list.children){if(node===this)break;y+=height(node);}return {top:y,bottom:y+height(this),height:height(this)};}return original.call(this);};
 w.Gearly.open();
 return {w,dom,list,writes,ask:text=>w.Gearly.ask(text),latest:()=>[...list.querySelectorAll('.gearly-bot')].at(-1),jump:()=>w.document.querySelector('.gearly-latest'),scroll:value=>{list.scrollTop=value;list.dispatchEvent(new w.Event('scroll'));},moveSilently:value=>{top=Math.max(0,Math.min(value,list.scrollHeight-list.clientHeight));},close:()=>w.close()};
}
test('long replies open at their beginning instead of the bottom',async()=>{
 const page=await start();await page.ask('How do I join and are there dues?');assert.equal(page.latest().getBoundingClientRect().top,114);assert.ok(page.list.scrollTop<page.list.scrollHeight-page.list.clientHeight);assert.equal(page.jump().hidden,true);page.close();
});
test('reading earlier messages stays in place through loading and a new reply; latest button returns to its start',async()=>{
 let resolve;const page=await start({live:()=>new Promise(done=>resolve=done)});await page.ask('How do I join and are there dues?');page.scroll(0);const before=page.list.scrollTop;
 const pending=page.ask('events');for(let n=0;n<20&&!resolve;n++)await Promise.resolve();assert.ok(resolve);assert.equal(page.list.scrollTop,before);
 resolve({text:'A long new event answer '.repeat(30),cards:[]});await pending;assert.equal(page.list.scrollTop,before);assert.equal(page.jump().hidden,false);
 page.jump().click();assert.equal(page.latest().getBoundingClientRect().top,114);assert.equal(page.w.document.activeElement,page.latest());assert.equal(page.jump().hidden,true);page.close();
});
test('scrolling up during the typing reveal is never pulled down again',async()=>{
 const page=await start({motion:true});await page.ask('How do I join and are there dues?');const pending=page.ask('How do I join and are there dues?');
 for(let n=0;n<200&&!page.list.querySelector('.gearly-typing-label');n++)await wait(5);assert.ok(page.list.querySelector('.gearly-typing-label'));assert.ok(parseFloat(page.latest().style.minHeight)>0);
 page.scroll(0);const writes=page.writes.length;await pending;assert.equal(page.list.scrollTop,0);assert.equal(page.writes.length,writes);assert.equal(page.latest().style.minHeight,'');assert.equal(page.jump().hidden,false);page.close();
});
test('typing reserves the reply height and does not scroll on each character',async()=>{
 const page=await start({motion:true});const pending=page.ask('How do I join and are there dues?');for(let n=0;n<200&&!page.list.querySelector('.gearly-typing-label');n++)await wait(5);
 const count=page.writes.length;assert.ok(parseFloat(page.latest().style.minHeight)>=720);await pending;assert.ok(page.writes.length-count<=1);assert.equal(page.latest().getBoundingClientRect().top,114);assert.equal(page.jump().hidden,true);page.close();
});
test('duplicate programmatic scroll events do not disable following the next reply',async()=>{
 const page=await start();await page.ask('How do I join and are there dues?');page.list.dispatchEvent(new page.w.Event('scroll'));page.list.dispatchEvent(new page.w.Event('scroll'));await page.ask('How do I join and are there dues?');assert.equal(page.latest().getBoundingClientRect().top,114);page.close();
});
test('returning to the bottom resumes following, and clear removes the old latest target',async()=>{
 const page=await start();await page.ask('How do I join and are there dues?');page.scroll(0);page.scroll(page.list.scrollHeight);await page.ask('How do I join and are there dues?');assert.equal(page.latest().getBoundingClientRect().top,114);
 const old=page.latest();page.w.document.querySelector('[aria-label="Clear chat"]').click();assert.equal(old.isConnected,false);assert.equal(page.jump().hidden,true);assert.equal(page.list.querySelectorAll('.gearly-message').length,1);assert.ok(page.latest().classList.contains('gearly-welcome'));page.close();
});
test('closing and reopening preserves an earlier reading position; the composer remains outside the scroll feed',async()=>{
 const page=await start();await page.ask('How do I join and are there dues?');page.scroll(0);page.w.Gearly.close();page.w.Gearly.open();assert.equal(page.list.scrollTop,0);
 assert.equal(page.list.getAttribute('tabindex'),'0');assert.equal(page.w.document.querySelector('.gearly-feed').contains(page.w.document.querySelector('.gearly-form')),false);assert.equal(page.w.document.querySelector('.gearly-feed').contains(page.jump()),true);page.close();
});
test('restored conversation opens at its latest answer without altering saved conversation text',async()=>{
 const first=await start();await first.ask('How do I join and are there dues?');const saved=first.w.sessionStorage.getItem('gearly_state_v1');first.close();const replay=await start({history:saved});assert.equal(replay.latest().getBoundingClientRect().top,114);assert.match(replay.latest().textContent,/are there dues/);replay.close();
});
test('upward scroll intent wins even when the native scroll event has not fired yet',async()=>{
 let resolve;const page=await start({live:()=>new Promise(done=>resolve=done)});await page.ask('How do I join and are there dues?');const pending=page.ask('events');for(let n=0;n<20&&!resolve;n++)await Promise.resolve();page.list.dispatchEvent(new page.w.WheelEvent('wheel',{deltaY:-100}));const before=page.list.scrollTop;resolve({text:'A long incoming answer '.repeat(30),cards:[]});await pending;assert.equal(page.list.scrollTop,before);page.close();
});
test('a native scroll whose event is still queued is preserved before an asynchronous reply',async()=>{
 let resolve;const page=await start({live:()=>new Promise(done=>resolve=done)});await page.ask('How do I join and are there dues?');const pending=page.ask('events');for(let n=0;n<20&&!resolve;n++)await Promise.resolve();page.moveSilently(0);resolve({text:'An incoming answer '.repeat(40),cards:[]});await pending;assert.equal(page.list.scrollTop,0);assert.equal(page.jump().hidden,false);page.close();
});
test('typing completion respects native scroll movement before its scroll event fires',async()=>{
 const page=await start({motion:true});await page.ask('How do I join and are there dues?');const pending=page.ask('How do I join and are there dues?');for(let n=0;n<200&&!page.list.querySelector('.gearly-typing-label');n++)await wait(5);page.moveSilently(0);await pending;assert.equal(page.list.scrollTop,0);assert.equal(page.jump().hidden,false);page.close();
});
