import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../Join Page.html',import.meta.url),'utf8');
const source=await readFile(new URL('../celebration.js',import.meta.url),'utf8');
function setup(reduced=false,configure=()=>{}){
 const dom=new JSDOM(html,{url:'http://127.0.0.1:8787/',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;w.innerWidth=1440;w.innerHeight=900;w.matchMedia=()=>({matches:reduced});
 const timers=[];let frame;w.setTimeout=(fn,delay)=>{timers.push({fn,delay});return timers.length};w.clearTimeout=()=>{};w.requestAnimationFrame=fn=>{frame=fn;return 1};w.cancelAnimationFrame=()=>{};
 const drawings=[];const contexts=new Map();
 w.HTMLCanvasElement.prototype.getContext=function(){if(!contexts.has(this)){
  const burst=this.id==='asme-celebration-burst';
  contexts.set(this,new Proxy({getImageData:()=>({data:new Uint8ClampedArray(w.innerWidth*w.innerHeight*4)}),createRadialGradient:()=>({addColorStop(){}}),translate(x,y){if(burst)drawings.push({x,y})}},{get:(o,k)=>k in o?o[k]:()=>{}}));
 }return contexts.get(this)};
 configure(w);w.eval(source);w.document.querySelector('#asme-celebration-again').click();
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

test('each caption option updates the preview and copies the selected text without em dashes',async()=>{
 const t=setup();const d=t.w.document;d.querySelector('#asme-celebration-skipBtn').click();d.querySelector('#asme-celebration-linkedInHelper').click();let copied='';d.execCommand=()=>{copied=d.querySelector('textarea').value;return true};const variants=new Set();
 for(const option of d.querySelectorAll('#asme-celebration-captionStyle option')){
  const select=d.querySelector('#asme-celebration-captionStyle');select.value=option.value;select.dispatchEvent(new t.w.Event('change'));const preview=d.querySelector('#asme-celebration-captionPreview').textContent;variants.add(preview);assert.ok(preview.length>100);assert.ok(!preview.includes('—'));d.querySelector('#asme-celebration-copyLinkedIn').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(copied,preview);
 }assert.equal(variants.size,3);t.dom.window.close();
});

test('sharing reveals one main action at a time and can return to caption editing',async()=>{
 const t=setup();const w=t.w,d=w.document;d.querySelector('#asme-celebration-skipBtn').click();d.querySelector('#asme-celebration-linkedInHelper').click();
 const actions=()=>[...d.querySelectorAll('.linkedin-steps button')].filter(b=>!b.hidden).map(b=>b.id);
 assert.deepEqual(actions(),['asme-celebration-copyLinkedIn']);d.execCommand=()=>true;
 d.querySelector('#asme-celebration-copyLinkedIn').click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(actions(),['asme-celebration-downloadFromPanel']);
 w.HTMLImageElement.prototype.decode=async()=>{};
 const gradients=[];w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:100}),createLinearGradient:(...args)=>{gradients.push(args);return{addColorStop(){}}},createRadialGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});
 w.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,AA==';w.HTMLCanvasElement.prototype.toBlob=fn=>fn(new w.Blob(['test']));w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 d.querySelector('#asme-celebration-downloadFromPanel').click();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(actions(),['asme-celebration-openLinkedIn']);assert.deepEqual(gradients,[[0,0,1600,1000]],'PNG has only its background gradient, without a diagonal shimmer');
 d.querySelector('#asme-celebration-editCaption').click();assert.deepEqual(actions(),['asme-celebration-copyLinkedIn']);assert.equal(d.querySelector('#asme-celebration-captionPreview').hidden,false);t.dom.window.close();
});

test('Script Ohio finishes fading before the final screen appears',()=>{
 const t=setup();const d=t.w.document;t.timers.find(x=>x.delay===2850).fn();t.timers.find(x=>x.delay===4662).fn();t.timers.find(x=>x.delay===8062).fn();
 assert.equal(d.querySelector('#asme-celebration-final').classList.contains('show'),false);
 assert.equal(d.querySelector('#asme-celebration-formation').classList.contains('script-exit'),true);
 t.timers.find(x=>x.delay===340).fn();
 assert.equal(d.querySelector('#asme-celebration-formation').style.display,'none');
 assert.equal(d.querySelector('#asme-celebration-final').classList.contains('show'),true);
 assert.equal(d.querySelectorAll('.tiny-note,.helper-note').length,0);t.dom.window.close();
});


test('Carmen Ohio is opt-in, resumes at the current scene, and cancels on mute, replay, skip and close',()=>{
 const oscillators=[];let clock=0;
 const t=setup(false,w=>{
  w.performance.now=()=>clock;
  const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}});
  w.AudioContext=class{
   constructor(){this.currentTime=0;this.state='running';this.destination={}}
   resume(){this.state='running'} suspend(){this.state='suspended'}
   createDynamicsCompressor(){return{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param(),connect(){}}}
   createGain(){return{gain:param(),connect(){}}}
   createOscillator(){const o={frequency:{setValueAtTime(value){o.pitch=value}},connect(){},disconnect(){},start(time){o.startTime=time},stop(time){if(time===undefined)o.cancelled=true;else o.endTime=time}};oscillators.push(o);return o}
  };
 });
 const d=t.w.document,button=d.querySelector('#asme-celebration-soundBtn');
 assert.equal(oscillators.length,0,'Sound starts off');button.click();
 assert.ok(oscillators.length>32);assert.equal(button.getAttribute('aria-pressed'),'true');
 assert.ok(Math.abs(oscillators[0].pitch-311.127)<.01);assert.equal(oscillators[0].startTime,1.2);
 const lead=oscillators.filter(o=>o.type==='triangle');assert.deepEqual(lead.map(o=>Math.round(69+12*Math.log2(o.pitch/440))),[63,72,73,68,72,70,68,67,68]);assert.ok(oscillators.some(o=>o.pitch<150),'Independent bass/chord support is present');const duration=Math.max(...oscillators.map(o=>o.endTime));assert.ok(duration<9.1&&duration>8.9,'Slower phrase resolves over the final card');
 button.click();assert.ok(oscillators.every(o=>o.cancelled));
 clock=4000;const before=oscillators.length;button.click();const resumed=oscillators.slice(before);assert.ok(resumed.length<before);assert.equal(resumed[0].startTime,0,'Unmuting joins the current musical position');
 d.querySelector('#asme-celebration-again').click();assert.ok(resumed.every(o=>o.cancelled));
 d.querySelector('#asme-celebration-skipBtn').click();assert.ok(oscillators.every(o=>o.cancelled));
 d.querySelector('#asme-celebration-again').click();d.querySelector('#asme-celebration-close').click();assert.ok(oscillators.every(o=>o.cancelled));t.dom.window.close();
});
