import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildRecords, checkContents} from '../scripts/build-gearly-index.mjs';
const page = {id:'resources',title:'Resources',sourceFile:'Member Resources Page.html',url:'https://org.osu.edu/asme/member-resources/'};
const source = `<main data-gearly="resources"><h1>Resources</h1>
<section id="career" data-gearly="career"><h2>Career Tools</h2><p>${'Resume resources. '.repeat(40)}</p></section>
<section><header><h2>Technical Training</h2></header><div data-gearly="training"><p>Workshop support.</p></div></section>
<form><section id="field"><h2>Private Form Fields</h2><input id="name"></section></form>
<div id="join-modal"><h2>Modal Heading</h2><section id="modal-child"><h3>Modal child</h3></section></div>
<section><h2>Unanchored Support</h2><p>Support details.</p></section></main>`;
const code = fs.readFileSync('assets/gearly/gearly-search.js','utf8');
function searchAPI() { const context = {module:{exports:{}},URL,AbortSignal};vm.runInNewContext(code,context); return context.module.exports; }
test('registry prefers ids, derives nearby titles and bounds snippets, excluding form and modal internals',()=>{
  const result=buildRecords([page],()=>source); assert.equal(result.version,2);
  const sections=result.records[0].sections;
  assert.ok(sections.some(s=>s.selector==='#career' && s.title==='Career Tools'));
  assert.ok(sections.some(s=>s.selector==="[data-gearly='training']"));
  assert.ok(!sections.some(s=>s.selector.includes('field')||s.selector.includes('modal')||s.selector.includes('name')));
  assert.ok(sections.every(s=>s.snippet.length<=300 && s.pageId==='resources' && Array.isArray(s.keywords)));
  assert.deepEqual(result.warnings[0].headings,['Unanchored Support']);
});
test('registry retains source and route allowlists and detects stale output',()=>{
  assert.throws(()=>buildRecords([{...page,sourceFile:'Secret.html'}],()=>source),/Unapproved search source/);
  assert.throws(()=>buildRecords([{...page,url:'https://evil.example/asme/'}],()=>source),/Unapproved route/);
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'gearly-index-'));
  try { const output=path.join(directory,'index.json');fs.writeFileSync(output,'current');assert.doesNotThrow(()=>checkContents(output,'current'));assert.throws(()=>checkContents(output,'stale'),/index is stale/); } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('section search ranks heading hits above body hits and returns validated scroll actions',()=>{
  const records=buildRecords([page],()=>source).records;
  records[0].sections.push({id:'body',pageId:'resources',selector:'#body',title:'Other Support',snippet:'Career tools resume support.',keywords:[]});
  const result=searchAPI().rankSections(records,'career tools');
  assert.equal(result[0].selector,'#career');assert.equal(result[0].score,12);
  assert.deepEqual(JSON.parse(JSON.stringify(result[0].action)),{type:'scrollTo',page:'https://org.osu.edu/asme/member-resources/',selector:'#career',title:'Career Tools',label:'Show Career Tools'});
  assert.equal(searchAPI().rankSections(records,'interstellar mortgages').length,0);
});
test('section search excludes unsafe pages, selectors and mismatched page identities',()=>{
  const api=searchAPI(); const section={id:'one',pageId:'resources',selector:'#career',title:'Career tools',snippet:'Career tools'};
  for(const record of [
    {...page,url:'javascript:alert(1)',sections:[section]},
    {...page,url:'https://name:pass@org.osu.edu/asme/',sections:[section]},
    {...page,sections:[{...section,selector:'body'}]},
    {...page,sections:[{...section,selector:'#career-modal'}]},
    {...page,sections:[{...section,pageId:'other'}]},
    {...page,sections:[{...section,selector:"[data-gearly='x'] a"}]}
  ]) assert.equal(api.rankSections([record],'career tools').length,0);
});
test('page and section searches share the lazy cached public index',async()=>{
  let requests=0;
  const context={URL,AbortSignal,fetch:async()=>{requests++;return {ok:true,json:async()=>buildRecords([page],()=>source)};}};
  vm.runInNewContext(code,context);context.GearlySearch.configure({assetBase:'https://asme-osu.github.io/ASME-OSU-Website/assets/gearly/'});
  assert.equal(requests,0); assert.ok((await context.GearlySearch.findSections('career tools')).length);
  const registry=await context.GearlySearch.sections(); assert.ok(registry.some(s=>s.page==='https://org.osu.edu/asme/member-resources/' && s.selector==='#career'));
  await context.GearlySearch.find('career tools');assert.equal(requests,1);
});
test('all approved source pages build sections without widening the source allowlist or page text limit',()=>{
  const data=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json','utf8'));
  const built=buildRecords(data.pages,sourceFile=>fs.readFileSync(sourceFile,'utf8'));
  assert.equal(built.records.length,data.pages.length);
  assert.ok(built.records.every(record=>Array.isArray(record.sections) && record.text.length<=14000));
  const sponsorship=built.records.find(record=>record.id==='sponsorship');
  assert.ok(sponsorship.sections.some(section=>section.selector==="[data-gearly='sponsor-tiers']" && section.title==='Sponsorship Tiers'));
  const resources=built.records.find(record=>record.id==='resources');
  for(const selector of ['#getting-started','#events-calendar','#professional-dev','#forms-admin']) assert.ok(resources.sections.some(section=>section.selector===selector));
  assert.ok(built.warnings.some(warning=>warning.title==='Current Sponsors' && warning.headings.length));
});


test('warnings contain only actionable section headings, excluding cards, past boards, forms, modals and hidden elements', () => {
  const leadership = {id:'leadership', title:'Leadership', sourceFile:'Leadership Page.html', url:'https://org.osu.edu/asme/leadership/'};
  const html = '<h1>Leadership</h1><h2>Current Board</h2><h3>Card role</h3><h4>Card name</h4><article class="leader-card"><h2>Leader details</h2></article><div class="lb-past-years"><h2>Past Board</h2></div><div class="lb-year-panel"><h2>Older Board</h2></div><form><h2>Form Heading</h2></form><div role="dialog"><h2>Dialog Heading</h2></div><div class="sponsor-modal"><h2>Modal Heading</h2></div><section hidden><h2>Hidden Heading</h2></section>';
  assert.deepEqual(buildRecords([leadership], () => html).warnings[0].headings, ['Leadership','Current Board']);
});

test('requested page anchors are indexed with page prefixes while existing selectors remain available', () => {
  const data = JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json','utf8'));
  const records = buildRecords(data.pages, file => fs.readFileSync(file,'utf8')).records;
  const expected = {about:['about-audiences','about-professional-growth','about-active-network','about-achievement-award','about-involvement-path','about-see-asme'],sponsorship:['sponsor-benefits','sponsor-tiers'],home:['home-get-involved','home-join','home-events','home-leadership','home-whats-next'],join:['join-community','join-faq'],leadership:['leadership-current-board']};
  for (const [id, names] of Object.entries(expected)) {
    const record = records.find(record => record.id === id);
    for (const name of names) assert.ok(record.sections.some(section => section.selector === "[data-gearly='"+name+"']"), id+': '+name);
  }
});
