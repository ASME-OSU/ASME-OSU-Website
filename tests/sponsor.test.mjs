import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('Sponsor Integration.js', 'utf8');
const html = fs.readFileSync('Sponsor ASME Page.html', 'utf8').replace(/<script>[\s\S]*?<\/script>/g, '');

function setup() {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/sponsor-asme/' });
  dom.window.eval(source);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}

test('both sponsor forms generate encoded drafts from their own fields', () => {
  const dom = setup();
  const { document, Event } = dom.window;
  const forms = document.querySelectorAll('[data-sponsor-form]');
  assert.equal(forms.length, 2);
  forms.forEach((form, index) => {
    const company = form.querySelector('[data-sponsor-field="company"]');
    company.value = `Company & ${index}`;
    company.dispatchEvent(new Event('input', { bubbles: true }));
    const link = new URL(form.querySelector('.sponsor-form-submit').href);
    assert.equal(link.protocol, 'mailto:');
    assert.equal(link.pathname, 'asme@osu.edu');
    assert.ok(link.searchParams.get('subject').includes(`Company & ${index}`));
    assert.ok(link.searchParams.get('body').includes(`Company: Company & ${index}`));
  });
  dom.window.close();
});

test('tier selection opens and focuses modal; Escape and close button close it', () => {
  const dom = setup();
  const { document, KeyboardEvent } = dom.window;
  const button = document.querySelector('[data-sponsor-tier]');
  const modal = document.getElementById('sponsor-modal');
  button.click();
  assert.equal(modal.hidden, false);
  assert.equal(modal.querySelector('[data-sponsor-field="tier"]').value, button.getAttribute('data-sponsor-tier'));
  assert.equal(document.activeElement, modal.querySelector('[data-sponsor-field="company"]'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(modal.hidden, true);
  assert.equal(document.documentElement.classList.contains('sponsor-modal-open'), false);
  button.click();
  modal.querySelector('[data-sponsor-modal-close]').click();
  assert.equal(modal.hidden, true);
  dom.window.close();
});

test('loading both inline copies binds only one tier-change handler', () => {
  const dom = setup();
  const { document } = dom.window;
  dom.window.eval(source);
  document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  let changes = 0;
  document.querySelector('#sponsor-modal [data-sponsor-field="tier"]').addEventListener('change', () => changes++);
  document.querySelector('[data-sponsor-tier]').click();
  assert.equal(changes, 1);
  dom.window.close();
});
