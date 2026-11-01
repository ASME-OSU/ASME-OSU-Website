import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {JSDOM} from 'jsdom';
const loader=fs.readFileSync('celebration.js','utf8');
function setup(pending=false){const d=new JSDOM('<a id="joinGroupMeButton" href="https://groupme.com/join_group/test">GroupMe</a><p id="asme-groupme-return-message"></p>',{url:'https://org.osu.edu/asme/join/',runScripts:'outside-only'});if(pending)d.window.sessionStorage.setItem('asme-groupme-pending-v1',String(Date.now()));d.window.eval(loader);return d;}
test('ordinary Join visits defer the experience; focus loads one copy and failures can retry',()=>{const d=setup(),w=d.window,link=w.document.getElementById('joinGroupMeButton');assert.equal(w.document.querySelector('script[data-asme-experience]'),null);link.focus();let s=w.document.querySelector('script[data-asme-experience]');assert.ok(s.src.includes('assets/celebration/experience.js'));link.dispatchEvent(new w.Event('pointerenter'));assert.equal(w.document.querySelectorAll('script[data-asme-experience]').length,1);s.dispatchEvent(new w.Event('error'));link.blur();link.focus();assert.equal(w.document.querySelectorAll('script[data-asme-experience]').length,1);assert.match(w.document.querySelector('p').textContent,/try again/);d.window.close();});
test('returning GroupMe journeys load immediately and carry pending state',()=>{const d=setup(true);const s=d.window.document.querySelector('script[data-asme-experience]');assert.ok(Number(s.dataset.groupmePending)>0);d.window.close();});

test('deferred card initialization preserves only card fields across newsletter reset',()=>{
 const d=new JSDOM('<form id="asmeNewsletterForm"><input id="FIRSTNAME"><input id="LASTNAME"><input id="GRADUATION_YEAR"><input id="EMAIL"></form><a id="joinGroupMeButton" href="https://groupme.com/">GroupMe</a>',{url:'https://org.osu.edu/asme/join/',runScripts:'outside-only'}),w=d.window;
 w.eval(loader);const form=w.document.querySelector('form');
 for(const [id,value]of [['FIRSTNAME','Alex'],['LASTNAME','Buckeye'],['GRADUATION_YEAR','2028'],['EMAIL','private@example.invalid']])w.document.getElementById(id).value=value;
 form.dispatchEvent(new w.Event('input',{bubbles:true}));form.reset();
 assert.deepEqual(JSON.parse(JSON.stringify(w.document.getElementById('joinGroupMeButton').asmeCelebrationProfile)),{first:'Alex',last:'Buckeye',year:'2028'});
 assert.equal(w.sessionStorage.length,0);d.window.close();
});
