import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const fixture=fs.readFileSync('tests/fixtures/wordpress-header.html','utf8');
const template=fs.readFileSync('Header.html','utf8');
const css=fs.readFileSync('Header.css','utf8');
const script=fs.readFileSync('Header Integration.js','utf8');
function setup({url='https://org.osu.edu/asme/',styles=true,prepare=()=>{}}={}) {
  const dom=new JSDOM('<!doctype html><html><head>'+(styles?'<style>'+css+'</style>':'')+'</head><body>'+fixture+'<main id="content"><h1>Existing page</h1><p>Preserved content.</p></main>'+template+'</body></html>',{url,runScripts:'outside-only'});
  const w=dom.window;w.matchMedia=()=>({matches:true,addEventListener(){}});prepare(w.document);
  w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {dom,w,d:w.document,close:()=>w.close()};
}
test('renders ordered CMS links, active Home, and unchanged page content',()=>{
  const s=setup();const links=[...s.d.querySelectorAll('.asme-hd-link')];
  assert.deepEqual(links.map(x=>x.textContent),['Home','About','Join','Events','Gallery','Leadership','Members']);
  assert.equal(links[0].getAttribute('aria-current'),'page');
  assert.equal(s.d.querySelectorAll('.asme-hd-link.is-active').length,1);
  assert.equal(links[3].href,'https://org.osu.edu/asme/calendar/');
  assert.equal(s.d.querySelector('#content').innerHTML,'<h1>Existing page</h1><p>Preserved content.</p>');
  assert.equal(s.d.querySelector('#masthead').hidden,true);
  s.w.eval(script);assert.equal(s.d.querySelectorAll('#asme-site-header').length,1);s.close();
});
test('uses CMS destinations for Join and for new member submenu entries',()=>{
  const s=setup({prepare(d){d.querySelector('#menu-item-579 > a').href='https://org.osu.edu/asme/custom-join/';const a=d.createElement('a');a.href='https://org.osu.edu/asme/member-guide/';a.textContent='Member guide';const li=d.createElement('li');li.append(a);d.querySelector('#menu-item-1036 > ul').append(li);}});
  assert.equal(s.d.querySelector('.asme-hd-join').href,'https://org.osu.edu/asme/custom-join/');
  assert.deepEqual([...s.d.querySelectorAll('#asme-header-members a')].map(a=>a.textContent),['Member Resources','Member Points Page','Member guide']);s.close();
});
test('Members disclosure supports keyboard entry and Escape with focus return',()=>{
  const s=setup();const button=s.d.querySelector('[aria-controls="asme-header-members"]');button.focus();button.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement.textContent,'Member Resources');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(s.d.querySelector('#asme-header-members').hidden,true);assert.equal(s.d.activeElement,button);s.close();
});
test('mobile toggle focuses navigation and Escape closes it',()=>{
  const s=setup();const button=s.d.querySelector('.asme-hd-menu-toggle');button.click();
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement.textContent,'Home');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(s.d.activeElement,button);s.close();
});
test('search uses WordPress search parameters, focuses input, and closes on Escape',()=>{
  const s=setup();const button=s.d.querySelector('.asme-hd-search-toggle');button.click();const form=s.d.querySelector('#asme-header-search');
  assert.equal(form.hidden,false);assert.equal(form.action,'https://org.osu.edu/asme/');assert.equal(form.method,'get');assert.equal(s.d.activeElement.name,'s');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(form.hidden,true);assert.equal(s.d.activeElement,button);s.close();
});
test('keeps the original CMS header usable if component CSS is unavailable',()=>{
  const s=setup({styles:false});assert.equal(s.d.querySelector('#asme-site-header'),null);assert.equal(s.d.querySelector('#masthead').hidden,false);s.close();
});
test('highlights Members on a member page instead of Home',()=>{
  const s=setup({url:'https://org.osu.edu/asme/member-points-page/',prepare(d){d.querySelector('[aria-current="page"]').removeAttribute('aria-current');}});
  assert.deepEqual([...s.d.querySelectorAll('.asme-hd-link.is-active')].map(a=>a.textContent),['Members']);assert.equal(s.d.querySelector('#asme-header-members [aria-current="page"]').textContent,'Member Points Page');s.close();
});
