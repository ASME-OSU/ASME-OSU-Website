import fs from 'node:fs';
import { parse, generate } from 'css-tree';
const sourcePath = 'ASME Custom CSS.css';
const marker = '/* ASME SHARED DESIGN SYSTEM START */';
const end = '/* ASME SHARED DESIGN SYSTEM END */';
const existing = fs.readFileSync(sourcePath, 'utf8');
const legacy = existing.split(marker)[0].trimEnd();
const source = legacy + '\n\n' + marker + '\n' + fs.readFileSync('styles/design-system.css', 'utf8').trim() + '\n' + end + '\n';
// Preserve every rule and its order; no selector merging or cascade rewrites.
const minified = generate(parse(source)) + '\n';
if (generate(parse(minified)) !== generate(parse(source))) throw new Error('CSS round-trip mismatch');
const files = new Map([[sourcePath, source], ['ASME Custom CSS.min.css', minified]]);
for (const [path, content] of files) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(path) || fs.readFileSync(path, 'utf8') !== content) throw new Error(path + ' is stale; run npm run build:styles');
  } else fs.writeFileSync(path, content);
}
console.log(`Styles verified: ${Buffer.byteLength(source)} source bytes → ${Buffer.byteLength(minified)} minified bytes.`);
