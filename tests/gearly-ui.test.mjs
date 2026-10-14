import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../assets/gearly/gearly.js',import.meta.url),'utf8');
const config=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json','utf8'));
const raw={meta:{...config.meta,contactEmail:'asme@example.org'},featuredTopics:config.featuredTopics,pages:config.pages,intents:[{id:'join',examples:['join'],keywords:{join:3},response:{text:'<img src=x onerror=alert(1)>',cards:[{title:'Bad',url:'javascript:alert(1)'},{title:'Join',url:'/asme/join/'}],chips:['Join']}}]};
async function start(data=raw,setup){const dom=new JSDOM('<body><main>Site</main></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});dom.window.AbortSignal=AbortSignal;dom.window.fetch=async url=>({ok:true,json:async()=>url.includes('sprites.json')?{}:data});dom.window.matchMedia=()=>({matches:true});if(setup)setup(dom.window);dom.window.eval(source);await new Promise(r=>setTimeout(r,20));return dom;}
test('dialog focus, Escape, safe response text and links',async()=>{const dom=await start();const w=dom.window;assert.ok(w.Gearly);w.Gearly.open();assert.equal(w.document.activeElement.className,'gearly-input');await w.Gearly.ask('join');assert.equal(w.document.querySelectorAll('.gearly-message img').length,0);assert.ok(w.document.querySelector('.gearly-message').textContent);assert.equal(w.document.querySelectorAll('a[href^="javascript:"]').length,0);w.document.querySelector('.gearly-panel').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(w.document.querySelector('.gearly-panel').hidden,true);assert.equal(w.document.activeElement.className,'gearly-launcher');assert.equal(w.document.querySelector('.gearly-messages').getAttribute('aria-live'),'polite');dom.window.close();});
test('malformed data never renders launcher',async()=>{const dom=await start({});assert.equal(dom.window.document.querySelector('.gearly-launcher'),null);dom.window.close();});
test('closed guide exposes only a compact sprite launcher with tour inside the panel',async()=>{const dom=await start({...raw,meta:{...raw.meta,sprites:{idle:'sprites/idle.webp'}}});const w=dom.window;const launcher=w.document.querySelector('.gearly-launcher');assert.equal(launcher.querySelector('.gearly-launcher-greeting').textContent,'Hi! Need help?');assert.equal(launcher.querySelector('.gearly-launcher-greeting').getAttribute('aria-hidden'),'true');assert.ok(launcher.querySelector('img'));assert.equal(w.document.querySelector('.gearly-root > .gearly-tour-replay'),null);assert.ok(w.document.querySelector('.gearly-header .gearly-tour-replay'));assert.equal(launcher.getAttribute('aria-label'),'Open Gearly, ASME website guide');dom.window.close();});
test('session history stays capped at fifty messages',async()=>{const dom=await start();for(let i=0;i<30;i++)await dom.window.Gearly.ask('join');assert.ok(JSON.parse(dom.window.sessionStorage.getItem('gearly_state_v1')).history.length<=50);dom.window.close();});
test('live event requests receive slots and configure local repository base',async()=>{const dom=new JSDOM('<body></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});const w=dom.window;w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});let slots,config;w.GearlyLive={configure:x=>config=x,load:async(k,s)=>{slots=s;return {text:'Filtered events',cards:[]};}};const seed={...raw,intents:[{id:'events',examples:['events next week'],keywords:{events:3},liveSource:'events',response:{text:'Events'}}]};w.fetch=async()=>({ok:true,json:async()=>seed});w.eval(source);await new Promise(r=>setTimeout(r,20));await w.Gearly.ask('events next week');assert.equal(slots.dateRange.label,'next-week');assert.ok(config.baseURL);dom.window.close();});
test('optimized sprites update launcher and avatar, safe restored history is rendered',async()=>{const dom=new JSDOM('<body></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});const w=dom.window;w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});w.sessionStorage.setItem('gearly_state_v1',JSON.stringify({history:[{who:'user',text:'Previous question'}]}));const seed={...raw,meta:{...raw.meta,sprites:{idle:'sprites/idle.webp',happy:'sprites/happy.webp',thinking:'sprites/thinking.webp'}}};w.fetch=async()=>({ok:true,json:async()=>seed});w.eval(source);await new Promise(r=>setTimeout(r,20));assert.ok(w.document.querySelector('.gearly-messages').textContent.includes('Previous question'));assert.ok(w.document.querySelector('.gearly-launcher img').src.endsWith('idle.webp'));await w.Gearly.ask('join');assert.ok(w.document.querySelector('.gearly-avatar img').src.endsWith('happy.webp'));assert.ok(w.document.querySelector('.gearly-launcher img').src.endsWith('idle.webp'));dom.window.close();});

test('feature flag disables the assistant without rendering controls',async()=>{const dom=await start({...raw,meta:{...raw.meta,enabled:false}});assert.equal(dom.window.Gearly,undefined);assert.equal(dom.window.document.querySelector('.gearly-root'),null);dom.window.close();});
test('page suggestions and clear chat reset conversation and stored context',async()=>{const seed={...raw,pages:[{id:'join',title:'Join',url:'/asme/',suggestions:['Newsletter','GroupMe']}]};const dom=await start(seed);const w=dom.window;assert.equal(w.document.querySelector('.gearly-chips').textContent,'NewsletterGroupMe');await w.Gearly.ask('join');w.document.querySelector('[aria-label="Clear chat"]').click();const state=JSON.parse(w.sessionStorage.getItem('gearly_state_v1'));assert.equal(state.lastIntent,null);assert.equal(state.history.length,1);assert.ok(w.document.querySelector('.gearly-welcome'));assert.equal(w.document.querySelectorAll('.gearly-message').length,1);assert.equal(w.document.querySelector('.gearly-chips').textContent,'NewsletterGroupMe');dom.window.close();});
test('tour is configured, offered after a quiet delay, and can be replayed',async()=>{const dom=new JSDOM('<body></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});const w=dom.window;w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});let offered=0,replayed=0,dismissed=0,configured,delayed;w.GearlyTour={configure:x=>configured=x,offer:()=>offered++,start:()=>replayed++,dismissOffer:()=>dismissed++};w.setTimeout=(cb,ms)=>{if(ms===4000)delayed=cb;return 0;};w.fetch=async()=>({ok:true,json:async()=>({...raw,tour:{version:1,steps:[]}})});w.eval(source);await new Promise(r=>setTimeout(r,20));assert.ok(configured.data.tour);assert.equal(offered,0);delayed();assert.equal(offered,1);w.document.querySelector('.gearly-tour-replay').click();assert.equal(replayed,1);assert.equal(w.document.querySelector('.gearly-panel').hidden,true);w.Gearly.open();assert.equal(dismissed,1);dom.window.close();});
test('clearing during a live request prevents stale answers reappearing',async()=>{const dom=new JSDOM('<body></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'});const w=dom.window;w.AbortSignal=AbortSignal;w.matchMedia=()=>({matches:true});let resolve;w.GearlyLive={configure:()=>{},load:()=>new Promise(r=>resolve=r)};w.fetch=async()=>({ok:true,json:async()=>({...raw,intents:[{id:'events',examples:['events'],response:{text:'Events'},liveSource:'events'}]})});w.eval(source);await new Promise(r=>setTimeout(r,20));const pending=w.Gearly.ask('events');w.document.querySelector('[aria-label="Clear chat"]').click();resolve({text:'Outdated pending answer',cards:[]});await pending;assert.ok(!w.document.querySelector('.gearly-messages').textContent.includes('Outdated'));assert.equal(JSON.parse(w.sessionStorage.getItem('gearly_state_v1')).lastIntent,null);dom.window.close();});


test('fresh welcome shortcuts, context, tour, and topic browsing work without sending a query',async()=>{
 const dom=await start({...raw,pages:[{id:'home',title:'Home',url:'https://org.osu.edu/asme/'}]});const w=dom.window;
 assert.match(w.document.querySelector('.gearly-context').textContent,/Helping with: Home/);
 assert.match(w.document.querySelector('.gearly-welcome').textContent,/Hi! I’m Gearly/);assert.equal(w.document.querySelector('.gearly-welcome-hero'),null);
 assert.equal(w.document.querySelectorAll('.gearly-shortcut').length,1);
 let toured=0;w.GearlyTour={start:()=>toured++};Array.from(w.document.querySelectorAll('.gearly-shortcut')).find(b=>b.textContent==='Take a tour').click();assert.equal(toured,1);assert.equal(w.document.querySelector('.gearly-panel').hidden,true);
 w.Gearly.open();Array.from(w.document.querySelectorAll('.gearly-text-button')).find(b=>b.textContent.includes('Browse')).click();assert.equal(w.document.querySelector('.gearly-welcome'),null);assert.match(w.document.querySelector('.gearly-chips').textContent,/Take a tour/);assert.equal(w.document.querySelectorAll('.gearly-user').length,0);dom.window.close();
});
test('thinking changes to typing and a complete accessible answer; reduced motion skips the reveal',async()=>{
 const seed={...raw,meta:{...raw.meta,sprites:{idle:'idle.webp',thinking:'think.webp',typing:'type.webp',happy:'happy.webp'}}};const dom=await start(seed);const w=dom.window;w.matchMedia=()=>({matches:false});
 const pending=w.Gearly.ask('join');assert.ok(w.document.querySelector('.gearly-activity'));assert.equal(w.document.querySelector('.gearly-avatar').dataset.state,'thinking');assert.equal(w.document.querySelector('.gearly-messages').getAttribute('aria-busy'),'true');
 await new Promise(r=>setTimeout(r,340));assert.equal(w.document.querySelector('.gearly-avatar').dataset.state,'typing');assert.ok(w.document.querySelector('.gearly-typing-label'));assert.equal(w.document.querySelector('.gearly-message:nth-last-child(2) a').hidden,true);
 await pending;assert.equal(w.document.querySelector('.gearly-typing-label'),null);assert.equal(w.document.querySelector('.gearly-activity'),null);assert.equal(w.document.querySelector('.gearly-message:nth-last-child(2) a').hidden,false);assert.equal(w.document.querySelector('.gearly-message:nth-last-child(2) p').hasAttribute('aria-hidden'),false);assert.equal(w.document.querySelector('.gearly-avatar').dataset.state,'happy');
 w.matchMedia=()=>({matches:true});const immediate=w.Gearly.ask('join');assert.equal(w.document.querySelector('.gearly-typing-label'),null);await immediate;dom.window.close();
});
test('clear during the animated reply cancels reveal and restores the welcome',async()=>{
 const dom=await start();const w=dom.window;w.matchMedia=()=>({matches:false});const pending=w.Gearly.ask('join');await new Promise(r=>setTimeout(r,340));w.document.querySelector('[aria-label="Clear chat"]').click();await pending;
 assert.ok(w.document.querySelector('.gearly-welcome'));assert.equal(w.document.querySelector('.gearly-typing-label'),null);assert.equal(w.document.querySelector('.gearly-activity'),null);assert.equal(w.document.querySelector('.gearly-messages').hasAttribute('aria-busy'),false);assert.ok(!w.document.querySelector('.gearly-messages').textContent.includes('<img'));assert.equal(w.document.querySelector('.gearly-avatar').dataset.state,'idle');dom.window.close();
});


test('explicit section requests open the section; information questions get interactive destination cards',async()=>{
 const action={type:'scrollTo',page:'https://org.osu.edu/asme/',selector:'#ranking',label:'Show ranking chart',title:'Public ranking chart'};const seed={...raw,intents:[{id:'leaderboard',examples:['pull up the ranking chart','who leads the leaderboard'],response:{text:'The public chart has current standings.'},actions:[action]}]};let opened;
 const dom=await start(seed,w=>{w.GearlyTour={configure:()=>{},showSection:a=>{opened=a;return true;},clearSection:()=>{}};});const w=dom.window;
 await w.Gearly.ask('pull up the ranking chart');assert.equal(opened.selector,'#ranking');assert.equal(w.document.querySelector('.gearly-panel').hidden,true);opened=null;
 await w.Gearly.ask('who leads the leaderboard');assert.equal(opened,null);const card=w.document.querySelector('.gearly-place-card');assert.ok(card.querySelector('img'));assert.equal(card.getAttribute('aria-label'),'Show ranking chart');card.click();assert.equal(opened.selector,'#ranking');dom.window.close();
});

test('mascot reactions work with keyboard and pointer, and pending sprites clear on reset',async()=>{
 const seed={...raw,meta:{...raw.meta,sprites:{idle:'sprites/gearly-neutral-head.webp',launcher:'sprites/gearly-happy-head.webp',thinking:'sprites/gearly-thinking-chin.webp'}}};
 let resolve;
 const dom=await start({...seed,intents:[{id:'events',examples:['events'],response:{text:'Current events'},liveSource:'events'}]},w=>{w.GearlyLive={configure:()=>{},load:()=>new Promise(r=>resolve=r)};});const w=dom.window;
 const join=Array.from(w.document.querySelectorAll('.gearly-shortcut')).find(el=>el.getAttribute('aria-label')==='Join ASME'),sprite=join.querySelector('img');
 assert.match(sprite.src,/double-thumbs-up/);join.focus();assert.match(sprite.src,/celebrating-jump/);
 w.Gearly.open();await new Promise(r=>setTimeout(r,10));assert.match(sprite.src,/double-thumbs-up/);
 join.dispatchEvent(new w.MouseEvent('mouseenter'));assert.match(sprite.src,/celebrating-jump/);join.dispatchEvent(new w.MouseEvent('mouseleave'));assert.match(sprite.src,/double-thumbs-up/);
 const pending=w.Gearly.ask('events');assert.match(w.document.querySelector('.gearly-activity-sprite').src,/thinking-chin/);
 w.document.querySelector('[aria-label="Clear chat"]').click();resolve({text:'Stale response'});await pending;
 assert.equal(w.document.querySelector('.gearly-activity-sprite'),null);assert.equal(w.document.querySelector('.gearly-reply-sprite'),null);dom.window.close();
});

test('conversation layout keeps suggestions in the feed and toggles launcher with focus',async()=>{
 const dom=await start();const w=dom.window,doc=w.document,launcher=doc.querySelector('.gearly-launcher');
 assert.equal(doc.querySelector('.gearly-chips').parentElement,doc.querySelector('.gearly-messages'));
 assert.equal(doc.querySelector('.gearly-welcome-hero'),null);assert.equal(doc.querySelectorAll('.gearly-shortcut').length,4);
 w.Gearly.open();assert.equal(launcher.hidden,true);assert.equal(doc.querySelector('.gearly-panel').hidden,false);assert.equal(doc.activeElement,doc.querySelector('.gearly-input'));
 w.Gearly.close();assert.equal(launcher.hidden,false);assert.equal(doc.activeElement,launcher);
 w.Gearly.open();await w.Gearly.ask('join');doc.querySelector('[aria-label="Clear chat"]').click();assert.ok(doc.querySelector('.gearly-welcome'));assert.equal(doc.querySelector('.gearly-chips').parentElement,doc.querySelector('.gearly-messages'));dom.window.close();
});

test('image cards stay inside typing links, cap images and remove failed assets',async()=>{
 const seed={...raw,intents:[{id:'gallery',examples:['gallery'],liveSource:'gallery',response:{text:'Photos'}}]};
 const dom=await start(seed,w=>{w.GearlyLive={load:async()=>({text:'Closest matches',cards:Array.from({length:5},(_,i)=>({title:'Photo '+i,url:'https://org.osu.edu/asme/pictures/',image:{src:'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/test.webp',alt:'Chapter photo',width:300,height:200}}))})};});
 await dom.window.Gearly.ask('gallery');const images=dom.window.document.querySelectorAll('.gearly-card img');assert.equal(images.length,3);assert.equal(images[0].loading,'lazy');assert.equal(images[0].getAttribute('width'),'300');images[0].dispatchEvent(new dom.window.Event('error'));assert.equal(dom.window.document.querySelectorAll('.gearly-card img').length,2);assert.ok(!dom.window.sessionStorage.getItem('gearly_state_v1').includes('test.webp'));dom.window.close();
});
test('pending member name and exact candidate choice never persist names',async()=>{
 const seed={...raw,intents:[{id:'my-points',examples:['my points'],liveSource:'member',requires:['memberName'],response:{text:'Name?'}}]};let requests=[];
 const dom=await start(seed,w=>{w.GearlyLive={load:async(kind,opts)=>{requests.push(opts);return opts.selection?{text:'Public name matched.',cards:[]}:{text:'Which one?',cards:[],candidates:[{label:'Zoë O’Neil · Autumn',name:'Zoë O’Neil',selection:'row:1'}]};}};});
 const w=dom.window;await w.Gearly.ask('my points');assert.match(w.document.querySelector('.gearly-messages').textContent,/What name is on the leaderboard/);await w.Gearly.ask('Zoë O’Neil');assert.equal(requests[0].name,'Zoë O’Neil');assert.ok(!w.sessionStorage.getItem('gearly_state_v1').includes('Zoë'));assert.ok(!w.sessionStorage.getItem('gearly_state_v1').includes('pendingSlot'));const chip=Array.from(w.document.querySelectorAll('.gearly-chip')).find(e=>e.textContent.includes('Zoë'));chip.click();await new Promise(r=>setTimeout(r,20));assert.equal(requests[1].selection,'row:1');assert.ok(!w.sessionStorage.getItem('gearly_state_v1').includes('Zoë'));dom.window.close();
});

test('first unknown answer hands off with encoded redacted question; None of these keeps original question',async()=>{
 const seed={...raw,intents:[{id:'join',examples:['join'],keywords:{join:3},response:{text:'Join'}},{id:'events',examples:['events'],keywords:{events:3},response:{text:'Events'}}]};const dom=await start(seed),w=dom.window;
 await w.Gearly.ask('weather? contact person@example.org or 614-555-1234');let card=Array.from(w.document.querySelectorAll('.gearly-card')).find(e=>e.textContent.includes('Ask the ASME team'));assert.ok(card);let body=new URL(card.href).searchParams.get('body');assert.match(body,/weather/);assert.ok(!body.includes('person@example.org'));assert.ok(!body.includes('614-555-1234'));assert.equal(new URL(card.href).searchParams.get('subject'),'Question for ASME (from the website guide)');
 await w.Gearly.ask('join and events');const none=Array.from(w.document.querySelectorAll('.gearly-chip')).find(e=>e.textContent==='None of these');assert.ok(none);none.click();await new Promise(r=>setTimeout(r,25));card=Array.from(w.document.querySelectorAll('.gearly-card')).filter(e=>e.textContent.includes('Ask the ASME team')).pop();assert.match(new URL(card.href).searchParams.get('body'),/join and events/);dom.window.close();
});

test('static answers never use extractive content, while dynamic sources update from page text',async()=>{
 let reads=0;
 const staticSeed={...raw,intents:[{id:'dues',static:true,source:{page:'https://org.osu.edu/asme/join/',section:'#fees'},examples:['dues'],response:{text:'Joining the chapter is free.'}}]};
 const stat=await start(staticSeed,w=>{w.GearlySite={loadPage:async url=>{if(!url.includes('/join/'))throw Error('Not a joining query');reads++;return '<p>Changed page fee.</p>';},extract:()=>({matched:true,text:'Changed page fee.'})};});await stat.window.Gearly.ask('dues');assert.match(Array.from(stat.window.document.querySelectorAll('.gearly-bot')).pop().textContent,/Joining the chapter is free/);assert.equal(reads,0);stat.window.close();
 const dynamicSeed={...raw,intents:[{id:'careers',source:{page:'https://org.osu.edu/asme/member-resources/',section:'#career'},examples:['career guide'],response:{text:'Generic fallback.'}}]};let page='The career guide now links to new resume tools.';
 const dyn=await start(dynamicSeed,w=>{w.GearlySite={loadPage:async()=>page,extract:(_,html)=>({matched:true,text:html})};});await dyn.window.Gearly.ask('career guide');assert.match(Array.from(dyn.window.document.querySelectorAll('.gearly-bot')).pop().textContent,/new resume tools/);page='The career guide has a new internship packet.';await dyn.window.Gearly.ask('career guide');assert.match(Array.from(dyn.window.document.querySelectorAll('.gearly-bot')).pop().textContent,/new internship packet/);assert.ok(dyn.window.document.querySelector('a.gearly-card').href.includes('/member-resources/'));dyn.window.close();
});

test('a superseded animated candidate answer does not clear the next member choices',async()=>{
 const seed={...raw,intents:[{id:'my-points',examples:['my points'],liveSource:'member',response:{text:'Name?'}}]};
 const dom=await start(seed,w=>{w.matchMedia=()=>({matches:false});w.GearlyLive={load:async(_,options)=>options.selection?{text:'Matched a public leaderboard name; I cannot verify who is asking.',cards:[]}:{text:'Which one?',cards:[],candidates:[{label:'Avery Example · Autumn',name:'Avery Example',selection:'first'}]}};});
 const w=dom.window;await w.Gearly.ask('points for Avery Example');Array.from(w.document.querySelectorAll('.gearly-chip')).find(b=>b.textContent==='Avery Example · Autumn').click();await new Promise(r=>setTimeout(r,100));await w.Gearly.ask('points for Avery Example');await new Promise(r=>setTimeout(r,450));assert.ok(Array.from(w.document.querySelectorAll('.gearly-chip')).some(b=>b.textContent==='Avery Example · Autumn'));dom.window.close();
});

test('configured reimbursement and travel handoff topics never quote a policy',async()=>{
 const seed={...raw,handoffTopics:['reimbursement','travel policy']};let extracted=0;
 const dom=await start(seed,w=>{w.GearlySite={extract:()=>{extracted++;return {matched:true,text:'Invented policy'};}};});await dom.window.Gearly.ask('what is the travel policy');const text=Array.from(dom.window.document.querySelectorAll('.gearly-bot')).pop().textContent;assert.match(text,/Ask the ASME team/);assert.ok(!text.includes('Invented policy'));assert.equal(extracted,0);dom.window.close();
});

test('public leaderboard card names are excluded from persisted followup state',async()=>{
 const seed={...raw,intents:[{id:'leaderboard',examples:['leaderboard'],liveSource:'leaderboard',response:{text:'Standings'}}]};
 const dom=await start(seed,w=>{w.GearlyLive={load:async()=>({text:'Current public standings.',cards:[{title:'#1 Avery Example',url:'https://org.osu.edu/asme/member-points-page/'}]})};});
 await dom.window.Gearly.ask('leaderboard');assert.ok(dom.window.document.querySelector('.gearly-card').textContent.includes('Avery'));const saved=dom.window.sessionStorage.getItem('gearly_state_v1');assert.ok(!saved.includes('Avery'));assert.deepEqual(JSON.parse(saved).lastResult,[]);dom.window.close();
});


test('exact live photo followups preserve the list and select the second identity',async()=>{
 const cards=[1,2,3].map(n=>({id:'photo-'+n,title:'Photo '+n,text:'Description '+n,url:'https://org.osu.edu/asme/pictures/'}));
 const dom=await start({...raw,intents:[{id:'gallery',examples:['photos'],liveSource:'gallery',response:{text:'Photos'}}]},w=>{w.GearlyLive={configure:()=>{},load:async()=>({text:'Photos',cards})};});
 const w=dom.window;await w.Gearly.ask('photos');await w.Gearly.ask('Tell me more');await w.Gearly.ask('Show me the second one');
 assert.match(Array.from(w.document.querySelectorAll('.gearly-bot')).at(-1).textContent,/Photo 2/);
 assert.equal(JSON.parse(w.sessionStorage.getItem('gearly_state_v1')).lastResult.length,3);
 assert.ok(!w.sessionStorage.getItem('gearly_state_v1').includes('photo-2'));
 w.document.querySelector('[aria-label="Clear chat"]').click();await w.Gearly.ask('Show me the second one');assert.match(Array.from(w.document.querySelectorAll('.gearly-bot')).at(-1).textContent,/first so I have a list/);dom.window.close();
});
test('check my points prompts for a name before requesting public data',async()=>{
 let calls=0;const dom=await start(config,w=>{w.GearlyLive={configure:()=>{},load:async()=>{calls++;return {text:'No public match',cards:[]};}};});
 await dom.window.Gearly.ask('Check my points.');assert.equal(calls,0);assert.match(dom.window.document.querySelector('.gearly-messages').textContent,/What name is on the leaderboard/);
 await dom.window.Gearly.ask('Matthew Allen');assert.equal(calls,1);assert.ok(!dom.window.sessionStorage.getItem('gearly_state_v1').includes('Matthew'));dom.window.close();
});

test('section retrieval never replaces a confident answer, but remains available for unknown section requests', async () => {
  let sectionCalls = 0;
  let opened;
  const action = {type:'scrollTo',page:'https://org.osu.edu/asme/aboutus/',selector:"[data-gearly='about-audiences']",title:'Use ASME in the way that helps you most.',label:'Show audiences'};
  const dom = await start(raw, window => {
    window.GearlySearch = {
      configure: () => {}, sections: async () => [], records: async () => [], find: async () => [],
      findSections: async () => {
        sectionCalls++;
        return [{...action,coverage:1,score:30,snippet:'Choose how to participate.'}];
      }
    };
    window.GearlyTour = {configure:() => {},showSection: value => {opened=value;return true;}};
  });
  await dom.window.Gearly.ask('join');
  assert.equal(sectionCalls,0);
  assert.equal(dom.window.document.querySelector('.gearly-place-card'),null);
  await dom.window.Gearly.ask('Use ASME in the way that helps you most.');
  assert.ok(sectionCalls > 0);
  const card = dom.window.document.querySelector('.gearly-place-card');
  assert.equal(card.getAttribute('aria-label'),'Show Use ASME in the way that helps you most.');
  card.click();
  assert.equal(opened.selector,action.selector);
  dom.window.close();
});
