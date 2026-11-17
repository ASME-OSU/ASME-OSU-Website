import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('Footer Integration.js', 'utf8');

test('upgrades the legacy footer while retaining destinations and adding GroupMe', () => {
  const dom = new JSDOM(`
    <header id="masthead"><a class="site-logo" href="https://org.osu.edu/asme/"><img src="https://example.test/logo.png"></a></header>
    <footer><div class="asme-footer-inner"><div class="asme-footer-grid">
      <div><a href="https://example.test/join">Join ASME</a><a href="https://example.test/leadership">Leadership</a><a href="https://example.test/gallery">Gallery</a><a href="https://example.test/about">About Us</a><a href="https://example.test/sponsor">Sponsor ASME</a></div>
      <div><a href="https://example.test/instagram">Instagram</a><a href="https://example.test/linkedin">LinkedIn</a><a href="https://example.test/calendar">Calendar</a></div>
    </div></div></footer>`, { url: 'https://org.osu.edu/asme/', runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const footer = window.document.querySelector('.asme-footer-v2');
  assert.ok(footer);
  assert.equal(footer.querySelector('.asme-footer-logo img').src, 'https://example.test/logo.png');
  assert.equal(footer.querySelector('.asme-footer-links a').href, 'https://example.test/join');
  assert.equal(footer.querySelector('.asme-footer-links a > span').textContent, 'Join ASME');
  assert.equal(footer.querySelectorAll('.asme-footer-connect a').length, 4);
  assert.equal(footer.querySelector('.asme-footer-connect a[aria-label$="GroupMe"]').href, 'https://groupme.com/join_group/95825283/iaBgk5Ld');
  assert.match(footer.querySelector('.asme-footer-contact').textContent, /Scott Laboratory/);
  assert.ok(footer.querySelector('.asme-footer-groupme-icon'));
  assert.ok(footer.querySelector('.asme-footer-linkedin svg'));
  assert.ok(footer.querySelector('.asme-footer-login'));
  assert.equal(footer.querySelector('.asme-footer-bottom').textContent.trim(), '© 2026 ASME Ohio State University Chapter. All rights reserved.');
  dom.window.close();
});

test('normalizes pre-existing v2 Quick Link labels for centered layout', () => {
  const dom = new JSDOM(`
    <footer><div class="asme-footer-inner asme-footer-v2"><nav class="asme-footer-links"><ul>
      <li><a href="https://example.test/join">Join ASME <svg viewBox="0 0 24 24" aria-hidden="true"></svg></a></li>
    </ul></nav></div></footer>`, { url: 'https://org.osu.edu/asme/', runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(script);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const link = window.document.querySelector('.asme-footer-links a');
  assert.equal(link.querySelector(':scope > span').textContent, 'Join ASME');
  assert.equal(link.firstChild, link.querySelector('span'));
  assert.equal(link.lastChild.tagName.toLowerCase(), 'svg');
  dom.window.close();
});

test('updates previously published homepage hero copy to match the authored template', () => {
  const dom = new JSDOM(`
    <div class="asme-home"><div class="ah-hero">
      <p class="ah-sub">Connecting students, industry, and opportunity.</p>
    </div></div>
  `, { url: 'https://org.osu.edu/asme/', runScripts: 'outside-only' });
  const { window } = dom;
  try {
    window.eval(script);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const expected = fs.readFileSync('Home Page.html', 'utf8').match(/<p class="ah-sub">([^<]+)<\/p>/)[1];
    assert.equal(window.document.querySelector('.ah-sub').textContent, expected);
  } finally {
    window.close();
  }
});

test('skip link moves focus to main even when a legacy footer cancels the click', () => {
  const dom = new JSDOM(`
    <a class="skip-link" href="#content">Skip to content</a>
    <header><a href="/asme/">Brand</a></header>
    <div id="content"><main id="main"><a href="/asme/calendar/">Events</a></main></div>
  `, { url: 'https://org.osu.edu/asme/', runScripts: 'outside-only' });
  const { window } = dom;
  try {
    const link = window.document.querySelector('.skip-link');
    const main = window.document.getElementById('main');
    link.addEventListener('click', event => event.preventDefault());
    window.eval(script);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
    link.focus();
    link.click();

    assert.equal(link.hash, '#main');
    assert.equal(main.getAttribute('tabindex'), '-1');
    assert.equal(window.document.activeElement, main);
  } finally {
    window.close();
  }
});

test('removes only empty sponsor duplicates introduced by CampusPress', () => {
  const dom = new JSDOM(`
    <div class="asme-sponsors-page"><article class="sponsor-card">
      <a class="sponsor-logo-link" href="https://example.com/"><img alt="Sponsor"></a>
      <p><a class="sponsor-logo-link" href="https://example.com/"></a></p>
      <h3><a href="https://example.com/">Sponsor</a></h3>
    </article></div>
  `, { url: 'https://org.osu.edu/asme/', runScripts: 'outside-only' });
  const { window } = dom;
  try {
    window.eval(script);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    const links = window.document.querySelectorAll('.sponsor-logo-link');
    assert.equal(links.length, 1);
    assert.equal(links[0].querySelector('img').alt, 'Sponsor');
    assert.ok(window.document.querySelector('.sponsor-card h3 a'));
    assert.equal(window.document.querySelector('.sponsor-card p'), null);
  } finally {
    window.close();
  }
});

test('adds a Blog archive heading and names unnamed thumbnail links', () => {
  const dom = new JSDOM(`
    <body class="blog"><main>
      <article>
        <h2 class="entry-title"><a href="/entry/">Plant tour recap</a></h2>
        <div class="post-image"><a href="/entry/"><img alt=""></a></div>
      </article>
    </main></body>
  `, { url: 'https://org.osu.edu/asme/blog/', runScripts: 'outside-only' });
  const { window } = dom;
  try {
    window.eval(script);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

    assert.equal(window.document.querySelector('main h1').textContent, 'Chapter news archive');
    assert.equal(window.document.querySelector('.asme-blog-intro a').pathname, '/asme/calendar/');
    assert.equal(window.document.querySelector('.post-image a').getAttribute('aria-label'), 'Plant tour recap');
  } finally {
    window.close();
  }
});
