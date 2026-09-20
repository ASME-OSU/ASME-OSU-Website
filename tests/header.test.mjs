import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const fixture=fs.readFileSync('tests/fixtures/wordpress-header.html','utf8');
const template=fs.readFileSync('Header.html','utf8');
const css=fs.readFileSync('Header.css','utf8');
const script=fs.readFileSync('Header Integration.js','utf8');
test('ultra-wide header cap matches the inner WordPress content frame',()=>{
  assert.match(css,/width:calc\(100% - 152px\);\s*\/\*[^*]*\*\/\s*max-width:2048px;/);
});
function setup({url='https://org.osu.edu/asme/',styles=true,prepare=()=>{}}={}) {
  const dom=new JSDOM('<!doctype html><html><head>'+(styles?'<style>'+css+'</style>':'')+'</head><body>'+fixture+'<main id="content"><h1>Existing page</h1><p>Preserved content.</p></main>'+template+'</body></html>',{url,runScripts:'outside-only'});
  const w=dom.window;w.requestAnimationFrame=cb=>{cb();};w.matchMedia=()=>({matches:true,addEventListener(){}});prepare(w.document);
  w.eval(script);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return {dom,w,d:w.document,close:()=>w.close()};
}
test('renders ordered CMS links, active Home, and unchanged page content',()=>{
  const s=setup();const links=[...s.d.querySelectorAll('.asme-hd-link')];
  assert.deepEqual(links.map(x=>x.textContent),['Home','About','Join','Events','Corporate','Gallery','Leadership','Members']);
  assert.equal(links[0].getAttribute('aria-current'),'page');
  assert.equal(s.d.querySelectorAll('.asme-hd-link.is-active').length,1);
  assert.equal(links[3].href,'https://org.osu.edu/asme/calendar/');
  const corporate=[...s.d.querySelectorAll('#asme-header-corporate a')];
  assert.deepEqual(corporate.map(a=>a.textContent),['Current Sponsors','Sponsor ASME']);
  assert.deepEqual(corporate.map(a=>a.href),['https://org.osu.edu/asme/current-sponsors/','https://org.osu.edu/asme/sponsor-asme/']);
  assert.equal(s.d.querySelector('#content').innerHTML,'<h1>Existing page</h1><p>Preserved content.</p>');
  assert.equal(s.d.querySelector('#masthead').hidden,true);
  assert.equal(s.d.querySelector('#asme-header-spacer').nextElementSibling.id,'asme-site-header');
  assert.equal(s.d.querySelector('.asme-hd-join-mobile').textContent,'Join');
  s.w.eval(script);assert.equal(s.d.querySelectorAll('#asme-site-header').length,1);s.close();
});
test('uses CMS destinations for Join while excluding unrelated member submenu entries',()=>{
  const s=setup({prepare(d){d.querySelector('#menu-item-579 > a').href='https://org.osu.edu/asme/custom-join/';const a=d.createElement('a');a.href='https://org.osu.edu/asme/member-guide/';a.textContent='Member guide';const li=d.createElement('li');li.append(a);d.querySelector('#menu-item-1036 > ul').append(li);}});
  assert.equal(s.d.querySelector('.asme-hd-join').href,'https://org.osu.edu/asme/custom-join/');
  assert.deepEqual([...s.d.querySelectorAll('#asme-header-members a')].map(a=>a.textContent),['Member Resources','Member Points Page']);s.close();
});
test('Members dropdown keeps only its two existing CMS links with leading icons',()=>{
  const s=setup({prepare(d){
    const submenu=d.querySelector('#menu-item-1036 > ul');
    const extra=d.createElement('li');extra.innerHTML='<a href="https://org.osu.edu/asme/unrelated/">Unrelated</a>';submenu.append(extra);
  }});
  const links=[...s.d.querySelectorAll('#asme-header-members > li > a')];
  assert.deepEqual(links.map(a=>a.textContent),['Member Resources','Member Points Page']);
  assert.deepEqual(links.map(a=>a.href),['https://org.osu.edu/asme/member-resources/','https://org.osu.edu/asme/member-points-page/']);
  assert.equal(links.every(a=>a.querySelector('svg.asme-hd-dropdown-link-icon[aria-hidden="true"]')),true);
  assert.match(css,/@media \(min-width:980px\) \{[\s\S]*?\.asme-hd-dropdown-submenu \{[^}]*width:232px/);
  assert.match(css,/@media \(max-width:979px\) \{[\s\S]*?\.asme-hd-submenu \{[^}]*border-radius:12px/);
  assert.match(css,/@media \(max-width:979px\) \{[\s\S]*?\.asme-hd-submenu \{[^}]*margin:4px 0 10px;/);
  assert.match(css,/@media \(max-width:979px\) \{[\s\S]*?\.asme-hd-submenu \.asme-hd-dropdown-link \{[^}]*min-height:46px/);
  assert.doesNotMatch(css,/\.asme-hd-dropdown-link-icon \{display:none;\}/);
  s.close();
});
test('Corporate uses the same compact dropdown without changing its CMS links',()=>{
  const s=setup({prepare(d){
    d.querySelector('#menu-item-652 > ul > li > a').href='https://org.osu.edu/asme/custom-sponsors/';
  }});
  const links=[...s.d.querySelectorAll('#asme-header-corporate > li > a')];
  assert.deepEqual(links.map(a=>a.textContent),['Current Sponsors','Sponsor ASME']);
  assert.deepEqual(links.map(a=>a.href),['https://org.osu.edu/asme/custom-sponsors/','https://org.osu.edu/asme/sponsor-asme/']);
  assert.equal(links.every(a=>a.querySelector('svg.asme-hd-dropdown-link-icon[aria-hidden="true"]')),true);
  assert.equal(s.d.querySelector('#asme-header-corporate').classList.contains('asme-hd-dropdown-submenu'),true);
  assert.equal(s.d.querySelector('[aria-controls="asme-header-corporate"]').classList.contains('asme-hd-dropdown-trigger'),true);
  s.close();
});
test('Members click opens the dropdown and an outside click closes it',()=>{
  const s=setup();const trigger=s.d.querySelector('[aria-controls="asme-header-members"]');const submenu=s.d.querySelector('#asme-header-members');
  trigger.click();assert.equal(trigger.getAttribute('aria-expanded'),'true');assert.equal(submenu.hidden,false);
  s.d.querySelector('#content').click();assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(submenu.hidden,true);
  s.close();
});
test('Members disclosure supports keyboard entry and Escape with focus return',()=>{
  const s=setup();const button=s.d.querySelector('[aria-controls="asme-header-members"]');button.focus();button.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement.textContent,'Member Resources');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(s.d.querySelector('#asme-header-members').hidden,true);assert.equal(s.d.activeElement,button);s.close();
});
test('Corporate disclosure exposes both destinations and supports keyboard entry and Escape',()=>{
  const s=setup();const button=s.d.querySelector('[aria-controls="asme-header-corporate"]');button.focus();button.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement.textContent,'Current Sponsors');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(s.d.querySelector('#asme-header-corporate').hidden,true);assert.equal(s.d.activeElement,button);s.close();
});
test('mobile toggle focuses navigation and Escape closes it',()=>{
  const s=setup();const button=s.d.querySelector('.asme-hd-menu-toggle');button.click();
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement.textContent,'Home');
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(button.getAttribute('aria-expanded'),'false');assert.equal(s.d.activeElement,button);s.close();
});
test('mobile submenus remain independently expandable with keyboard dismissal',()=>{
  const s=setup();s.d.querySelector('.asme-hd-menu-toggle').click();
  const corporate=s.d.querySelector('[aria-controls="asme-header-corporate"]');
  const members=s.d.querySelector('[aria-controls="asme-header-members"]');
  corporate.click();assert.equal(s.d.querySelector('#asme-header-corporate').hidden,false);
  members.click();assert.equal(s.d.querySelector('#asme-header-corporate').hidden,true);
  assert.equal(s.d.querySelector('#asme-header-members').hidden,false);
  members.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(s.d.querySelector('#asme-header-members').hidden,true);
  assert.equal(s.d.activeElement,members);s.close();
});
test('pointer activation keeps focus on the mobile toggle while the menu remains open',()=>{
  const s=setup();const button=s.d.querySelector('.asme-hd-menu-toggle');button.focus();
  button.dispatchEvent(new s.w.MouseEvent('click',{bubbles:true,detail:1}));
  assert.equal(button.getAttribute('aria-expanded'),'true');assert.equal(s.d.activeElement,button);
  assert.equal(s.d.querySelector('#asme-site-header').classList.contains('is-menu-open'),true);s.close();
});
test('site search focuses input, returns public pages, and closes on Escape',()=>{
  const s=setup();const button=s.d.querySelector('.asme-hd-search-toggle');button.click();const form=s.d.querySelector('#asme-header-search');
  assert.equal(form.hidden,false);assert.equal(form.action,'https://org.osu.edu/asme/');assert.equal(form.method,'get');assert.equal(s.d.activeElement.name,'s');
  s.d.activeElement.value='points';s.d.activeElement.dispatchEvent(new s.w.Event('input',{bubbles:true}));
  assert.deepEqual([...s.d.querySelectorAll('.asme-hd-search-result strong')].map(x=>x.textContent),['Member Points']);
  s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(form.hidden,true);assert.equal(s.d.activeElement,button);s.close();
});
test('keeps the original CMS header usable if component CSS is unavailable',()=>{
  const s=setup({styles:false});assert.equal(s.d.querySelector('#asme-site-header'),null);assert.equal(s.d.querySelector('#masthead').hidden,false);s.close();
});
test('restores the original header when an early bootstrap has hidden it and component CSS is unavailable',()=>{
  const s=setup({styles:false,prepare(d){d.documentElement.classList.add('asme-header-pending');}});assert.equal(s.d.querySelector('#asme-site-header'),null);assert.equal(s.d.documentElement.classList.contains('asme-header-pending'),false);assert.equal(s.d.querySelector('#masthead').hidden,false);s.close();
});
test('highlights Members on a member page instead of Home',()=>{
  const s=setup({url:'https://org.osu.edu/asme/member-points-page/',prepare(d){d.querySelector('[aria-current="page"]').removeAttribute('aria-current');}});
  assert.deepEqual([...s.d.querySelectorAll('.asme-hd-link.is-active')].map(a=>a.textContent),['Members']);assert.equal(s.d.querySelector('#asme-header-members [aria-current="page"]').textContent,'Member Points Page');s.close();
});

test('slow scrolling hides the header, reversal shows it, and keyboard focus reveals it',()=>{
  const s=setup();const header=s.d.querySelector('#asme-site-header');
  Object.defineProperty(s.d.documentElement,'scrollHeight',{value:4000});
  const scroll=y=>{s.w.scrollY=y;s.w.dispatchEvent(new s.w.Event('scroll'));};
  for(let y=0;y<=120;y+=2) scroll(y);
  assert.equal(header.classList.contains('asme-header-hidden'),true);
  scroll(118);assert.equal(header.classList.contains('asme-header-hidden'),true);
  scroll(114);assert.equal(header.classList.contains('asme-header-hidden'),false);
  scroll(140);assert.equal(header.classList.contains('asme-header-hidden'),true);
  s.d.querySelector('.asme-hd-brand').focus();
  assert.equal(header.classList.contains('asme-header-hidden'),false);
  scroll(180);assert.equal(header.classList.contains('asme-header-hidden'),false);
  s.close();
});
