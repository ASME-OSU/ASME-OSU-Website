import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const footer = fs.readFileSync('Footer.html', 'utf8');
const interactions = footer.match(/<!-- V11 interactions script -->\s*<script>([\s\S]*?)<\/script>/)[1];
const upgrade = fs.readFileSync('Footer Integration.js', 'utf8');
const pages = ['Home', 'About Us', 'Join', 'Calendar', 'Gallery', 'Leadership',
  'Current Sponsors', 'Sponsor ASME', 'Member Resources', 'Member Points'];

async function setup(markup, reducedMotion, observe = true, legacy = false) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/' });
  const w = dom.window;
  await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
  const timers = [];
  w.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  w.setInterval = () => 0;
  w.requestAnimationFrame = () => 0;
  w.matchMedia = () => ({ matches: reducedMotion });
  const observed = [];
  if (observe) w.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe(target) { observed.push({ target, callback: this.callback }); }
    unobserve() {}
    disconnect() {}
  };
  // Exercise the external fix against the older footer already in WordPress.
  w.eval(legacy ? interactions.replace("if (reduceMotion || !('IntersectionObserver' in window))", 'if (reduceMotion)') : interactions);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  w.eval(upgrade);
  timers.filter(timer => timer.ms === 0).forEach(timer => timer.fn());
  return { dom, w, observed };
}

for (const page of pages) {
  for (const mode of ['motion', 'reduced', 'no-observer']) {
    test(`${page}: ${mode} keeps entrances usable and avoids nested reveals`, async () => {
      const markup = fs.readFileSync(`${page} Page.html`, 'utf8') + footer;
      const { dom, w, observed } = await setup(markup, mode === 'reduced', mode !== 'no-observer', true);
      try {
        const targets = [...w.document.querySelectorAll('.asme-reveal, .asme-animate')];
        assert.ok(targets.length, 'shared footer targets are present');
        for (const target of targets) {
          assert.equal(target.parentElement.closest('.asme-reveal, .asme-animate'), null);
          assert.ok(parseFloat(target.style.getPropertyValue('--asme-delay')) <= 140);
          if (mode !== 'motion') assert.ok(target.classList.contains('is-visible'));
        }
        if (mode === 'motion') {
          observed.forEach(({ target, callback }) => callback([{ target, isIntersecting: true }]));
          targets.forEach(target => assert.ok(target.classList.contains('is-visible')));
        }
        assert.equal(w.document.documentElement.classList.contains('asme-motion-static'), mode === 'no-observer');
      } finally { dom.window.close(); }
    });
  }
}

test('keyboard focus reveals its section without waiting for scroll observation', async () => {
  const { dom, w } = await setup('<section class="ah-card"><a href="/join/">Join</a></section>', false);
  try {
    const card = w.document.querySelector('.ah-card');
    assert.ok(!card.classList.contains('is-visible'));
    card.querySelector('a').focus();
    assert.ok(card.classList.contains('is-visible'));
    assert.equal(card.style.getPropertyValue('--asme-delay'), '0ms');
  } finally { dom.window.close(); }
});

for (const mode of ['motion', 'reduced', 'no-observer']) {
  test(`WordPress Blog: ${mode} keeps posts and sidebar widgets reachable`, async () => {
    const markup = '<body class="blog"><main id="page"><article><a href="/post/">Post</a></article>' +
      '<aside id="secondary"><section class="widget"><a href="/archive/">Archive</a></section></aside></main></body>';
    const { dom, w, observed } = await setup(markup, mode === 'reduced', mode !== 'no-observer', true);
    try {
      const targets = [...w.document.querySelectorAll('article, .widget')];
      assert.equal(targets.length, 2);
      if (mode === 'motion') observed.forEach(({ target, callback }) => callback([{ target, isIntersecting: true }]));
      targets.forEach(target => assert.ok(target.classList.contains('is-visible')));
    } finally { dom.window.close(); }
  });
}
