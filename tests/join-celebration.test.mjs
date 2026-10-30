import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

const page = await readFile(new URL('../Join Page.html', import.meta.url), 'utf8');
const source = await readFile(new URL('../celebration.js', import.meta.url), 'utf8');

for (const formatted of [false, true]) {
  test(`celebration initializes with ${formatted ? 'WordPress paragraph wrappers' : 'source markup'}`, () => {
    const dom = new JSDOM(`<main id="page"><div class="entry-content">${page}</div></main>`, {
      url: 'https://org.osu.edu/asme/join/', runScripts: 'outside-only', pretendToBeVisual: true
    });
    const { window } = dom;
    window.matchMedia = () => ({ matches: false });
    window.HTMLCanvasElement.prototype.getContext = () => ({ setTransform() {} });
    const copy = window.document.querySelector('.join-groupme-step-copy');
    const link = window.document.querySelector('#joinGroupMeButton');
    const helper = copy.querySelector('small');
    const destination = link.href;
    const action = window.document.querySelector('#asmeNewsletterForm').action;
    if (formatted) {
      const paragraph = window.document.createElement('p');
      link.before(paragraph);
      paragraph.append(link, window.document.createElement('br'), helper);
      const progress = window.document.querySelector('.join-flow-progress');
      const progressWrap = window.document.createElement('p');
      progress.appendChild(progressWrap);
      progressWrap.append(progress.querySelector('.join-flow-progress-line'), progress.querySelector('#joinGroupMeProgress'));
    }
    assert.doesNotThrow(() => window.eval(source));
    assert.ok(window.document.querySelector('#joinWelcomeProgress'));
    assert.equal(window.document.querySelector('#joinGroupMeProgress').parentElement.className, 'join-flow-progress');
    assert.ok(window.document.querySelector('.asme-return-confirm').disabled);
    assert.equal(link.parentElement, copy);
    assert.equal(link.href, destination);
    assert.equal(window.document.querySelector('#asmeNewsletterForm').action, action);
    assert.equal(window.document.querySelector('#asme-celebration-experience').getAttribute('aria-hidden'), 'true');
    window.eval(source);
    assert.equal(window.document.querySelectorAll('#asme-celebration-experience').length, 1);
    dom.window.close();
  });
}
