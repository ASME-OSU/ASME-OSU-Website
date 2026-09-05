import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd();
const fixture='/private/tmp/asme-header-live.html';
const safe=new Set(['Header.html','Header Embed.html','Header.css','Header Integration.js','Footer.html']);
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/source'){
    const file=url.searchParams.get('file');if(!safe.has(file)){res.writeHead(404);return res.end();}
    const source=fs.readFileSync(path.join(root,file),'utf8').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html lang="en"><title>ASME header source</title><label>Prepared HTML<textarea id="prepared-source">'+source+'</textarea></label></html>');
  }
  if(url.pathname==='/'){
    let html=fs.readFileSync(fixture,'utf8');
    const embed=fs.readFileSync(path.join(root,'Header Embed.html'),'utf8').replaceAll('https://asme-osu.github.io/ASME-OSU-Website/','/');
    html=html.replace('</body>',embed+'</body>');
    res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
  }
  const file=decodeURIComponent(url.pathname.slice(1));if(!safe.has(file)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/html');res.end(fs.readFileSync(path.join(root,file)));
}).listen(4178,'127.0.0.1',()=>console.log('Header preview: http://127.0.0.1:4178/'));
