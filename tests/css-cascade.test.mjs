import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanCascade } from '../scripts/audit-css-cascade.mjs';
import { parse, generate } from 'css-tree';
const min = text => generate(parse(text));

test('all selectors in a comma group must have a later winning property', () => {
  assert.equal(cleanCascade('.a,.b{color:red}.a{color:blue}').removed.length, 0);
  assert.equal(min(cleanCascade('.a,.b{color:red}.b{color:green}.a{color:blue}').css), '.b{color:green}.a{color:blue}');
});
test('later conditional rules never erase unconditional or differently conditional fallbacks', () => {
  const result = cleanCascade('.a{color:red}@media(max-width:700px){.a{color:blue}}@media(min-width:701px){.a{color:green}}');
  assert.equal(result.removed.length, 0);
  assert.equal(cleanCascade('@media(max-width:700px){.a{color:red}}.a{color:blue}').removed.length, 1);
});
test('importance is respected and distinct selector specificity is not guessed', () => {
  assert.equal(cleanCascade('.a{color:red!important}.a{color:blue}').removed.length, 0);
  assert.equal(cleanCascade('.a{color:red}.a{color:blue!important}').removed.length, 1);
  assert.equal(cleanCascade('.a{color:red}body .a{color:blue}').removed.length, 0);
});
test('invalid values and vendor selector groups cannot erase portable fallbacks', () => {
  assert.equal(cleanCascade('.a{display:block}.a{display:not-a-display-value}').removed.length, 0);
  assert.equal(cleanCascade('.a{display:-webkit-box}.a{display:flex}').removed.length, 0);
  assert.equal(cleanCascade('.a{color:red}.a,::-webkit-nonstandard{color:blue}').removed.length, 0);
});
test('layers, keyframes, custom properties and shorthand relationships are preserved', () => {
  const result = cleanCascade('.a{margin-left:1px;--tone:red}@layer x{.a{margin-left:2px}}@keyframes a{from{opacity:0}to{opacity:1}}.a{margin:0;--tone:blue}');
  assert.equal(result.removed.length, 0);
});
test('unknown future syntax remains a fallback boundary and generated blocks can be protected', () => {
  assert.equal(cleanCascade('.a{clip-path:none}.a{clip-path:polygon(round 10px,0 0,100% 0,100% 100%)}').removed.length, 0);
  const css='.a{color:red}.a{color:blue}';
  assert.equal(cleanCascade(css,{protectedFrom:0}).removed.length,0);
});
test('cleanup is stable when repeated', () => {
  const first=cleanCascade('.a{color:red;padding:1px}.a{color:blue}.a{padding:2px}');
  assert.equal(cleanCascade(first.css).removed.length,0);
  assert.equal(cleanCascade(first.css).css,first.css);
});

test('empty media and supports shells are removed after their rules are superseded',()=>{
 const result=cleanCascade('@media(max-width:700px){@supports(display:grid){.a{color:red}}}.a{color:blue}');
 assert.equal(min(result.css),'.a{color:blue}');assert.equal(result.emptyGroups,2);
});

test('protected generated suffixes retain even empty groups and their formatting',()=>{
 const tail='/* generated */\n@media(max-width:700px){.a{}}\n   \n';const source='.a{color:red}.a{color:blue}'+tail;
 const result=cleanCascade(source,{protectedFrom:source.indexOf('/* generated */')});assert.ok(result.css.endsWith(tail));
});
