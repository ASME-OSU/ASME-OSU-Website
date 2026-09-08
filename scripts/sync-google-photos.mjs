import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchImageUrls } from '@marcus5914/google-photos-album-image-url-fetch';

const SHARE_URL = 'https://photos.app.goo.gl/33pfCCghnJbXPzho9';
const ALBUM_TITLE = 'Public Website ASME Photos';
const OUTPUT = path.resolve('data/google-photos-feed.json');
const ASSET_DIRECTORY = path.resolve('assets/gallery/google-photos-auto');
const ASSET_BASE = 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/google-photos-auto';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const USER_AGENT = 'Mozilla/5.0 (compatible; ASME-OSU-gallery-sync/1.0; +https://github.com/ASME-OSU/ASME-OSU-Website)';

function fail(message) { throw new Error(`Google Photos sync: ${message}`); }

function allowedImageUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)googleusercontent\.com$/i.test(url.hostname);
  } catch { return false; }
}

function jsonValueEnd(text, start) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"') quote = character;
    else if (character === '[' || character === '{') depth += 1;
    else if (character === ']' || character === '}') {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }
  return -1;
}

function htmlTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1].replace(/&amp;/g, '&').trim() || '';
}

function parseBootstrapData(html) {
  const callback = html.indexOf("key: 'ds:1'");
  const dataStart = callback < 0 ? -1 : html.indexOf('data:', callback) + 5;
  if (dataStart < 5 || html[dataStart] !== '[') fail('public bootstrap data block ds:1 was not found.');
  const dataEnd = jsonValueEnd(html, dataStart);
  if (dataEnd < 0) fail('public bootstrap data block was truncated.');
  try { return JSON.parse(html.slice(dataStart, dataEnd)); }
  catch { fail('public bootstrap data block was not valid JSON.'); }
}

/**
 * Parse server-delivered data only. This never evaluates Google JavaScript.
 * `metadata[21]` is the album's advertised total media count; the maintained
 * collector is separately required to enumerate exactly that many stable IDs.
 */
export function parseAlbumHtml(html, finalUrl) {
  const page = new URL(finalUrl);
  const title = htmlTitle(html);
  if (title !== ALBUM_TITLE && title !== `${ALBUM_TITLE} - Google Photos`) fail(`expected album “${ALBUM_TITLE}”, got “${title || 'untitled'}”.`);
  if (page.hostname !== 'photos.google.com' || !page.pathname.startsWith('/share/')) fail('share URL did not resolve to a Google Photos shared album.');
  const bootstrap = parseBootstrapData(html);
  const initialItems = bootstrap?.[1];
  const metadata = bootstrap?.[3];
  const albumId = page.pathname.split('/')[2];
  const authKey = page.searchParams.get('key');
  const expectedCount = metadata?.[21];
  if (!Array.isArray(initialItems) || !Array.isArray(metadata) || metadata[0] !== albumId || metadata[1] !== ALBUM_TITLE || metadata[19] !== authKey) {
    fail('bootstrap album identity did not match the resolved shared URL.');
  }
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || initialItems.length > expectedCount) fail('bootstrap did not provide a valid total media count.');
  const seen = new Set();
  initialItems.forEach((entry) => {
    const id = entry?.[0];
    const sourceImageUrl = entry?.[1]?.[0];
    if (typeof id !== 'string' || !allowedImageUrl(sourceImageUrl) || seen.has(id)) fail('bootstrap media entries were invalid or duplicated.');
    seen.add(id);
  });
  return { albumUrl: page.href, albumId, authKey, expectedCount, initialCount: initialItems.length };
}

export function validateEnumeration(album, media) {
  if (!Array.isArray(media)) fail('collector did not return a media list.');
  const seen = new Set();
  const items = media.map((item, index) => {
    if (!item || typeof item.uid !== 'string' || seen.has(item.uid) || !allowedImageUrl(item.posterUrl || item.url) || !Number.isFinite(item.width) || !Number.isFinite(item.height)) {
      fail('collector returned invalid, duplicate, or unsafe media metadata.');
    }
    seen.add(item.uid);
    return { id: item.uid, sourceImageUrl: item.posterUrl || item.url, width: item.width, height: item.height, isVideo: Boolean(item.isVideo), order: index + 1 };
  });
  if (items.length !== album.expectedCount) fail(`collector enumerated ${items.length} media item(s), but the bootstrap advertised ${album.expectedCount}.`);
  return items;
}

export function reconcile(previous, current) {
  const oldItems = Array.isArray(previous?.items) ? previous.items : [];
  const oldById = new Map(oldItems.map((item) => [item.id, item]));
  const currentIds = new Set(current.map((item) => item.id));
  return {
    additions: current.filter((item) => !oldById.has(item.id)).map((item) => item.id),
    removals: oldItems.filter((item) => !currentIds.has(item.id)).map((item) => item.id),
    unchanged: current.filter((item) => oldById.has(item.id)).map((item) => item.id)
  };
}

