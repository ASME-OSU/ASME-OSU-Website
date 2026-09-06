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
  assert.equal(footer.querySelectorAll('.asme-footer-connect a').length, 4);
  assert.equal(footer.querySelector('.asme-footer-connect a[aria-label$="GroupMe"]').href, 'https://groupme.com/join_group/95825283/iaBgk5Ld');
  assert.match(footer.querySelector('.asme-footer-contact').textContent, /Scott Laboratory/);
  assert.ok(footer.querySelector('.asme-footer-groupme-icon'));
  assert.ok(footer.querySelector('.asme-footer-linkedin svg'));
  assert.ok(footer.querySelector('.asme-footer-login'));
  assert.equal(footer.querySelector('.asme-footer-bottom').textContent.trim(), '© 2026 ASME Ohio State University Chapter. All rights reserved.');
  dom.window.close();
});
