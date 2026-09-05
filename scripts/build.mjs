import fs from 'node:fs';
import crypto from 'node:crypto';
import * as css from 'css-tree';
const release='2026-09-05-audit';
const dir=`releases/${release}`;
fs.mkdirSync(dir,{recursive:true});
const source=fs.readFileSync('styles/legacy.css','utf8')+'\n'+fs.readFileSync('styles/refinements.css','utf8');
const ast=css.parse(source);
let removed=0, declarationsRemoved=0;
// Keep the last identical declaration for the same selector and condition.
// Different values (including browser fallbacks), shorthand interactions,
// media order, and WordPress-specific protections remain intact.
css.walk(ast,{enter(node){
  if(!['StyleSheet','Block'].includes(node.type)||!node.children)return;
  const seen=new Map();
  node.children.forEachRight((rule,item,list)=>{
    if(rule.type!=='Rule')return;
    const selector=css.generate(rule.prelude);
    if(!seen.has(selector))seen.set(selector,new Set());
    const declarations=seen.get(selector);
    rule.block.children.forEachRight((decl,declItem,declList)=>{
      if(decl.type!=='Declaration')return;
      const signature=css.generate(decl);
      if(declarations.has(signature)){declList.remove(declItem);declarationsRemoved++;}
      else declarations.add(signature);
    });
    if(rule.block.children.isEmpty){list.remove(item);removed++;}
  });
}});
const built=css.generate(ast)+'\n';
fs.writeFileSync('ASME Custom CSS.css',built);
fs.writeFileSync(`${dir}/site.css`,built);
for(const [from,to] of Object.entries({'Site Integration.js':'site.js','Sponsor Integration.js':'sponsor.js','Calendar Integration.js':'calendar.js','Member Points Integration.js':'points.js','Gallery Integration.js':'gallery.js'}))fs.copyFileSync(from,`${dir}/${to}`);
const pages=fs.readdirSync('.').filter(name=>name.endsWith('Page.html')||name==='Footer.html');
for(const name of pages)fs.copyFileSync(name,`${dir}/${name}`);
const sponsor=fs.readFileSync('Sponsor ASME Page.html','utf8');
const start=sponsor.indexOf('<div class="asme-tier-summary">');
const end=sponsor.indexOf('  <!-- ONE-TIME DONATION -->');
let overview=sponsor.slice(start,end).replace(/<button[^>]*>[\s\S]*?<\/button>/g,'').replace(/<a[^>]+sponsorship-overview[^>]*>[\s\S]*?<\/a>/g,'');
fs.writeFileSync(`${dir}/sponsorship-overview.html`,`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ASME Ohio State — Annual Sponsorship Overview</title><style>body{font:16px/1.6 system-ui;color:#172334;max-width:900px;margin:40px auto;padding:0 24px}h1{color:#b00;line-height:1.15}table{border-collapse:collapse;width:100%}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}img{display:none}.sponsor-tiers-table{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}.sponsor-tier-card{break-inside:avoid;border-top:3px solid #b00}.sponsor-tier-name{font-weight:bold;font-size:22px}.sponsor-tier-price{font-weight:bold}a{color:#a00}@media(max-width:600px){.sponsor-tiers-table{grid-template-columns:1fr}table{font-size:13px}th,td{padding:5px}}@media print{body{font-size:11pt}.sponsor-tier-card{break-inside:avoid}a{color:inherit}}</style><h1>Partner with ASME at Ohio State</h1><p>Annual sponsorship overview · September 2026</p><p>Support company sessions, professional development, technical programming, and student leadership. Contact <a href="mailto:asme@osu.edu">asme@osu.edu</a> to discuss availability and finalize your partnership.</p>${overview}<p>Current information: <a href="https://org.osu.edu/asme/sponsor-asme/">org.osu.edu/asme/sponsor-asme/</a>. Save or print this overview from your browser.</p></html>`);
const manifest={release,createdAt:'2026-09-05',eventLocations:'Unchanged; room bookings remain in progress.',files:{}};
for(const name of fs.readdirSync(dir)){if(name==='manifest.json')continue;manifest.files[name]=crypto.createHash('sha256').update(fs.readFileSync(`${dir}/${name}`)).digest('hex');}
fs.writeFileSync(`${dir}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
console.log(`CSS: ${source.length} → ${built.length} characters; ${declarationsRemoved} repeated declarations and ${removed} empty rules removed. Release: ${dir}`);
