import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('assets/gearly/gearly-weighting.js','utf8');
const context={module:{exports:{}}};vm.runInNewContext(code,context);const api=context.module.exports;
test('IDF gives distinctive terms greater weight and counts intent and page documents',()=>{
  const data={intents:[{examples:['chapter robotics'],keywords:{chapter:2}},{examples:['chapter events']},{examples:['chapter support']}]};
  const index={records:[{title:'Chapter resources',sections:[{title:'Scholarships',snippet:'Application support'}]}]};
  const before=JSON.stringify({data,index});const idf=api.buildIDF(data,index);
  assert.equal(idf.documents,4);assert.ok(idf.weights.robotics>idf.weights.chapter);assert.ok(idf.weights.scholarships>0);
  assert.equal(JSON.stringify({data,index}),before);
  assert.ok(api.signal(idf,'chapter robotics','robotics')>api.signal(idf,'chapter robotics','chapter'));
});
test('optional signal is bounded, deterministic, prefix aware and safe for empty inputs',()=>{
  const idf=api.buildIDF({intents:[{examples:['robotics workshop']}]},[]);
  assert.equal(api.signal(idf,'robotics workshop','robotics workshop'),1);
  assert.ok(api.signal(idf,'robot workshop','robotics workshops')>.9);
  assert.equal(api.signal(idf,'interstellar mortgages','robotics workshop'),0);
  assert.equal(api.signal(idf,'show me the','robotics workshop'),0);
  assert.equal(api.signal(null,'',''),0);assert.equal(api.buildIDF(null,null).documents,0);
  assert.equal(api.signal(idf,'workshop','robotics workshop'),api.signal(idf,'workshop','robotics workshop'));
});
test('weighting exposes the same pure API in the browser',()=>{
  const browser={window:{}};vm.runInNewContext(code,browser);assert.equal(typeof browser.window.GearlyWeighting.buildIDF,'function');assert.equal(typeof browser.window.GearlyWeighting.signal,'function');
});

test('when the weighting flag is off, adding the weighting module changes no scores',()=>{
 const core=fs.readFileSync('assets/gearly/gearly.js','utf8').replace('var USE_IDF = true;','var USE_IDF = false;');
 const raw=JSON.parse(fs.readFileSync('assets/gearly/gearly-data.json','utf8'));
 function engine(include){const box={module:{exports:{}},URL};if(include)vm.runInNewContext(code,box);box.module={exports:{}};vm.runInNewContext(core,box);return box.module.exports;}
 const plain=engine(false),withModule=engine(true);
 for(const query of ['career guide','show public photos','sponsor tiers','interstellar mortgage','president treasurer'])assert.equal(JSON.stringify(plain.scoreIntents(plain.validateData(raw).data,query)),JSON.stringify(withModule.scoreIntents(withModule.validateData(raw).data,query)));
});
