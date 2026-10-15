import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const prompts=JSON.parse(read('tests/gearly/student-prompts.json'));
const instant=Date.parse('2026-10-15T16:00:00Z');
class FixedDate extends Date {constructor(...args){super(...(args.length?args:[instant]));} static now(){return instant;}}
const routes={'':'Home Page.html','join/':'Join Page.html','member-resources/':'Member Resources Page.html','leadership/':'Leadership Page.html','current-sponsors/':'Current Sponsors Page.html','sponsor-asme/':'Sponsor ASME Page.html','pictures/':'Gallery Page.html','aboutus/':'About Us Page.html','calendar/':'Calendar Page.html'};
const gviz=rows=>'google.visualization.Query.setResponse('+JSON.stringify({status:'ok',table:{rows:rows.map(r=>({c:r.map(v=>({v}))}))}})+');';
async function start(saved, overrides={}){
 const dom=new JSDOM('<body><main>Chapter website</main></body>',{url:'https://org.osu.edu/asme/',runScripts:'outside-only'}),w=dom.window;
 w.Date=FixedDate;w.AbortSignal=AbortSignal;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.matchMedia=()=>({matches:true});
 if(saved)w.sessionStorage.setItem('gearly_state_v1',saved);
 w.fetch=async value=>{
  const u=new URL(String(value));let body;
  if(u.pathname.endsWith('/gviz/tq')){
   body=gviz(u.searchParams.get('sheet')==='Point_Values_Public'?[['gbm','General Body Meeting',5,'','General Body Meeting'],['social','Social / Tabling',5,'','Social / Tabling'],['company','Company Info Session',7,'','Company Info Session']]:[['system_status','TESTING']]);
  }else if(u.pathname.includes('/wp-json/'))body=[];
  else if(u.pathname.includes('/data/')){
   body=JSON.parse(read('data/'+u.pathname.split('/').pop()));
   if(u.pathname.endsWith('/calendar-events.json')){if(overrides.calendar)body=structuredClone(overrides.calendar);body.checkedAt=new Date(instant).toISOString();}
  }else if(/gearly-(data|site|index|officers)\.json$/.test(u.pathname))body=JSON.parse(read('assets/gearly/'+u.pathname.split('/').pop()));
  else if(u.pathname.endsWith('/sprites.json'))body={};
  else if(u.origin==='https://org.osu.edu' && u.pathname.startsWith('/asme/'))body=read(routes[u.pathname.slice(6)] || 'Home Page.html');
  else throw Error('Unexpected public source: '+u.href);
  const text=typeof body==='string'?body:JSON.stringify(body);
  return {ok:true,headers:{get:()=>null},text:async()=>text,json:async()=>JSON.parse(text)};
 };
 for(const file of ['gearly-weighting.js','gearly-search.js','gearly-content.js','gearly-site.js','gearly-student.js','gearly-live.js','gearly.js'])w.eval(read('assets/gearly/'+file));
 for(let i=0;i<100 && !w.Gearly;i++)await new Promise(r=>setTimeout(r,5));
 assert.ok(w.Gearly,'guide booted');return dom;
}
const checks={
 1:a=>{assert.match(a.text,/aerospace/i);assert.ok(a.urls.some(u=>u.includes('/join/')));},
 2:a=>{assert.match(a.text,/newsletter.*free/i);assert.match(a.text,/national membership is separate/i);},
 3:a=>assert.match(a.cards[0].title,/MATLAB/),
 4:a=>{assert.match(a.text,/RSVP.*does not specify/i);assert.match(a.text,/Food.*does not specify/i);},
 5:a=>assert.match(a.cards[0].title,/MATLAB/),
 6:a=>{assert.ok(a.urls.some(u=>u.includes('ASME-Career-Packet')));assert.ok(a.urls.some(u=>u.includes('handshake')));},
 7:a=>{assert.match(a.text,/search your name/i);assert.match(a.text,/5 points/);},
 8:a=>{assert.match(a.text,/missing.*ASME team/i);assert.ok(a.urls.some(u=>u.startsWith('mailto:')));},
 9:a=>assert.match(a.text,/Matthew Allen.*2026–2027 President/),
 10:a=>assert.ok(a.urls.some(u=>u.includes('groupme.com/join_group'))),
 11:a=>{assert.match(a.text,/does not guarantee/i);assert.match(a.text,/No upcoming events match|don't see.*event|can't confirm/i);},
 12:a=>assert.ok(a.urls.some(u=>u.includes('groupme.com/join_group'))),
 13:a=>{assert.ok(a.urls.some(u=>u.includes('ASME-Career-Packet')));assert.ok(!a.cards.some(c=>/Pratt.*Event/.test(c.title)));},
 14:a=>assert.ok(a.urls.some(u=>u.includes('groupme.com/join_group'))),
 15:a=>{assert.match(a.text,/first.year|welcome/i);assert.match(a.text,/RSVP|registration/);},
 16:a=>assert.match(a.text,/do not see a published minimum GPA/i),
 17:a=>assert.ok(a.urls.some(u=>u.includes('calendar.google.com') && u.includes('cid='))),
 18:a=>assert.match(a.text,/don't see a chapter event listed/i),
 19:a=>{assert.match(a.text,/Bar Social/);assert.match(a.text,/Location.*does not specify/i);assert.match(a.text,/Age eligibility.*does not specify/i);},
 20:a=>{assert.match(a.text,/MATLAB/);assert.match(a.text,/Laptop.*does not specify/i);assert.match(a.text,/Prior knowledge.*does not specify/i);},
 21:a=>{assert.match(a.text,/volunteer/i);assert.match(a.text,/applications|committee/i);},
 22:a=>assert.ok(a.urls.some(u=>u.includes('asme.org/get-involved/student'))),
 23:a=>{assert.ok(a.urls.some(u=>u.includes('forms.cloud.microsoft')));assert.match(a.text,/participating sponsors and recruiting partners/i);},
 24:a=>assert.ok(a.urls.some(u=>u.includes('ASME-Career-Packet') || u.includes('ecs.osu.edu'))),
 25:a=>{assert.match(a.text,/Scott Laboratory.*N147/);assert.match(a.text,/do not see office hours published/i);},
 26:a=>assert.ok(a.urls.some(u=>u==='https://org.osu.edu/asme/pictures/')),
 27:a=>assert.match(a.text,/Bridge Building Competition/),
 28:a=>assert.match(a.text,/do not see a published requirement/i),
 29:a=>{assert.match(a.text,/newsletter.*problem|newsletter signup/i);assert.ok(a.urls.some(u=>u==='mailto:asme@osu.edu'));},
 30:a=>assert.match(a.text,/do not verify SAE|cannot make a reliable comparison/i)
};
const answers=[];
test('all 30 original student prompts get a grounded answer or specific honest fallback',async t=>{
 const dom=await start();
 try{
  for(const prompt of prompts){
   if(prompt.number===15)dom.window.document.querySelector('[aria-label="Clear chat"]').click();
   await dom.window.Gearly.ask(prompt.question);
   const reply=Array.from(dom.window.document.querySelectorAll('.gearly-bot')).at(-1);
   const cards=Array.from(reply.querySelectorAll('a.gearly-card')).map(a=>({title:a.querySelector('strong').textContent,url:a.href,text:a.querySelector('span')?.textContent || ''}));
   const answer={...prompt,text:reply.textContent,cards,urls:cards.map(c=>c.url)};answers.push(answer);
   await t.test('prompt '+prompt.number,()=>{assert.doesNotMatch(answer.text,/Loading leaderboard|Testing Semester/);checks[prompt.number](answer);});
  }
 }finally{dom.window.close();if(process.env.GEARLY_RECORD_ACCEPTANCE==='1')fs.writeFileSync('docs/gearly-student-acceptance.json',JSON.stringify({fixedTime:'2026-10-15T16:00:00Z',calendarFixture:'repository calendar with fresh checkedAt; source events unchanged',answers},null,2)+'\n');}
});
test('public answer cards survive same-site reload without persisting images or public member names',async()=>{
 const first=await start();let saved;
 try{await first.window.Gearly.ask('How do I submit my resume to the ASME resume book?');await first.window.Gearly.ask('leaderboard');saved=first.window.sessionStorage.getItem('gearly_state_v1');assert.ok(saved.includes('forms.cloud.microsoft'));}finally{first.window.close();}
 const restored=await start(saved);
 try{assert.ok(restored.window.document.querySelector('a[href*="forms.cloud.microsoft"]'));assert.ok(!saved.includes('imageUrl'));}finally{restored.window.close();}
});
test('event context handles detail followups, changed dates and unknown referents',async()=>{
 const dom=await start(),w=dom.window;
 const latest=()=>Array.from(w.document.querySelectorAll('.gearly-bot')).at(-1).textContent;
 try{
  await w.Gearly.ask('Will there be food for it?');assert.match(latest(),/Which event do you mean/);
  await w.Gearly.ask('What is the next ASME event?');assert.match(latest(),/MATLAB/);
  await w.Gearly.ask('Will there be food for it?');assert.match(latest(),/MATLAB/);assert.match(latest(),/does not specify/);
  await w.Gearly.ask('What about next month?');assert.match(latest(),/Bridge Building Competition/);assert.doesNotMatch(latest(),/MATLAB/);
  await w.Gearly.ask('Show upcoming events');await w.Gearly.ask('Is there food there?');assert.match(latest(),/Which event do you mean/);
 }finally{dom.window.close();}
});
test('paraphrases and unrelated queries cannot be hijacked by student overrides',async()=>{
 const dom=await start(),w=dom.window;
 const latest=()=>Array.from(w.document.querySelectorAll('.gearly-bot')).at(-1);
 try{
  for(const q of ['Where is your office?','What should I wear to an employer talk?','How can I practice interview questions?','how can i jon the group me']){
   await w.Gearly.ask(q);assert.doesNotMatch(latest().textContent,/Which of these|could not confidently match|These pages or sections/);
  }
  await w.Gearly.ask('How much does sponsorship cost?');assert.doesNotMatch(latest().textContent,/newsletter.*free/i);
  await w.Gearly.ask('My chemistry exam points are missing');assert.doesNotMatch(latest().textContent,/check the event and attendance record|published point values/i);
  await w.Gearly.ask('Who is the current president?');assert.match(latest().textContent,/Matthew Allen/);assert.doesNotMatch(latest().textContent,/office hours/i);
  await w.Gearly.ask('Show company photos');assert.ok(latest().querySelector('a[href*="/pictures/"]'));assert.doesNotMatch(latest().textContent,/Which of these/);
  await w.Gearly.ask('How do I sign up for the MATLAB event?');assert.match(latest().textContent,/MATLAB/);assert.match(latest().textContent,/RSVP|registration/);assert.doesNotMatch(latest().textContent,/newsletter signup/i);
 }finally{dom.window.close();}
});

test('selecting a recurring event retains its exact date across followups and reload',async()=>{
 const calendar={events:[1,2,3].map(n=>({id:'repeat-'+n,title:'Weekly Chapter Event',start:'2026-10-'+(15+n)+'T21:30:00Z',end:'2026-10-'+(15+n)+'T22:30:00Z',description:''}))};
 const first=await start(undefined,{calendar});let saved;
 try{
  await first.window.Gearly.ask('Show upcoming events');
  saved=first.window.sessionStorage.getItem('gearly_state_v1');
 }finally{first.window.close();}
 const restored=await start(saved,{calendar}),w=restored.window;
 try{
  await w.Gearly.ask('Show the second event');
  await w.Gearly.ask('Will there be food for it?');
  assert.equal(JSON.parse(w.sessionStorage.getItem('gearly_state_v1')).eventContextId,'repeat-2');
  const latest=Array.from(w.document.querySelectorAll('.gearly-bot')).at(-1).textContent;
  assert.match(latest,/Oct 17, 2026/);assert.match(latest,/does not specify whether food/);
 }finally{restored.window.close();}
});
