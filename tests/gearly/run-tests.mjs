import fs from 'node:fs';
import vm from 'node:vm';
const enginePath = new URL('../../assets/gearly/gearly.js', import.meta.url);
const sandbox={module:{exports:{}},URL,console};
vm.runInNewContext(fs.readFileSync(enginePath,'utf8'),sandbox,{filename:'gearly.js'});
const engine=sandbox.module.exports;
const raw=JSON.parse(fs.readFileSync(new URL('../../assets/gearly/gearly-data.json',import.meta.url)));
const validated=engine.validateData(raw);
if(validated.errors.length)throw new Error(validated.errors.join('\n'));
const data=validated.data, corpus=JSON.parse(fs.readFileSync(new URL('./utterances.json',import.meta.url)));
const confusion=[],stats=new Map();let passed=0;
function evaluate(c,state){const got=engine.match(data,c.text,state);let ok=(!c.intent || got.intent?.id===c.intent) && (!c.kind || got.kind===c.kind);for(const [key,value] of Object.entries(c.entities || {})){ok=ok && (key==='dateRange'?got.entities.dateRange?.label:got.entities[key])===value;}return {got,ok};}
for(const c of corpus.cases){const {got,ok}=evaluate(c,engine.createState());const key=c.intent || c.kind, stat=stats.get(key)||{pass:0,total:0};stat.total++;if(ok){passed++;stat.pass++;}else confusion.push({text:c.text,expected:c.intent||c.kind,actual:got.intent?.id,kind:got.kind,score:got.score});stats.set(key,stat);}
let scriptFailures=0;
for(const script of corpus.scripts){const state=engine.createState();for(const c of script.turns){const {got,ok}=evaluate(c,state);if(!ok){scriptFailures++;confusion.push({script:script.name,text:c.text,expected:c.intent,actual:got.intent?.id,kind:got.kind});}if(got.kind==='answer'){state.lastIntent=got.intent?.id;state.lastEntity=got.entities.role||state.lastEntity;state.slots=Object.assign(state.slots,got.entities);state.unresolvedCount=0;}else state.unresolvedCount++;}}
for(const [key,s] of stats)console.log(`${key}: ${s.pass}/${s.total}`);
console.log(`Overall: ${passed}/${corpus.cases.length} (${(100*passed/corpus.cases.length).toFixed(1)}%); dialogue failures: ${scriptFailures}`);
if(confusion.length)console.log('Confusions:',JSON.stringify(confusion,null,2));
if(passed/corpus.cases.length<.9 || scriptFailures)process.exitCode=1;
