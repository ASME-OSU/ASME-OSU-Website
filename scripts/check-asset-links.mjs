import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = '/ASME-OSU-Website/';
const published = /https:\/\/asme-osu\.github\.io\/ASME-OSU-Website\/[^\s"'\x60<>{}()[\]\\,;]+/g;
const checkedFiles = readdirSync(root, { withFileTypes: true })
  .filter(entry => entry.isFile() && /(?: Page\.html$|^Header.*\.html$|^(?:Footer|Gearly Embed)\.html$|\.js$)/.test(entry.name))
  .map(entry => entry.name)
  .sort();

let checked = 0;
let failures = 0;
for (const file of checkedFiles) {
  const lines = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const [url] of line.matchAll(published)) {
      let asset;
      let stat;
      try {
        const pathname = new URL(url).pathname;
        if (!pathname.startsWith(base)) throw new Error('URL leaves the published root');
        asset = decodeURIComponent(pathname.slice(base.length));
        const filename = path.resolve(root, asset);
        const relative = path.relative(root, filename);
        if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || asset.includes('\0')) {
          throw new Error('Asset path leaves the repository');
        }
        stat = statSync(filename, { throwIfNoEntry: false });
      } catch {
        console.error(file + ':' + (index + 1) + ' invalid published asset URL ' + url);
        failures += 1;
        continue;
      }

      // Directory prefixes in loaders are expanded into asset URLs at runtime.
      if (asset.endsWith('/') ? stat?.isDirectory() : stat?.isFile()) {
        checked += 1;
      } else {
        failures += 1;
        console.error(file + ':' + (index + 1) + ' missing published asset ' + asset);
      }
    }
  }
}
if (failures) process.exitCode = 1;
else console.log('Published asset links verified: ' + checked + ' present.');
