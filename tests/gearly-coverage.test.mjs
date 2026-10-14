import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const sandbox={module:{exports:{}},URL};
vm.runInNewContext(fs.readFileSync('assets/gearly/gearly-search.js','utf8'),sandbox);
const api=sandbox.module.exports;
const records=JSON.parse(fs.readFileSync('assets/gearly/gearly-index.json','utf8')).records;
test('every indexed section title retrieves its section or its approved page',()=>{
 const failures=[];
 for(const record of records)for(const section of record.sections || []){
  const question='Show '+section.title;
  const sections=api.rankSections(records,question),pages=api.rank(records,question);
  if(!sections.some(s=>s.page===record.url && s.selector===section.selector) && !pages.some(p=>p.url===record.url))failures.push(record.title+': '+section.title);
 }
 assert.deepEqual(failures,[],'Unreachable sections:\n'+failures.join('\n'));
});
