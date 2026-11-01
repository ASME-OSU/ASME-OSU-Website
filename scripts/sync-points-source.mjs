/* Publish only the approved current year's sanitized export identity.
 * Draft creation and calendar changes never select a website source. */
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseResponse } from './publish-leaderboard-rank-snapshot.mjs';

const OUTPUT = new URL('../data/points-source.json', import.meta.url);
const CONTROL_ID = '156HoZkWmqjUghT3dXHRhepi7QahsqDvDgcQVs705oRM';
const cell = (row, index) => row?.c?.[index]?.v;
const text = (value) => String(value ?? '').trim();
function flag(value) {
  const clean = text(value).toLowerCase();
  if (['true', '1', 'yes'].includes(clean)) return true;
  if (['false', '0', 'no'].includes(clean)) return false;
  throw new Error('Every annual row needs explicit active/current flags.');
}
export function selectPointsSource(rows) {
  const years = new Set();
  const current = [];
  for (const row of rows) {
    const year = text(cell(row, 0));
    if (!year) continue;
    const match = year.match(/^(\d{4})-(\d{4})$/);
    if (!match || Number(match[2]) !== Number(match[1]) + 1 || years.has(year)) throw new Error('Invalid or duplicate academic year.');
    years.add(year);
    const active = flag(cell(row, 3));
    const selected = flag(cell(row, 4));
    if (selected) {
      if (!active) throw new Error('The current year must be active.');
      current.push(row);
    }
  }
  if (current.length !== 1) throw new Error('Exactly one approved current year is required.');
  const row = current[0];
  const url = new URL(text(cell(row, 1)));
  const id = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})(?:\/|$)/)?.[1];
  if (url.origin !== 'https://docs.google.com' || !id || text(cell(row, 2)) !== 'Leaderboard_Public') throw new Error('The current year must use the sanitized public leaderboard export.');
  return { schemaVersion: 1, academicYear: text(cell(row, 0)), exportId: id };
}
function queryURL(id, sheet, query) {
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?${new URLSearchParams({ sheet, headers: '1', tqx: 'out:json', tq: query })}`;
}
export async function syncPointsSource({ fetchFn = fetch, readFile = fs.readFile, writeFile = fs.writeFile, dryRun = false } = {}) {
  async function read(id, sheet, query) {
    const response = await fetchFn(queryURL(id, sheet, query), { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Public points source request failed (${response.status}).`);
    return parseResponse(await response.text());
  }
  // Query only the selection and export fields; never publish Control Center rows.
  const rows = await read(CONTROL_ID, 'Hub_Settings_Public', 'select A,D,E,K,L where A is not null');
  const source = selectPointsSource(rows);
  const old = JSON.parse(await readFile(OUTPUT, 'utf8'));
  if (JSON.stringify(source) === JSON.stringify(old)) return { changed: false, source };
  // A changed identity cannot reuse the same year, or switch to TESTING/PAUSED.
  if (source.academicYear === old.academicYear) throw new Error('Changing the export within the current year requires maintainer review.');
  const status = await read(source.exportId, 'System_Status', 'select A,B where A is not null');
  const flags = status.filter((r) => text(cell(r, 0)).toLowerCase() === 'system_status');
  if (flags.length !== 1 || text(cell(flags[0], 1)).toUpperCase() !== 'LIVE') throw new Error('The selected annual public export must be LIVE before switching the website.');
  // Confirm all three public tabs resolve before writing the source file.
  await read(source.exportId, 'Point_Values_Public', 'select A,B,C,D,E,F limit 1');
  await read(source.exportId, 'Leaderboard_Public', 'select A,B,C,D,E,F,G,H,I,J,K,L,M,N,O limit 1');
  if (!dryRun) await writeFile(OUTPUT, `${JSON.stringify(source, null, 2)}\n`);
  return { changed: true, source, dryRun };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncPointsSource({ dryRun: process.argv.includes('--dry-run') }).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
