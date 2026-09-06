import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('Join Page.html', 'utf8');
const script = fs.readFileSync('Join Page Integration.js', 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(fetch, fastTimeout = false) {
  const dom = new JSDOM(html, { url: 'https://org.osu.edu/asme/join/', runScripts: 'outside-only' });
  const w = dom.window;
  w.fetch = fetch;
  w.HTMLElement.prototype.scrollIntoView = () => {};
  if (fastTimeout) {
    const setTimeout = w.setTimeout.bind(w);
    w.setTimeout = (fn, ms) => setTimeout(fn, ms === 15000 ? 1 : ms);
  }
  w.eval(script);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const form = w.document.querySelector('#asmeNewsletterForm');
  for (const [name, value] of Object.entries({ FIRSTNAME: 'Test', LASTNAME: 'Member', EMAIL: 'test@example.invalid', GRADUATION_YEAR: '2028' })) form.elements.namedItem(name).value = value;
  return { dom, w, form, button: form.querySelector('button'), status: w.document.querySelector('#asmeNewsletterStatus'), submit() { return form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); } };
}
test('confirmed acceptance stays inline and advances the existing wrapper once', async () => {
  let calls = 0;
  const s = setup(async (url, options) => {
    calls++;
    assert.equal(new URL(url).searchParams.get('isAjax'), '1');
    assert.equal(options.body.get('EMAIL'), 'test@example.invalid');
    assert.equal(options.body.has('html_type'), false);
    assert.equal(options.credentials, 'omit');
    return { ok: true, json: async () => ({ success: true, redirect: 'https://example.invalid/thank-you' }) };
  });
  assert.equal(s.submit(), false, 'native form navigation is canceled');
  await tick();
  assert.match(s.status.className, /--success/);
  assert.equal(s.status.textContent, 'You have been successfully added to the newsletter list.');
  assert.equal(s.form.elements.EMAIL.value, '');
  assert.equal(s.w.location.href, 'https://org.osu.edu/asme/join/');
  assert.equal(s.form.hasAttribute('target'), false);
  assert.equal(s.w.document.querySelector('#joinNewsletterStep').classList.contains('is-complete'), true);
  s.submit();
  assert.equal(calls, 1);
  s.dom.window.close();
});
test('provider rejection preserves input and allows correction and retry', async () => {
  let calls = 0;
  const s = setup(async () => (++calls === 1
    ? { ok: false, json: async () => ({ success: false, errors: { EMAIL: 'Please review your email.' } }) }
    : { ok: true, json: async () => ({ success: true }) }));
  s.submit(); await tick();
  assert.match(s.status.className, /--error/);
  assert.equal(s.form.elements.EMAIL.value, 'test@example.invalid');
  assert.equal(s.button.disabled, false);
  assert.equal(s.form.elements.EMAIL.validationMessage, 'Please review your email.');
  s.form.elements.EMAIL.dispatchEvent(new s.w.Event('input', { bubbles: true }));
  s.submit(); await tick();
  assert.equal(calls, 2);
  assert.match(s.status.className, /--success/);
  s.dom.window.close();
});
for (const [name, response] of [
  ['malformed JSON', async () => { throw new SyntaxError('Invalid JSON'); }],
  ['unknown response', async () => ({ status: 'ok' })],
  ['non-boolean success', async () => ({ success: 'false' })]
]) test(name + ' cannot complete signup', async () => {
  const s = setup(async () => ({ ok: true, json: response }));
  s.submit(); await tick();
  assert.match(s.status.className, /--error/);
  assert.equal(s.form.elements.EMAIL.value, 'test@example.invalid');
  assert.equal(s.button.disabled, false);
  s.dom.window.close();
});
test('timeout cancels the request, retains details, and does not claim acceptance', async () => {
  const s = setup((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('Aborted')))), true);
  s.submit();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(s.status.className, /--error/);
  assert.match(s.status.textContent, /could not confirm/);
  assert.equal(s.form.elements.EMAIL.value, 'test@example.invalid');
  assert.equal(s.button.disabled, false);
  s.dom.window.close();
});
test('invalid inputs and repeat clicks do not create extra requests', async () => {
  let calls = 0, finish;
  const s = setup(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  s.form.elements.EMAIL.value = '';
  s.submit(); assert.equal(calls, 0);
  s.form.elements.EMAIL.value = 'test@example.invalid';
  s.submit(); s.submit(); assert.equal(calls, 1);
  finish({ ok: true, json: async () => ({ success: true }) });
  await tick();
  s.dom.window.close();
});
