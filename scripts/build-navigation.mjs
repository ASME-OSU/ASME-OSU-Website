import fs from 'node:fs';

// Both existing delivery paths stay self-contained and share the same guard.
const source = fs.readFileSync('Mobile Navigation.js', 'utf8').trimEnd();
const check = process.argv.includes('--check');
const targets = [
  {
    file: 'Footer.html',
    marked: /<!-- ASME MOBILE NAVIGATION START -->[\s\S]*?<!-- ASME MOBILE NAVIGATION END -->/,
    legacy: /<script>\s*\(function \(\) \{\s*if \(window\.asmeMobileNavDismissReady\) return;[\s\S]*?<\/script>/,
    block: '<!-- ASME MOBILE NAVIGATION START -->\n<script>\n' + source + '\n</script>\n<!-- ASME MOBILE NAVIGATION END -->'
  },
  {
    file: 'Member Points Integration.js',
    marked: /  \/\* ASME MOBILE NAVIGATION START \*\/[\s\S]*?  \/\* ASME MOBILE NAVIGATION END \*\//,
    legacy: /  \/\* This file is loaded sitewide[\s\S]*?\n  }(?=\n\n  function start\(\))/,
    block: '  /* ASME MOBILE NAVIGATION START */\n' + source.split('\n').map(line => line ? '  ' + line : '').join('\n') + '\n  /* ASME MOBILE NAVIGATION END */'
  }
];
for (const { file, marked, legacy, block } of targets) {
  const original = fs.readFileSync(file, 'utf8');
  const pattern = marked.test(original) ? marked : legacy;
  if (!pattern.test(original)) throw new Error('Mobile navigation block missing in ' + file);
  const result = original.replace(pattern, () => block);
  if (check) {
    if (result !== original) throw new Error(file + ' is stale; run npm run build:navigation');
  } else if (result !== original) {
    fs.writeFileSync(file, result);
  }
}
console.log(check ? 'Navigation embeds match source.' : 'Generated navigation embeds.');
