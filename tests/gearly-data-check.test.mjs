import test from 'node:test';
import assert from 'node:assert/strict';
import {findMissingSponsors,reportSponsorDrift} from '../scripts/check-gearly-data.mjs';
test('sponsor checker warns about a seeded mismatch without throwing',()=>{
  const data={entities:{companies:[{name:'Present & Company'},{name:'Missing Industries'}]}};
  const missing=findMissingSponsors(data,'<h2>Present and Company</h2>');assert.deepEqual(missing,['Missing Industries']);
  const warnings=[];assert.doesNotThrow(()=>reportSponsorDrift(missing,message=>warnings.push(message)));
  assert.match(warnings[0],/missing from the page/);assert.match(warnings[0],/Missing Industries/);
});
test('sponsor checks respect name boundaries and ignore scripts while recognizing aliases',()=>{
  const data={entities:{companies:[{name:'Example Company',aliases:['EXCO']},{name:'Art'},{name:'Script Name'}]}};
  assert.deepEqual(findMissingSponsors(data,'<p>EXCO and Arts support us</p><script>Script Name</script>'),['Art','Script Name']);
  assert.deepEqual(findMissingSponsors({},'<p>Anything</p>'),[]);let warned=false;reportSponsorDrift([],()=>warned=true);assert.equal(warned,false);
});
