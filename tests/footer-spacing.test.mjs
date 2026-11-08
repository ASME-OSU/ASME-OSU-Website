import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const script = fs.readFileSync('Footer Integration.js', 'utf8');
async function setup(content, theme = '<div class="site-footer"><footer style="display:none">Old copyright</footer></div>') {
  const dom = new JSDOM(content + theme + '<div class="asme-footer-inner asme-footer-v2"></div>', { runScripts: 'outside-only' });
  await new Promise(resolve => dom.window.addEventListener('load', resolve, { once: true }));
  dom.window.eval(script);
  await new Promise(resolve => setTimeout(resolve, 10));
  return dom;
}
const page = content => '<div id="page"><main id="main"><article class="type-page"><div class="inside-article"><div class="entry-content">' + content + '</div></div></article></main></div>';

test('footer spacing ignores trailing CMS whitespace, script wrappers and fixed dialogs', async () => {
  const dom = await setup(page('<div class="asme-sponsor-page"><section class="final-card" style="padding:32px">Contact form</section><div class="sponsor-modal" hidden>Dialog</div><p> <br><script>/* CMS script */</script><br> </p></div><p> </p><br>'));
  try {
    const d = dom.window.document;
    assert.ok(d.body.classList.contains('asme-footer-spacing-ready'));
    assert.ok(d.querySelector('.asme-sponsor-page').classList.contains('asme-page-bottom-frame'));
    assert.ok(d.querySelector('.final-card').classList.contains('asme-page-last-block'));
    assert.equal(d.querySelector('.final-card').style.padding, '32px');
    assert.equal(d.querySelector('.sponsor-modal').classList.contains('asme-page-last-block'), false);
    assert.equal(d.querySelectorAll('.asme-footer-spacer').length, 3);
    assert.ok(d.querySelector('.site-footer').classList.contains('asme-empty-theme-footer'));
  } finally { dom.window.close(); }
});

test('authored content and accessible dynamic placeholders are not removed as whitespace', async () => {
  const dom = await setup(page('<div class="asme-home"><p><img src="/photo.jpg" alt="Event"></p><p id="status" role="status" aria-live="polite"></p></div>'));
  try {
    const d = dom.window.document;
    assert.equal(d.querySelectorAll('.asme-footer-spacer').length, 0);
    assert.ok(d.querySelector('img'));
    assert.ok(d.querySelector('#status').classList.contains('asme-page-last-block'));
  } finally { dom.window.close(); }
});

test('a theme footer with real visible widgets is preserved', async () => {
  const dom = await setup(page('<div class="asme-home"><section>Content</section></div>'), '<div class="site-footer"><section>Useful footer widget</section></div>');
  try {
    assert.equal(dom.window.document.querySelector('.site-footer').classList.contains('asme-empty-theme-footer'), false);
  } finally { dom.window.close(); }
});

test('Blog sidebar ending is normalized without stripping post or widget interiors', async () => {
  const dom = await setup('<div id="page"><main id="main"><article style="padding:40px">Post</article><nav>Next page</nav></main><div id="right-sidebar"><div class="inside-right-sidebar"><aside class="widget" style="padding:20px">Archive</aside></div></div></div>');
  try {
    const d = dom.window.document;
    assert.equal(d.body.classList.contains('asme-footer-custom-page'), false);
    assert.ok(d.querySelector('nav').classList.contains('asme-page-last-block'));
    assert.ok(d.querySelector('.widget').classList.contains('asme-page-last-block'));
    assert.equal(d.querySelector('article').style.padding, '40px');
    assert.equal(d.querySelector('.widget').style.padding, '20px');
  } finally { dom.window.close(); }
});
