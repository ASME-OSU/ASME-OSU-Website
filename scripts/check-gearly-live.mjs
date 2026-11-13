/** Read-only published-site health audit. No form submissions or member-name queries. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {registeredTargets} from './check-gearly-contract.mjs';

const MAX_BYTES = 2_000_000;
export function approvedURL(value, data) {
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const chapter = new URL(data.meta.siteBase), assets = new URL(data.meta.assetBase);
  // Do not let a configuration edit turn the health checker into an arbitrary fetcher.
  const chapterOK = chapter.origin === 'https://org.osu.edu' && chapter.pathname === '/asme/';
  const assetsOK = assets.origin === 'https://asme-osu.github.io' && assets.pathname === '/ASME-OSU-Website/';
  return chapterOK && url.origin === chapter.origin && url.pathname.startsWith(chapter.pathname) ||
    assetsOK && url.origin === assets.origin && url.pathname.startsWith(assets.pathname) ||
    /^[A-Za-z0-9_-]{10,100}$/.test(data.meta.sheetID || '') && url.origin === 'https://docs.google.com' && url.pathname === `/spreadsheets/d/${data.meta.sheetID}/gviz/tq`;
}

export async function fetchPublicText(value, data, fetcher = fetch) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12_000);
  try {
    let url = new URL(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (!approvedURL(url.href, data)) throw new Error('Unapproved public URL or redirect');
      const response = await fetcher(url.href, {redirect: 'manual', signal: controller.signal, credentials: 'omit', headers: {'User-Agent': 'ASME-Gearly-Health/1.0'}});
      if ([301,302,303,307,308].includes(response.status)) {
        const next = response.headers.get('location');
        if (!next || redirects === 3) throw new Error('Invalid or excessive redirects');
        url = new URL(next, url); continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Oversized public source');
      let text = '', size = 0;
      if (response.body?.getReader) {
        const reader = response.body.getReader(), decoder = new TextDecoder();
        try {
          while (true) {
            const part = await reader.read(); if (part.done) break;
            size += part.value.byteLength;
            if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Oversized public source'); }
            text += decoder.decode(part.value, {stream: true});
          }
          text += decoder.decode();
        } finally { reader.releaseLock(); }
      } else {
        text = await response.text();
        if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Oversized public source');
      }
      return text;
    }
  } finally { clearTimeout(timer); }
}

export function parsePublicTable(text) {
  const match = text.match(/^\s*(?:\/\*[^]*?\*\/\s*)?google\.visualization\.Query\.setResponse\(([^]*)\);?\s*$/);
  if (!match) throw new Error('Malformed public table wrapper');
  const value = JSON.parse(match[1]);
  if (value.status !== 'ok' || !Array.isArray(value.table?.rows)) throw new Error('Public table returned an error');
  return value.table.rows;
}

export async function auditLive(data, index, {fetcher = fetch, now = Date.now()} = {}) {
  const errors = [], warnings = [], checks = [], pages = new Map();
  const targets = registeredTargets(data, index);
  const report = {checkedAt: new Date(now).toISOString(), checks, errors, warnings};
  for (const target of targets) {
    if (!(data.pages || []).some(page => page.url === target.page || page.id === target.page)) errors.push(`${target.label}: published page is not registered (${target.page}).`);
  }
  for (const page of data.pages || []) {
    try {
      const html = await fetchPublicText(page.url, data, fetcher), dom = new JSDOM(html);
      pages.set(page.url, dom);
      const pageTargets = targets.filter(target => target.page === page.url || target.page === page.id);
      const unique = new Map(pageTargets.map(target => [target.selector, target]));
      let templateTargets = 0;
      for (const target of unique.values()) {
        try {
          if (!dom.window.document.querySelector(target.selector)) {
            // The compact shared header is intentionally provisioned as an inert
            // template and mounted by its runtime. Report that contract separately;
            // this audit verifies markup, not browser rendering or animation.
            const provisioned = target.shared && [...dom.window.document.querySelectorAll('template')].some(template => template.content.querySelector(target.selector));
            if (provisioned) templateTargets++;
            else errors.push(`${target.label}: published target missing (${page.url} ${target.selector}).`);
          }
        } catch { errors.push(`${target.label}: invalid published selector (${target.selector}).`); }
      }
      checks.push({source: page.id, status: 'available', targets: unique.size, templateTargets});
    } catch (error) { errors.push(`Page ${page.id}: ${error.message}`); checks.push({source: page.id, status: 'unavailable'}); }
  }
  for (const dom of pages.values()) dom.window.close();
  const feeds = [
    {name:'calendar', file:'calendar-events.json', key:'events', maxAge:3 * 3600000},
    {name:'instagram', file:'instagram-feed.json', key:'items', maxAge:18 * 3600000},
    {name:'photos', file:'google-photos-feed.json', key:'items', maxAge:3 * 86400000}
  ];
  for (const feed of feeds) {
    try {
      const value = JSON.parse(await fetchPublicText(new URL('data/' + feed.file, data.meta.assetBase).href, data, fetcher));
      if (!Array.isArray(value[feed.key])) throw new Error(`Missing ${feed.key} array`);
      const timestamp = value.checkedAt || value.updatedAt || value.generatedAt, instant = Date.parse(timestamp);
      if (!Number.isFinite(instant)) warnings.push(`${feed.name}: refresh time unavailable.`);
      else if (instant > now + 300000) warnings.push(`${feed.name}: refresh time is in the future.`);
      else if (now - instant > feed.maxAge) warnings.push(`${feed.name}: published snapshot is older than its freshness window.`);
      checks.push({source:feed.name, status:'available', entries:value[feed.key].length, updatedAt:Number.isFinite(instant)?new Date(instant).toISOString():null});
    } catch (error) { errors.push(`Source ${feed.name}: ${error.message}`); checks.push({source:feed.name, status:'unavailable'}); }
  }
  // Validate only availability/schema of the public export, never download names,
  // attendance histories, or totals for this monitoring job.
  for (const [sheet, query] of [['System_Status','select A,B where A is not null'],['Point_Values_Public','select A limit 1'],['Leaderboard_Public','select A limit 1']]) {
    const url = new URL(`https://docs.google.com/spreadsheets/d/${data.meta.sheetID}/gviz/tq`);
    url.search = new URLSearchParams({headers:'1',sheet,tq:query,tqx:'out:json'}).toString();
    try {
      const rows = parsePublicTable(await fetchPublicText(url.href, data, fetcher));
      if (sheet === 'System_Status') {
        const status = rows.find(row => row?.c?.[0]?.v === 'system_status')?.c?.[1]?.v;
        if (status !== 'LIVE') warnings.push(`Public points export is not LIVE (${typeof status === 'string' ? status.slice(0,30) : 'unknown'}).`);
      }
      checks.push({source:sheet, status:'available'});
    } catch (error) { errors.push(`Public export ${sheet}: ${error.message}`); checks.push({source:sheet, status:'unavailable'}); }
  }
  return report;
}

const main = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const root = path.resolve(import.meta.dirname, '..');
  const data = JSON.parse(await fs.readFile(path.join(root,'assets/gearly/gearly-data.json'),'utf8'));
  const index = JSON.parse(await fs.readFile(path.join(root,'assets/gearly/gearly-index.json'),'utf8'));
  const report = await auditLive(data, index);
  const output = process.argv.indexOf('--output');
  if (output !== -1) {
    if (!process.argv[output + 1]) throw new Error('--output requires a report path');
    await fs.writeFile(process.argv[output + 1], JSON.stringify(report,null,2)+'\n');
  }
  for (const warning of report.warnings) console.warn(`Gearly health warning: ${warning}`);
  for (const error of report.errors) console.error(`Gearly health error: ${error}`);
  console.log(`Gearly live audit: ${report.checks.length} public sources/pages checked; ${report.errors.length} errors; ${report.warnings.length} warnings.`);
  if (report.errors.length) process.exitCode = 1;
}
