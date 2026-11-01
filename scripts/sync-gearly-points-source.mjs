import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
export function projectGearlySource(data, source) {
  if (source?.schemaVersion !== 1 || !/^[A-Za-z0-9_-]{20,}$/.test(source.exportId) || !data?.meta) throw new Error('Invalid public points source or Gearly configuration.');
  return { ...data, meta: { ...data.meta, sheetID: source.exportId } };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = new URL('../assets/gearly/gearly-data.json', import.meta.url);
  const data = JSON.parse(await fs.readFile(file, 'utf8'));
  const source = JSON.parse(await fs.readFile(new URL('../data/points-source.json', import.meta.url), 'utf8'));
  const next = projectGearlySource(data, source);
  if (data.meta.sheetID !== next.meta.sheetID) await fs.writeFile(file, `${JSON.stringify(next, null, 2)}\n`);
  console.log('Gearly uses the approved public points source.');
}