async function fetchAlbum() {
  const response = await fetch(SHARE_URL, {
    redirect: 'follow',
    headers: { accept: 'text/html,application/xhtml+xml', 'accept-language': 'en-US,en;q=0.9', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) fail(`album returned HTTP ${response.status}.`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) fail(`album returned unexpected content type ${type || 'unknown'}.`);
  const album = parseAlbumHtml(await response.text(), response.url);
  const media = await fetchImageUrls(SHARE_URL);
  const allItems = validateEnumeration(album, media);
  const items = allItems.filter((item) => !item.isVideo);
  return { ...album, items, skippedVideos: allItems.length - items.length, evidence: `bootstrap-total=${album.expectedCount}; continuation-enumeration=${allItems.length}` };
}

async function readManifest() {
  try { return JSON.parse(await fs.readFile(OUTPUT, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return { items: [] }; throw error; }
}

async function imageBuffer(url) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !allowedImageUrl(response.url)) fail(`image download was rejected (${response.status}).`);
  const type = response.headers.get('content-type') || '';
  if (!/^image\/(?:jpeg|png|webp|avif)$/i.test(type)) fail(`image download had unsupported type ${type || 'unknown'}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) fail('image download exceeded the allowed byte limit.');
  return buffer;
}

async function buildSnapshot(album, temporaryDirectory) {
  const { default: sharp } = await import('sharp');
  const stagedAssets = path.join(temporaryDirectory, 'assets');
  await fs.mkdir(stagedAssets, { recursive: true });
  const items = [];
  for (const source of album.items) {
    const input = await imageBuffer(source.sourceImageUrl);
    const hash = crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: 'error' }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) fail(`photo ${source.id} has invalid dimensions.`);
    const base = `${source.id}-${hash}`;
    const thumb = `${base}-thumb.webp`;
    const large = `${base}-large.webp`;
    await Promise.all([
      image.clone().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(stagedAssets, thumb)),
      image.clone().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(stagedAssets, large))
    ]);
    items.push({ id: source.id, thumbnailUrl: `${ASSET_BASE}/${thumb}`, imageUrl: `${ASSET_BASE}/${large}`, width: metadata.width, height: metadata.height, alt: 'ASME OSU chapter photo', category: 'general', order: source.order });
  }
  return { stagedAssets, manifest: { schemaVersion: 1, source: 'Google Photos public shared album', albumUrl: SHARE_URL, generatedAt: new Date().toISOString(), items } };
}

async function publishSnapshot(snapshot, temporaryDirectory) {
  const stagedManifest = path.join(temporaryDirectory, 'google-photos-feed.json');
  await fs.writeFile(stagedManifest, `${JSON.stringify(snapshot.manifest, null, 2)}\n`);
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.mkdir(ASSET_DIRECTORY, { recursive: true });
  const stagedFiles = await fs.readdir(snapshot.stagedAssets);
  for (const file of stagedFiles) await fs.rename(path.join(snapshot.stagedAssets, file), path.join(ASSET_DIRECTORY, file));
  await fs.rename(stagedManifest, OUTPUT);
  const referenced = new Set(snapshot.manifest.items.flatMap((item) => [item.thumbnailUrl.split('/').pop(), item.imageUrl.split('/').pop()]));
  for (const file of await fs.readdir(ASSET_DIRECTORY)) if (!referenced.has(file)) await fs.rm(path.join(ASSET_DIRECTORY, file));
}

function snapshotContent(snapshot) {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    source: snapshot.source,
    albumUrl: snapshot.albumUrl,
    items: snapshot.items
  });
}

export async function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes('--dry-run');
  const album = await fetchAlbum();
  console.log(`Google Photos album: ${album.items.length} still photo(s), ${album.skippedVideos} video(s) skipped; completion evidence: ${album.evidence}.`);
  const previous = await readManifest();
  const changes = reconcile(previous, album.items);
  if (dryRun) { console.log(JSON.stringify(changes)); return; }
  if (changes.removals.length && (album.items.length === 0 || changes.removals.length > Math.max(2, previous.items.length / 2))) {
    const confirmation = await fetchAlbum();
    if (confirmation.items.map((item) => item.id).join(',') !== album.items.map((item) => item.id).join(',')) fail('second complete read did not confirm the unusual removal; preserving the snapshot.');
  }
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'asme-google-photos-'));
  try {
    const snapshot = await buildSnapshot(album, temporaryDirectory);
    if (snapshotContent(snapshot.manifest) === snapshotContent(previous)) {
      console.log('Google Photos gallery content is already current; no snapshot files changed.');
      return;
    }
    await publishSnapshot(snapshot, temporaryDirectory);
  }
  finally { await fs.rm(temporaryDirectory, { recursive: true, force: true }); }
  console.log(`Published ${album.items.length} photo(s): ${changes.additions.length} added, ${changes.removals.length} removed.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
