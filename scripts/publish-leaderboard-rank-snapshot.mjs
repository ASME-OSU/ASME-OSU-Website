#!/usr/bin/env node
/*
 * Publish a public, period-scoped rank comparison baseline.  This reads only
 * the sanitized Website Export sheet and writes only display-name/rank pairs.
 * The first successful run intentionally has no previous snapshot.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUERY = 'select A,B,C,G where B is not null';
const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(DIRECTORY, '..', 'data', 'leaderboard-rank-snapshots.json');
const leaderboardURL = (EXPORT_ID) => `https://docs.google.com/spreadsheets/d/${EXPORT_ID}/gviz/tq?sheet=Leaderboard_Public&tqx=out:json&tq=${encodeURIComponent(QUERY)}`;
/* Match the browser's authoritative status request exactly. Google can serve
   a stale/incomplete result when this sheet is queried without headers=1. */
const statusURL = (EXPORT_ID) => `https://docs.google.com/spreadsheets/d/${EXPORT_ID}/gviz/tq?sheet=System_Status&headers=1&tqx=out:json&tq=${encodeURIComponent('select A,B where A is not null')}`;

function fail(message) {
  throw new Error(`Leaderboard snapshot: ${message}`);
}

export function parseResponse(body) {
  const match = String(body).match(/setResponse\((.*)\);\s*$/s);
  if (!match) fail('Google export did not return a visualization response.');
  const payload = JSON.parse(match[1]);
  if (payload.status !== 'ok' || !payload.table) fail('Google export did not return a table.');
  return payload.table.rows || [];
}

function cell(row, index) {
  const value = row?.c?.[index];
  return value && value.v !== null && value.v !== undefined ? String(value.v).trim() : '';
}

function displayCell(row, index) {
  const value = row?.c?.[index];
  return value && value.f ? String(value.f).trim() : cell(row, index);
}

export function buildCurrentSnapshot(rows) {
  const ranks = {};
  const duplicates = new Set();
  let version = '';
  let period = '';

  rows.forEach((row) => {
    const rank = Number(cell(row, 0));
    const name = cell(row, 1);
    const rowPeriod = cell(row, 2);
    const rowVersion = displayCell(row, 3);
    const key = name.toLowerCase();
    if (!name || !Number.isFinite(rank) || rank <= 0 || !rowPeriod || !rowVersion) fail('a row is missing a public name, positive rank, period, or version.');
    if (!period) period = rowPeriod;
    if (!version) version = rowVersion;
    if (period !== rowPeriod || version !== rowVersion) fail('the export contains more than one period or version.');
    if (Object.hasOwn(ranks, key)) {
      delete ranks[key];
      duplicates.add(key);
    } else if (!duplicates.has(key)) {
      ranks[key] = rank;
    }
  });

  if (!period || !version || !Object.keys(ranks).length) fail('the export has no unique public ranked members.');
  return { version, period, ranks };
}

export function isLiveSystemStatus(rows) {
  return rows.some((row) => cell(row, 0).toLowerCase() === 'system_status' && cell(row, 1).toUpperCase() === 'LIVE');
}

export function nextSnapshot(previousDocument, current) {
  const priorCurrent = previousDocument && previousDocument.current;
  if (priorCurrent && priorCurrent.period === current.period && current.version < priorCurrent.version) {
    fail('refusing to replace a newer published snapshot with an older export.');
  }
  const sameRanks = priorCurrent && priorCurrent.period === current.period &&
    Object.keys(priorCurrent.ranks).length === Object.keys(current.ranks).length &&
    Object.keys(current.ranks).every((key) => priorCurrent.ranks[key] === current.ranks[key]);
  if (priorCurrent && priorCurrent.version === current.version && priorCurrent.period === current.period) {
    if (!sameRanks) fail('rank data changed without a new export version.');
    return { schemaVersion: 1, current: priorCurrent, previous: previousDocument.previous || null };
  }
  return {
    schemaVersion: 1,
    current,
    previous: sameRanks ? previousDocument.previous || null : priorCurrent && priorCurrent.period === current.period ? priorCurrent : null
  };
}

export async function publishSnapshot({
  fetchFn = fetch,
  readFile = fs.readFile,
  writeFile = fs.writeFile,
  output = OUTPUT,
  dryRun = false,
  source = null
} = {}) {
  source ||= JSON.parse(await fs.readFile(path.join(DIRECTORY, '..', 'data', 'points-source.json'), 'utf8'));
  if (source.schemaVersion !== 1 || !/^[A-Za-z0-9_-]{20,}$/.test(source.exportId)) fail('invalid points source.');
  const EXPORT_ID = source.exportId;
  const statusResponse = await fetchFn(statusURL(EXPORT_ID), { headers: { accept: 'application/json' } });
  if (!statusResponse.ok) fail(`system-status request failed with ${statusResponse.status}.`);
  const statusRows = parseResponse(await statusResponse.text());
  const statusValues = statusRows.filter((row) => cell(row, 0).toLowerCase() === 'system_status');
  if (statusValues.length !== 1 || !cell(statusValues[0], 1)) fail('system status is missing or ambiguous.');
  const live = isLiveSystemStatus(statusRows);
  let current = null;
  if (live) {
    const response = await fetchFn(leaderboardURL(EXPORT_ID), { headers: { accept: 'application/json' } });
    if (!response.ok) fail(`public export request failed with ${response.status}.`);
    current = buildCurrentSnapshot(parseResponse(await response.text()));
  }
  let old = '';
  try { old = await readFile(output, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  // A public file remains directly readable when the website hides its UI.
  // Publish an empty projection on non-LIVE status so both retained baselines
  // disappear from the current public artifact without reading member rows.
  const previousDocument = old ? JSON.parse(old) : null;
  const next = live ? { ...nextSnapshot(previousDocument?.exportId === EXPORT_ID ? previousDocument : null, current), exportId: EXPORT_ID }
    : { schemaVersion: 1, current: null, previous: null };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  if (serialized === old) {
    console.log('Leaderboard snapshot is already current.');
    return { published: false, reason: 'unchanged', snapshot: next };
  }
  if (dryRun) {
    console.log(live ? `Dry run: would publish ${next.current.period} ${next.current.version}; ${next.previous ? 'comparison baseline retained.' : 'no prior baseline yet.'}`
      : 'Dry run: would clear both public rank baselines because the point system is not LIVE.');
    return { published: false, reason: 'dry-run', snapshot: next };
  }
  await writeFile(output, serialized);
  console.log(live ? `Published ${next.current.period} ${next.current.version}; ${next.previous ? 'comparison baseline retained.' : 'no prior baseline yet.'}`
    : 'Cleared both public rank baselines because the point system is not LIVE.');
  return { published: true, reason: live ? 'live' : 'not-live', snapshot: next };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) publishSnapshot({ dryRun: process.argv.includes('--dry-run') }).catch((error) => { console.error(error.message); process.exitCode = 1; });
