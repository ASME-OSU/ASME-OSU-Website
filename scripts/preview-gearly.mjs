import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const pages = new Set(['Home Page.html', 'Join Page.html', 'Calendar Page.html', 'Member Points Page.html', 'Gallery Page.html', 'Leadership Page.html']);
const types = { '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    const selected = url.searchParams.get('page') || 'Home Page.html';
    if (!pages.has(selected)) { res.writeHead(404); return res.end(); }
    const content = fs.readFileSync(path.join(root, selected), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    const embed = fs.readFileSync(path.join(root, 'Gearly Embed.html'), 'utf8').replaceAll('https://asme-osu.github.io/ASME-OSU-Website/', '/').replaceAll('.css?v=', '.css?scheme=' + (url.searchParams.get('scheme') === 'light' ? 'light' : 'dark') + '&v=');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Gearly review preview</title><link rel="stylesheet" href="/ASME%20Custom%20CSS.css?scheme=${url.searchParams.get('scheme') === 'light' ? 'light' : 'dark'}"><body><div id="page"><nav id="site-navigation" aria-label="Preview pages">${[...pages].map(p => `<a class="${p==='Join Page.html'?'asme-hd-join':''}" style="margin:8px" href="/?page=${encodeURIComponent(p)}">${p.replace(' Page.html', '')}</a>`).join('')}</nav><main class="entry-content">${content}</main></div>${embed}</body></html>`);
  }
  let file;
  try { file = decodeURIComponent(url.pathname.slice(1)); } catch { res.writeHead(400); return res.end(); }
  const target = path.resolve(root, file);
  const allowed = file === 'ASME Custom CSS.css' || /^(assets\/gearly\/|data\/)/.test(file);
  if (!allowed || !target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
  let bytes = fs.readFileSync(target);
  if (file.endsWith('.css') && ['light', 'dark'].includes(url.searchParams.get('scheme'))) bytes = bytes.toString().replace(/prefers-color-scheme:\s*dark/g, url.searchParams.get('scheme') === 'light' ? 'max-width:0px' : 'min-width:0px');
  res.end(bytes);
});
const port = Number(process.env.GEARLY_PREVIEW_PORT || 4180);
server.listen(port, '127.0.0.1', () => console.log('Gearly preview: http://127.0.0.1:' + port + '/ (Ctrl+C to stop)'));
