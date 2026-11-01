import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const css = (await Promise.all(['celebration.css', 'join-three-step.css'].map(name => readFile(new URL(name, root), 'utf8')))).join('\n');
const path = new URL('Join Page.html', root);
const page = await readFile(path, 'utf8');
const block = '<style id="asme-join-page-styles">\n' + css + '\n</style>';
const updated = page.replace(/<style id="asme-join-page-styles">[\s\S]*?<\/style>/, () => block);
if (!page.includes('<style id="asme-join-page-styles">')) throw new Error('Join critical style block missing');
if (process.argv.includes('--check')) {
  if (updated !== page) throw new Error('Run node scripts/sync-join-styles.mjs before publishing');
} else await writeFile(path, updated);
