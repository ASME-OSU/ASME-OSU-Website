import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const integration=fs.readFileSync('Footer Integration.js','utf8');
const home=fs.readFileSync('Home Page.html','utf8');

test('legacy CMS hero is updated without replacing assets, destinations, or carousel nodes',async()=>{
  const dom=new JSDOM(home,{runScripts:'outside-only'});const w=dom.window,d=w.document;
  await new Promise(resolve=>w.addEventListener('load',resolve,{once:true}));
  const hero=d.querySelector('.ah-hero');
  const originalHero=hero.innerHTML;
  const belowFold=d.querySelector('.ah-featured-event').outerHTML;
  // Reproduce the previous CMS copy and WordPress's injected empty blocks.
  d.querySelector('.asme-home').classList.remove('asme-home-refined');
  d.querySelector('.ah-hero-left').insertAdjacentHTML('afterbegin','<div class="ah-eyebrow">Ohio State University · Student Chapter</div><p> </p>');
  d.querySelector('.ah-sub').textContent='Previous description';
  d.querySelector('.ah-btn-o').textContent='Latest Events';
  d.querySelector('[data-spotlight-slide="0"]').insertAdjacentHTML('beforeend','<div class="ah-badge-label">Award Winner</div><p> </p>');
  const award=d.querySelector('.ah-badge img'),awardSource=award.src;
  const slides=d.querySelector('#ahSlides'),dots=d.querySelector('#ahDots');
  const control=d.querySelector('[data-spotlight-dot="1"]');let clicks=0;
  control.addEventListener('click',()=>clicks++);
  const destinations=[...hero.querySelectorAll('a')].map(a=>a.href);
  try {
    w.eval(integration);
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(d.querySelector('.ah-eyebrow'),null);
    assert.equal(d.querySelector('.ah-sub').textContent,'Connecting students, industry, and opportunity.');
    assert.equal(d.querySelector('.ah-btn-o').textContent,'Events');
    assert.equal(d.querySelector('[data-spotlight-slide="0"] .ah-badge-label'),null);
    assert.equal(d.querySelector('.ah-badge img'),award);
    assert.equal(award.src,awardSource);
    assert.equal(d.querySelector('#ahSlides'),slides);assert.equal(d.querySelector('#ahDots'),dots);
    assert.equal(d.querySelector('[data-spotlight-dot="1"]'),control);
    control.click();assert.equal(clicks,1);
    assert.deepEqual([...hero.querySelectorAll('a')].map(a=>a.href),destinations);
    assert.equal(d.querySelector('.ah-featured-event').outerHTML,belowFold);
    assert.equal(hero.innerHTML,originalHero);
  } finally {w.close();}
});

test('homepage hero upgrade does not alter another page',async()=>{
  const dom=new JSDOM('<section class="asme-about-page"><h1>About</h1><p>Unchanged.</p></section>',{runScripts:'outside-only'});
  await new Promise(resolve=>dom.window.addEventListener('load',resolve,{once:true}));
  try {const before=dom.window.document.body.innerHTML;dom.window.eval(integration);
    await new Promise(resolve=>setTimeout(resolve,10));assert.equal(dom.window.document.body.innerHTML,before);
  } finally {dom.window.close();}
});
