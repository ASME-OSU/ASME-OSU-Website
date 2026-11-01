import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../Join Page.html',import.meta.url),'utf8');
const source=await readFile(new URL('../celebration.js',import.meta.url),'utf8');
function setup(reduced=false){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.innerWidth=1440;w.innerHeight=900;w.matchMedia=()=>({matches:reduced});
 const timers=[];let frame;w.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length};w.clearTimeout=()=>{};w.requestAnimationFrame=fn=>{frame=fn;return 1};w.cancelAnimationFrame=()=>{};
 const drawings=[];const contexts=new Map();
 w.HTMLCanvasElement.prototype.getContext=function(){if(!contexts.has(this)){
  const burst=this.id==='asme-celebration-burst';
  contexts.set(this,new Proxy({getImageData:()=>({data:new Uint8ClampedArray(w.innerWidth*w.innerHeight*4)}),createRadialGradient:()=>({addColorStop(){}}),translate(x,y){if(burst)drawings.push({x,y})}},{get:(o,k)=>k in o?o[k]:()=>{}}));
 }return contexts.get(this)};
 w.eval(source);w.document.querySelector('#asme-celebration-again').click();
 return{dom,w,timers,drawings,tick:t=>frame?.(t)};
}
test('side cannons cover both edges and are cleared before the O–H formation',()=>{
 const t=setup();t.timers.find(x=>x.delay===1200).fn();t.tick(16);
 assert.ok(t.drawings.length>150);
 const xs=t.drawings.map(p=>p.x);assert.ok(Math.max(...xs)-Math.min(...xs)>t.w.innerWidth*.9);
 t.drawings.length=0;t.timers.find(x=>x.delay===2850).fn();t.tick(32);
 assert.equal(t.drawings.length,0,'No confetti is drawn over the next scene');t.dom.window.close();
});
test('reduced motion goes directly to the card without confetti',()=>{
 const t=setup(true);assert.ok(t.w.document.querySelector('#asme-celebration-final').classList.contains('show'));
 assert.equal(t.drawings.length,0);assert.ok(!t.timers.some(x=>x.delay===1200));t.dom.window.close();
});

test('only the final backdrop closes the celebration; sharing dismissal stays separate',()=>{
 const t=setup();const d=t.w.document;d.querySelector('#asme-celebration-skipBtn').click();
 assert.equal(d.querySelector('.asme-c-topbar .wordmark'),null);
 d.querySelector('.finalinner').click();assert.equal(d.querySelector('#asme-celebration-experience').getAttribute('aria-hidden'),'false');
 d.querySelector('#asme-celebration-linkedInHelper').click();assert.ok(d.querySelector('#asme-celebration-linkedinBackdrop').classList.contains('open'));
 d.querySelector('#asme-celebration-final').click();assert.equal(d.querySelector('#asme-celebration-experience').getAttribute('aria-hidden'),'false');
 d.querySelector('#asme-celebration-linkedinBackdrop').click();assert.ok(!d.querySelector('#asme-celebration-linkedinBackdrop').classList.contains('open'));
 assert.equal(d.querySelector('#asme-celebration-experience').getAttribute('aria-hidden'),'false');
 d.querySelector('#asme-celebration-final').click();assert.equal(d.querySelector('#asme-celebration-experience').getAttribute('aria-hidden'),'true');t.dom.window.close();
});
