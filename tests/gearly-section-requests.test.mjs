import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
const context={module:{exports:{}},URL,console};vm.runInNewContext(fs.readFileSync(new URL('../assets/gearly/gearly.js',import.meta.url),'utf8'),context);const engine=context.module.exports;
const data=engine.validateData(JSON.parse(fs.readFileSync(new URL('../assets/gearly/gearly-data.json',import.meta.url)))).data;
test('natural section requests resolve safely without score overrides',()=>{
 const cases=[['show me the ranking chart','leaderboard'],['where am I on the leaderboard','leaderboard'],['pull up the ranking chart','leaderboard'],['can you bring up the standings chart','leaderboard'],['can you pull up the ranking table please','leaderboard'],['show upcoming events','events'],['bring up the event schedule','events'],['take me to career resources','careers'],['go to career resources','careers']];
 for(const [text,id] of cases){const got=engine.match(data,text,engine.createState());assert.equal(got.kind,'answer',text);assert.equal(got.intent.id,id,text);}
});
test('unrelated ranking requests and negated commands do not confidently claim chapter rank',()=>{
 for(const text of ['show my secret private rank','pull up my bank ranking chart','do not show me the ranking chart','show university ranking','purple bananas ranking chart'])assert.notEqual(engine.match(data,text,engine.createState()).kind,'answer',text);
});
test('section actions reference approved pages and actual repository selectors',()=>{
 const expected={leaderboard:['#leaderboard','#member-dashboard'],events:['#asmeCalendarUpcoming'],careers:['#professional-dev']};
 for(const [id,selectors] of Object.entries(expected)){
  const intent=data.intents.find(i=>i.id===id);assert.deepEqual(Array.from(intent.actions,a=>a.selector),selectors);
  for(const action of intent.actions){assert.equal(action.type,'scrollTo');const page=data.pages.find(p=>p.url===action.page);assert.ok(page);const dom=new JSDOM(fs.readFileSync(new URL('../'+page.sourceFile,import.meta.url),'utf8'));assert.ok(dom.window.document.querySelector(action.selector),action.selector);dom.window.close();}
 }
 assert.match(data.intents.find(i=>i.id==='leaderboard').response.text,/cannot identify you/);
});
