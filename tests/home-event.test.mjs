import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const markup = fs.readFileSync('Home Page.html', 'utf8');
const script = fs.readFileSync('Calendar Integration.js', 'utf8');
async function render(events) {
  // Exercise the real feed renderer without browser/network dependencies.
  const ids = ['asmeFeaturedTitle', 'asmeFeaturedDescription', 'asmeFeaturedDate', 'asmeFeaturedLocation'];
  const nodes = Object.fromEntries(ids.map(id => {
    assert.ok(markup.includes('id="' + id + '"'));
    return [id, { textContent: '', hidden: false }];
  }));
  const document = {
    getElementById: id => nodes[id],
    querySelector: selector => {
      assert.equal(selector, '.ah-featured-button');
      return { href: markup.match(/<a href="([^"]+)" class="ah-featured-button"/)[1] };
    }
  };
  const context = vm.createContext({ document, window: { location: { hostname: 'localhost' } } });
  vm.runInContext(script.slice(0, script.indexOf('  function campaignPageFor')) + '\nrenderHome(' + JSON.stringify(events) + ');})();', context);
  return { window: { document, close() {} } };
}
const event = { title: 'Future chapter event', start: '2090-11-19T22:30:00Z', end: '2090-11-19T23:30:00Z', description: '<b>Bring a friend</b>', location: 'Scott E141' };
test('home feature keeps feed data and the calendar destination', async () => {
  const dom = await render([event]);
  try {
    const d = dom.window.document;
    assert.equal(d.getElementById('asmeFeaturedTitle').textContent, event.title);
    assert.equal(d.getElementById('asmeFeaturedDescription').textContent, 'Bring a friend');
    assert.equal(d.getElementById('asmeFeaturedLocation').textContent, event.location);
    assert.match(d.getElementById('asmeFeaturedDate').textContent, /5:30 PM–6:30 PM/);
    assert.equal(d.querySelector('.ah-featured-button').href, 'https://org.osu.edu/asme/calendar/');
  } finally { dom.window.close(); }
});
test('missing optional fields disappear and a missing end time adds no placeholder', async () => {
  const dom = await render([{ ...event, end: undefined, location: undefined, description: undefined }]);
  try {
    const d = dom.window.document;
    for (const id of ['asmeFeaturedDescription', 'asmeFeaturedLocation']) {
      assert.equal(d.getElementById(id).hidden, true);
      assert.equal(d.getElementById(id).textContent, '');
    }
    assert.match(d.getElementById('asmeFeaturedDate').textContent, /5:30 PM$/);
  } finally { dom.window.close(); }
});
test('empty calendar preserves its existing fallback', async () => {
  const dom = await render([]);
  try {
    const d = dom.window.document;
    assert.equal(d.getElementById('asmeFeaturedTitle').textContent, 'Explore the ASME calendar');
    assert.equal(d.getElementById('asmeFeaturedDescription').hidden, false);
    assert.equal(d.getElementById('asmeFeaturedLocation').textContent, 'ASME OSU');
  } finally { dom.window.close(); }
});
