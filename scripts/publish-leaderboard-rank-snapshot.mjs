#!/usr/bin/env node
/*
 * Publish a public, period-scoped rank comparison baseline.  This reads only
 * the sanitized Website Export sheet and writes only display-name/rank pairs.
 * The first successful run intentionally has no previous snapshot.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPORT_ID = '1otAJV_pDkj6xWCVBHbhXPq99sT9L33ZFOdQU59uKXLg';
const QUERY = 'select A,B,C,G where B is not null';
const DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(DIRECTORY, '..', 'data', 'leaderboard-rank-snapshots.json');
const URL = `https://docs.google.com/spreadsheets/d/${EXPORT_ID}/gviz/tq?sheet=Leaderboard_Public&tqx=out:json&tq=${encodeURIComponent(QUERY)}`;
const STATUS_URL = `https://docs.google.com/spreadsheets/d/${EXPORT_ID}/gviz/tq?sheet=System_Status&tqx=out:json&tq=${encodeURIComponent('select A,B where A is not null')}`;

function fail(message) {
  throw new Error(`Leaderboard snapshot: ${message}`);
}

function parseResponse(body) {
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
  if (priorCurrent && priorCurrent.version === current.version && priorCurrent.period === current.period) {
    return { schemaVersion: 1, current: priorCurrent, previous: previousDocument.previous || null };
  }
  return {
    schemaVersion: 1,
    current,
    previous: priorCurrent && priorCurrent.period === current.period ? priorCurrent : null
  };
}

async function main() {
  const statusResponse = await fetch(STATUS_URL, { headers: { accept: 'application/json' } });
  if (!statusResponse.ok) fail(`system-status request failed with ${statusResponse.status}.`);
  if (!isLiveSystemStatus(parseResponse(await statusResponse.text()))) {
    console.log('Leaderboard snapshot not published because the public point system is not LIVE.');
    return;
  }
  const response = await fetch(URL, { headers: { accept: 'application/json' } });
  if (!response.ok) fail(`public export request failed with ${response.status}.`);
  const current = buildCurrentSnapshot(parseResponse(await response.text()));
  let existing = null;
  try { existing = JSON.parse(await fs.readFile(OUTPUT, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const next = nextSnapshot(existing, current);
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const old = existing ? `${JSON.stringify(existing, null, 2)}\n` : '';
  if (serialized === old) {
    console.log('Leaderboard snapshot is already current.');
    return;
  }
  await fs.writeFile(OUTPUT, serialized);
  console.log(`Published ${next.current.period} ${next.current.version}; ${next.previous ? 'comparison baseline retained.' : 'no prior baseline yet.'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
