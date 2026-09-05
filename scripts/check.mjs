import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as css from 'css-tree';
import { JSDOM } from 'jsdom';
for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.js'))) execFileSync(process.execPath,['--check',name]);
for(const name of fs.readdirSync('scripts').filter(n=>n.endsWith('.mjs'))) execFileSync(process.execPath,['--check',`scripts/${name}`]);
for(const name of ['styles/legacy.css','styles/refinements.css','ASME Custom CSS.css']) css.parse(fs.readFileSync(name,'utf8'));
for(const name of fs.readdirSync('.').filter(n=>n.endsWith('.html'))) {
 const dom=new JSDOM(fs.readFileSync(name,'utf8'));const ids=new Set();
 for(const el of dom.window.document.querySelectorAll('[id]')) {if(ids.has(el.id))throw new Error(`${name}: duplicate ID ${el.id}`);ids.add(el.id);}
 for(const s of dom.window.document.querySelectorAll('script:not([src])')) {if(s.textContent.trim())new Function(s.textContent);}
 dom.window.close();
}
console.log('All integrations, build scripts, stylesheets, HTML IDs, and inline scripts passed.');
