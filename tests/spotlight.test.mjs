import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const footer = fs.readFileSync('Footer.html', 'utf8');
const script = footer.match(/<!-- V11 interactions script -->\s*<script>([\s\S]*?)<\/script>/)[1];
const home = new JSDOM(fs.readFileSync('Home Page.html', 'utf8'));
const spotlight = home.window.document.querySelector('#ahSpotlight').outerHTML;
home.window.close();

function setup(reducedMotion = false) {
  const dom = new JSDOM(spotlight + '<button id="outside">Outside</button>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: reducedMotion });
  w.IntersectionObserver = class { observe() {} unobserve() {} };
  const intervals = new Map();
  let nextId = 0;
  w.setInterval = callback => { intervals.set(++nextId, callback); return nextId; };
  w.clearInterval = id => intervals.delete(id);
  const timeouts = [];
  w.setTimeout = callback => { timeouts.push(callback); return timeouts.length; };
  w.eval(script);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  return { w, d: w.document, intervals, flush: () => { while (timeouts.length) timeouts.shift()(); }, close: () => w.close() };
}

test('reduced-motion keyboard users can select and reach the Career Guide', () => {
  const s = setup(true);
  try {
    const dots = [...s.d.querySelectorAll('[data-spotlight-dot]')];
    const link = s.d.querySelector('.ah-career-guide-link');
    dots[0].focus();
    assert.equal(link.tabIndex, -1);
    function key(value) { s.d.activeElement.dispatchEvent(new s.w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
    key('ArrowRight');
    assert.equal(s.d.activeElement, dots[1]);
    assert.equal(link.tabIndex, 0);
    assert.equal(dots[1].getAttribute('aria-selected'), 'true');
    const panel = s.d.getElementById(dots[1].getAttribute('aria-controls'));
    assert.equal(panel.getAttribute('role'), 'tabpanel');
    assert.equal(panel.getAttribute('aria-labelledby'), dots[1].id);
    assert.equal(panel.getAttribute('aria-hidden'), 'false');
    key('ArrowRight');
    assert.equal(s.d.activeElement, dots[0]);
    key('ArrowLeft');
    assert.equal(s.d.activeElement, dots[1]);
    key('Home');
    assert.equal(s.d.activeElement, dots[0]);
    key('End');
    assert.equal(s.d.activeElement, dots[1]);
    assert.equal(s.intervals.size, 0);
  } finally { s.close(); }
});

test('spotlight rotation stays paused until both hover and keyboard focus leave', () => {
  const s = setup();
  try {
    const root = s.d.querySelector('#ahSpotlight');
    const dots = [...s.d.querySelectorAll('[data-spotlight-dot]')];
    assert.equal(s.intervals.size, 1);
    dots[1].focus();
    dots[1].click();
    assert.equal(s.intervals.size, 0, 'click must not restart rotation while focused');
    root.dispatchEvent(new s.w.MouseEvent('mouseenter'));
    root.dispatchEvent(new s.w.MouseEvent('mouseleave'));
    assert.equal(s.intervals.size, 0, 'mouse exit must preserve focus pause');
    root.dispatchEvent(new s.w.MouseEvent('mouseenter'));
    s.d.querySelector('#outside').focus();
    s.flush();
    assert.equal(s.intervals.size, 0, 'focus exit must preserve hover pause');
    root.dispatchEvent(new s.w.MouseEvent('mouseleave'));
    assert.equal(s.intervals.size, 1);
    [...s.intervals.values()][0]();
    assert.equal(dots[0].getAttribute('aria-selected'), 'true', 'rotation resumes after leaving');
  } finally { s.close(); }
});
