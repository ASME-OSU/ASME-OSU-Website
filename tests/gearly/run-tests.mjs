import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
const baselineIndex=process.argv.indexOf('--baseline');
const ref=baselineIndex>=0?process.argv[baselineIndex+1]:null;
if(baselineIndex>=0 && !ref)throw new Error('--baseline requires a Git ref');
const source=ref?execFileSync('git',['show',`${ref}:assets/gearly/gearly.js`],{encoding:'utf8'}):fs.readFileSync(new URL('../../assets/gearly/gearly.js',import.meta.url),'utf8');
const sandbox={module:{exports:{}},URL,console};
vm.runInNewContext(source,sandbox,{filename:'gearly.js'});
const engine=sandbox.module.exports;
const raw=JSON.parse(fs.readFileSync(new URL('../../assets/gearly/gearly-data.json',import.meta.url)));
const validated=engine.validateData(raw);
if(validated.errors.length)throw new Error(validated.errors.join('\n'));
const data=validated.data;
function evaluate(c,state){const got=engine.match(data,c.text,state);let ok=(!c.intent || got.intent?.id===c.intent) && (!c.kind || got.kind===c.kind);for(const [key,value] of Object.entries(c.entities || {})){ok=ok && (key==='dateRange'?got.entities.dateRange?.label:got.entities[key])===value;}return {got,ok};}
function runSuite(name,corpus){const confusion=[],stats=new Map();let passed=0,scriptFailures=0,wrongAnswers=0;
for(const c of corpus.cases){const {got,ok}=evaluate(c,engine.createState());const key=c.category||c.intent||c.kind,stat=stats.get(key)||{pass:0,total:0};stat.total++;if(ok){passed++;stat.pass++;}else{if(got.kind==='answer')wrongAnswers++;confusion.push({text:c.text,expectedIntent:c.intent,expectedKind:c.kind,actual:got.intent?.id,kind:got.kind,score:got.score});}stats.set(key,stat);}
for(const script of corpus.scripts||[]){const state=engine.createState();for(const c of script.turns){const {got,ok}=evaluate(c,state);if(!ok){scriptFailures++;confusion.push({script:script.name,text:c.text,expected:c.intent,actual:got.intent?.id,kind:got.kind});}if(got.kind==='answer'){state.lastIntent=got.intent?.id;state.lastEntity=got.entities.role||state.lastEntity;state.slots=Object.assign(state.slots,got.entities);state.unresolvedCount=0;}else state.unresolvedCount++;}}
console.log(`\n${name}${ref?' baseline '+ref:''}`);for(const [key,s] of stats)console.log(`${key}: ${s.pass}/${s.total}`);
console.log(`${name}: ${passed}/${corpus.cases.length} (${(100*passed/corpus.cases.length).toFixed(1)}%); dialogue failures: ${scriptFailures}; wrong confident answers: ${wrongAnswers}`);
if(confusion.length)console.log(`${name} confusions:`,JSON.stringify(confusion,null,2));
return {passed,total:corpus.cases.length,scriptFailures,wrongAnswers};}
const frozen=runSuite('Frozen corpus',JSON.parse(fs.readFileSync(new URL('./utterances.json',import.meta.url))));
const holdout=runSuite('Independent holdout',JSON.parse(fs.readFileSync(new URL('./holdout.json',import.meta.url))));
// The original acceptance gate remains frozen. Holdout reports quality honestly;
// require its separate quality gate after the matcher improvement lands.
if(!ref && (frozen.passed/frozen.total<.9 || frozen.scriptFailures || holdout.passed/holdout.total<.8 || frozen.wrongAnswers || holdout.wrongAnswers))process.exitCode=1;
