import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../assets/gearly/gearly-tour.js',import.meta.url),'utf8');
function setup(denied=false){
 const dom=new JSDOM('<button id="launch">Tour</button><header id="header">Navigation</header><section id="events">Events</section>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});
 const {window:w}=dom;w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:20,top:60,right:200,bottom:100,width:180,height:40};};
 if(denied)Object.defineProperty(w,'localStorage',{get(){throw Error('denied');}});
 w.eval(code);w.GearlyTour.configure({data:{tour:{version:1,steps:[{selector:'#header',title:'Navigation',text:'Find sections'},{selector:'#missing',title:'Missing',text:'Skip me'},{selector:'#events',title:'Events',text:'Upcoming meetings'}]}}});
 return {dom,w,api:w.GearlyTour};
}
test('first visit invitation is optional and persisted optout works',()=>{
 const {w,api}=setup();api.offer();assert.ok(w.document.querySelector('.gearly-tour-offer'));assert.equal(w.document.querySelector('[role=dialog]'),null);
 Array.from(w.document.querySelectorAll('.gearly-tour-offer button')).find(b=>b.getAttribute('aria-label')==='Not now').click();api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);assert.equal(w.localStorage.getItem('asme-gearly-tour-1'),'dismissed');
});
test('denied storage uses session memory and replay is available',()=>{
 const {w,api}=setup(true);api.offer();w.document.querySelectorAll('.gearly-tour-offer button')[1].click();api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);api.start();assert.ok(w.document.querySelector('[role=dialog]'));api.close();
});
test('spotlight skips absent targets, traps keyboard, and cleans up focus and listeners',()=>{
 const {w,api}=setup();const launch=w.document.querySelector('#launch');launch.focus();api.start();
 assert.equal(w.document.querySelector('.gearly-tour-count').textContent,'Step 1 of 2');assert.equal(w.document.querySelector('.gearly-tour-ring').style.width,'190px');
 let buttons=w.document.querySelectorAll('.gearly-tour-tip button');buttons[buttons.length-1].focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(w.document.activeElement.getAttribute('aria-label'),'Skip tour');
 Array.from(buttons).find(b=>b.getAttribute('aria-label')==='Next').click();assert.equal(w.document.querySelector('#gearly-tour-title').textContent,'Events');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.querySelector('.gearly-tour'),null);assert.equal(w.document.activeElement,launch);
 w.dispatchEvent(new w.Event('resize'));assert.equal(w.document.querySelector('.gearly-tour'),null);
});
test('mobile tooltip positioning is bounded above and below',()=>{
 const {api}=setup();const p=api.position({left:290,top:560,bottom:610},340,220,{width:320,height:640});assert.equal(p.width,296);assert.ok(p.left>=12);assert.ok(p.left+p.width<=308);assert.ok(p.top>=12);assert.ok(p.top+220<=628);
});
test('completion is versioned and resizing moves the spotlight',()=>{
 const {w,api}=setup();api.start();const header=w.document.querySelector('#header');header.getBoundingClientRect=()=>({left:80,top:120,bottom:160,right:260,width:180,height:40});w.dispatchEvent(new w.Event('resize'));assert.equal(w.document.querySelector('.gearly-tour-ring').style.left,'75px');
 Array.from(w.document.querySelectorAll('.gearly-tour-tip button')).find(b=>b.getAttribute('aria-label')==='Next').click();Array.from(w.document.querySelectorAll('.gearly-tour-tip button')).find(b=>b.getAttribute('aria-label')==='Done').click();assert.equal(w.localStorage.getItem('asme-gearly-tour-1'),'completed');api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);
 api.configure({data:{tour:{version:2,steps:[]}}});api.offer();assert.ok(w.document.querySelector('.gearly-tour-offer'));
});
test('modal tour blocks background actions and restores original inert attributes',()=>{
 const {w,api}=setup();const launch=w.document.querySelector('#launch'),header=w.document.querySelector('#header');header.setAttribute('inert','original');let clicked=0;launch.addEventListener('click',()=>clicked++);api.start();
 assert.ok(launch.hasAttribute('inert'));launch.click();assert.equal(clicked,0);launch.focus();assert.ok(w.document.querySelector('.gearly-tour-tip').contains(w.document.activeElement));
 api.close();assert.equal(launch.hasAttribute('inert'),false);assert.equal(header.getAttribute('inert'),'original');launch.click();assert.equal(clicked,1);
});
async function crossPage(url,storage,data){
 const {default:vm}=await import('node:vm');const dom=new JSDOM('<header id="header">Header</header><section id="events">Events</section>',{url});const w=dom.window;w.HTMLElement.prototype.getBoundingClientRect=()=>({left:20,top:60,right:200,bottom:100,width:180,height:40});
 const moves=[];const loc=new URL(url);loc.assign=value=>moves.push(value);const root={document:w.document,location:loc,innerWidth:320,innerHeight:640,getComputedStyle:w.getComputedStyle.bind(w),addEventListener:w.addEventListener.bind(w),removeEventListener:w.removeEventListener.bind(w),localStorage:w.localStorage,sessionStorage:storage};
 vm.runInNewContext(code,{window:root,URL,setTimeout,clearTimeout});root.GearlyTour.configure({data,assetBase:'https://asme-osu.github.io/ASME-OSU-Website/assets/gearly/'});return {w,api:root.GearlyTour,moves};
}
const routeData={pages:[{url:'https://org.osu.edu/asme/',sourceFile:'Home Page.html'},{url:'https://org.osu.edu/asme/calendar/',sourceFile:'Calendar Page.html'}],tour:{version:3,steps:[{page:'https://org.osu.edu/asme/',selector:'#header',title:'Home',text:'Navigation',sprite:'gearly-smiling-wave.png'},{page:'https://org.osu.edu/asme/calendar/',selector:'#events',title:'Events',text:'Upcoming',sprite:'gearly-calendar-presenting.png'}]}};
function session(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),values};}
test('explicit Next and Back navigate approved routes and resume exact pending step',async()=>{
 const storage=session();const home=await crossPage('https://org.osu.edu/asme/',storage,routeData);home.api.offer();assert.equal(home.moves.length,0);home.api.start();assert.match(home.w.document.querySelector('.gearly-tour-sprite').src,/gearly-smiling-wave.png$/);
 home.w.document.querySelector('[aria-label="Next"]').click();assert.deepEqual(home.moves,['https://org.osu.edu/asme/calendar/']);assert.ok(storage.getItem('asme-gearly-tour-3-session'));
 const events=await crossPage('https://org.osu.edu/asme/calendar/',storage,routeData);assert.equal(events.w.document.querySelector('#gearly-tour-title').textContent,'Events');assert.match(events.w.document.querySelector('.gearly-tour-sprite').src,/gearly-calendar-presenting.png$/);events.w.document.querySelector('[aria-label="Back"]').click();assert.deepEqual(events.moves,['https://org.osu.edu/asme/']);
 const again=await crossPage('https://org.osu.edu/asme/',storage,routeData);again.api.close();assert.equal(storage.getItem('asme-gearly-tour-3-session'),null);
});
test('expired or forged pending routes never resume and unsafe page steps are excluded',async()=>{
 const storage=session();storage.setItem('asme-gearly-tour-3-session',JSON.stringify({index:1,to:'https://evil.example/',expires:Date.now()+10000}));let page=await crossPage('https://org.osu.edu/asme/',storage,routeData);assert.equal(page.w.document.querySelector('.gearly-tour'),null);assert.equal(storage.getItem('asme-gearly-tour-3-session'),null);
 storage.setItem('asme-gearly-tour-3-session',JSON.stringify({index:0,to:'https://org.osu.edu/asme/',expires:1}));page=await crossPage('https://org.osu.edu/asme/',storage,routeData);assert.equal(page.w.document.querySelector('.gearly-tour'),null);
 const bad=structuredClone(routeData);bad.tour.steps.push({page:'https://evil.example/',selector:'#header',title:'Unsafe',text:'Bad'});page=await crossPage('https://org.osu.edu/asme/',session(),bad);page.api.start();assert.equal(page.w.document.querySelector('.gearly-tour-count').textContent,'Step 1 of 2');page.api.close();
});
test('preview routes use sourceFile query and denied session storage offers a useful link',async()=>{
 const storage=session();let page=await crossPage('http://127.0.0.1:4180/?page=Home%20Page.html',storage,routeData);page.api.start();page.w.document.querySelector('[aria-label="Next"]').click();assert.equal(new URL(page.moves[0]).searchParams.get('page'),'Calendar Page.html');
 const denied={getItem(){throw Error('denied');},setItem(){throw Error('denied');},removeItem(){throw Error('denied');}};page=await crossPage('https://org.osu.edu/asme/',denied,routeData);page.api.start();assert.equal(page.w.document.querySelector('a').href,'https://org.osu.edu/asme/calendar/');page.w.document.querySelector('[aria-label="Next"]').click();assert.equal(page.moves.length,0);assert.equal(page.w.document.querySelector('.gearly-tour'),null);
});
test('resumed tour returns focus to launcher added after configure',async()=>{
 const storage=session();storage.setItem('asme-gearly-tour-3-session',JSON.stringify({index:1,direction:1,to:'https://org.osu.edu/asme/calendar/',expires:Date.now()+10000}));const page=await crossPage('https://org.osu.edu/asme/calendar/',storage,routeData);assert.ok(page.w.document.querySelector('.gearly-tour'));
 const launcher=page.w.document.createElement('button');launcher.className='gearly-launcher';launcher.textContent='Open Gearly';page.w.document.body.appendChild(launcher);page.w.document.dispatchEvent(new page.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(page.w.document.activeElement,launcher);
});
test('same-page destination cue uses section title',async()=>{
 const data=structuredClone(routeData);data.pages[0].title='Home';data.tour.steps[1].page='https://org.osu.edu/asme/';const page=await crossPage('https://org.osu.edu/asme/',session(),data);page.api.start();assert.equal(page.w.document.querySelector('.gearly-tour-destination').textContent,'Next: Events');page.api.close();
});
