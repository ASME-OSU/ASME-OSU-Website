import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('Mobile Navigation.js', 'utf8');
const points = fs.readFileSync('Member Points Integration.js', 'utf8');
const footer = fs.readFileSync('Footer.html', 'utf8').match(/<!-- ASME MOBILE NAVIGATION START -->\s*<script>([\s\S]*?)<\/script>/)[1];
const markup = `<nav id="site-navigation" class="main-navigation toggled">
<button class="menu-toggle">Menu</button><div class="main-nav"><ul>
<li id="first" class="menu-item-has-children sfHover"><a href="#first"><button class="dropdown-menu-toggle" aria-expanded="true">First</button></a><ul><li><a href="#one">One</a></li></ul></li>
<li id="second" class="menu-item-has-children"><a href="#second"><button class="dropdown-menu-toggle" aria-expanded="false">Second</button></a></li>
</ul></div></nav><button id="outside">Outside</button>`;
function setup(scripts = [source], mobile = true) {
  const dom = new JSDOM(markup, { runScripts: 'outside-only', url: 'https://org.osu.edu/asme/' });
  dom.window.matchMedia = () => ({ matches: mobile });
  const nav = dom.window.document.getElementById('site-navigation');
  let toggles = 0;
  nav.querySelector('.menu-toggle').addEventListener('click', () => { toggles++; nav.classList.toggle('toggled'); });
  scripts.forEach(script => dom.window.eval(script));
  return { dom, nav, toggleCount: () => toggles };
}
for (const [name, scripts] of [['source', [source]], ['footer', [footer]], ['points', [points]], ['footer then points', [footer, points]], ['points then footer', [points, footer]]]) {
  test(`${name}: outside click closes once, suppresses the click, and clears submenus`, () => {
    const { dom, nav, toggleCount } = setup(scripts);
    const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
    dom.window.document.getElementById('outside').dispatchEvent(event);
    assert.equal(nav.classList.contains('toggled'), false);
    assert.equal(toggleCount(), 1);
    assert.equal(event.defaultPrevented, true);
    assert.equal(nav.querySelector('.dropdown-menu-toggle').getAttribute('aria-expanded'), 'false');
    assert.equal(nav.querySelector('.dropdown-menu-toggle').getAttribute('aria-label'), 'Open Sub-Menu');
    dom.window.close();
  });
}
test('Escape closes the fallback menu and returns focus to its toggle', () => {
  const { dom, nav } = setup();
  dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  assert.equal(nav.classList.contains('toggled'), false);
  assert.equal(dom.window.document.activeElement, nav.querySelector('.menu-toggle'));
  dom.window.close();
});
test('desktop outside clicks remain unaffected', () => {
  const { dom, nav, toggleCount } = setup([source], false);
  const event = new dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
  dom.window.document.getElementById('outside').dispatchEvent(event);
  assert.equal(nav.classList.contains('toggled'), true);
  assert.equal(toggleCount(), 0);
  assert.equal(event.defaultPrevented, false);
  dom.window.close();
});
test('opening a submenu preserves it and closes only its siblings after the theme handler', async () => {
  const { dom, nav } = setup();
  const second = dom.window.document.getElementById('second');
  const toggle = second.querySelector('.dropdown-menu-toggle');
  toggle.addEventListener('click', event => { event.preventDefault(); second.classList.add('sfHover'); toggle.setAttribute('aria-expanded', 'true'); });
  toggle.click();
  await new Promise(resolve => dom.window.setTimeout(resolve, 10));
  assert.equal(nav.classList.contains('toggled'), true);
  assert.equal(second.classList.contains('sfHover'), true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(dom.window.document.getElementById('first').classList.contains('sfHover'), false);
  dom.window.close();
});
