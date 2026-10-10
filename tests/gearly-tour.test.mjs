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
 Array.from(w.document.querySelectorAll('.gearly-tour-offer button')).find(b=>b.textContent==='Not now').click();api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);assert.equal(w.localStorage.getItem('asme-gearly-tour-1'),'dismissed');
});
test('denied storage uses session memory and replay is available',()=>{
 const {w,api}=setup(true);api.offer();w.document.querySelectorAll('.gearly-tour-offer button')[1].click();api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);api.start();assert.ok(w.document.querySelector('[role=dialog]'));api.close();
});
test('spotlight skips absent targets, traps keyboard, and cleans up focus and listeners',()=>{
 const {w,api}=setup();const launch=w.document.querySelector('#launch');launch.focus();api.start();
 assert.equal(w.document.querySelector('.gearly-tour-count').textContent,'Step 1 of 2');assert.equal(w.document.querySelector('.gearly-tour-ring').style.width,'190px');
 let buttons=w.document.querySelectorAll('.gearly-tour-tip button');buttons[buttons.length-1].focus();w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(w.document.activeElement.textContent,'Skip');
 Array.from(buttons).find(b=>b.textContent==='Next').click();assert.equal(w.document.querySelector('#gearly-tour-title').textContent,'Events');
 w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.querySelector('.gearly-tour'),null);assert.equal(w.document.activeElement,launch);
 w.dispatchEvent(new w.Event('resize'));assert.equal(w.document.querySelector('.gearly-tour'),null);
});
test('mobile tooltip positioning is bounded above and below',()=>{
 const {api}=setup();const p=api.position({left:290,top:560,bottom:610},340,220,{width:320,height:640});assert.equal(p.width,296);assert.ok(p.left>=12);assert.ok(p.left+p.width<=308);assert.ok(p.top>=12);assert.ok(p.top+220<=628);
});
test('completion is versioned and resizing moves the spotlight',()=>{
 const {w,api}=setup();api.start();const header=w.document.querySelector('#header');header.getBoundingClientRect=()=>({left:80,top:120,bottom:160,right:260,width:180,height:40});w.dispatchEvent(new w.Event('resize'));assert.equal(w.document.querySelector('.gearly-tour-ring').style.left,'75px');
 Array.from(w.document.querySelectorAll('.gearly-tour-tip button')).find(b=>b.textContent==='Next').click();Array.from(w.document.querySelectorAll('.gearly-tour-tip button')).find(b=>b.textContent==='Done').click();assert.equal(w.localStorage.getItem('asme-gearly-tour-1'),'completed');api.offer();assert.equal(w.document.querySelector('.gearly-tour-offer'),null);
 api.configure({data:{tour:{version:2,steps:[]}}});api.offer();assert.ok(w.document.querySelector('.gearly-tour-offer'));
});
test('modal tour blocks background actions and restores original inert attributes',()=>{
 const {w,api}=setup();const launch=w.document.querySelector('#launch'),header=w.document.querySelector('#header');header.setAttribute('inert','original');let clicked=0;launch.addEventListener('click',()=>clicked++);api.start();
 assert.ok(launch.hasAttribute('inert'));launch.click();assert.equal(clicked,0);launch.focus();assert.ok(w.document.querySelector('.gearly-tour-tip').contains(w.document.activeElement));
 api.close();assert.equal(launch.hasAttribute('inert'),false);assert.equal(header.getAttribute('inert'),'original');launch.click();assert.equal(clicked,1);
});
