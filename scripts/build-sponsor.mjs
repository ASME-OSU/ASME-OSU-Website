import fs from 'node:fs';

// WordPress receives inline copies so script timing and offline behavior stay
// unchanged. Maintain Sponsor Integration.js; regenerate these deployable copies.
const source = fs.readFileSync('Sponsor Integration.js', 'utf8').trimEnd();
const marked = /<!-- ASME SPONSOR INTEGRATION START -->[\s\S]*?<!-- ASME SPONSOR INTEGRATION END -->/;
const legacy = /<script>\s*\(function \(\) \{\s*function initSponsorInquiryForm\(form\)[\s\S]*?<\/script>/;
const check = process.argv.includes('--check');
for (const file of ['Footer.html', 'Sponsor ASME Page.html']) {
  const outer = file === 'Footer.html' ? '' : '  ';
  const inlineSource = source.split('\n').map(line => line ? outer + '  ' + line : '').join('\n');
  const block = '<!-- ASME SPONSOR INTEGRATION START -->\n' + outer + '<script>\n' + inlineSource + '\n' + outer + '</script>\n' + outer + '<!-- ASME SPONSOR INTEGRATION END -->';
  const original = fs.readFileSync(file, 'utf8');
  const pattern = marked.test(original) ? marked : legacy;
  if (!pattern.test(original)) throw new Error('Sponsor integration block missing in ' + file);
  const result = original.replace(pattern, () => block);
  if (check) {
    if (result !== original) throw new Error(file + ' is stale; run npm run build:sponsor');
  } else if (result !== original) {
    fs.writeFileSync(file, result);
  }
}
console.log(check ? 'Sponsor embeds match source.' : 'Generated sponsor embeds.');
