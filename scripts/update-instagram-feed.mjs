import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const token = process.env.INSTAGRAM_ACCESS_TOKEN;
const outputPath = path.resolve('data/instagram-feed.json');

if (!token) {
  throw new Error('INSTAGRAM_ACCESS_TOKEN is required. Add it as a GitHub Actions repository secret.');
}

function cleanCaption(value = '') {
  return value
    .replace(/https?:\/\/\S+/g, '')
    .replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value, limit) {
  if (value.length <= limit) return value;
  const shortened = value.slice(0, limit - 1).replace(/\s+\S*$/, '').trim();
  return shortened + '…';
}

function makeTitle(caption, fallback) {
  const clean = cleanCaption(caption);
  if (!clean) return fallback;
  const firstLine = clean.split(/\n|(?<=[.!?])\s+/)[0];
  return truncate(firstLine, 76);
}

function makeSummary(caption) {
  const clean = cleanCaption(caption);
  return clean ? truncate(clean, 240) : 'Follow ASME OSU for chapter updates, upcoming events, workshops, and student opportunities.';
}

const endpoint = new URL('https://graph.instagram.com/me/media');
endpoint.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username');
endpoint.searchParams.set('limit', '8');
endpoint.searchParams.set('access_token', token);

const response = await fetch(endpoint, { headers: { accept: 'application/json' } });
const payload = await response.json();

if (!response.ok || !Array.isArray(payload.data)) {
  const message = payload?.error?.message || `Instagram API returned ${response.status}`;
  throw new Error(message);
}

const items = payload.data
  .filter((item) => item.permalink && (item.thumbnail_url || item.media_url))
  .map((item, index) => {
    const caption = cleanCaption(item.caption || '');
    const fallback = index === 0 ? 'Latest from ASME OSU' : 'More from the chapter';
    return {
      id: item.id,
      permalink: item.permalink,
      mediaType: item.media_type,
      imageUrl: item.thumbnail_url || item.media_url,
      timestamp: item.timestamp,
      title: makeTitle(caption, fallback),
      summary: makeSummary(caption),
      caption,
      alt: makeTitle(caption, 'ASME OSU Instagram post')
    };
  });

if (items.length < 1) {
  throw new Error('Instagram returned no displayable media. The existing feed was left unchanged.');
}

let existing = null;
try {
  existing = JSON.parse(await fs.readFile(outputPath, 'utf8'));
} catch {
  existing = null;
}

if (existing && JSON.stringify(existing.items) === JSON.stringify(items)) {
  console.log('Instagram feed is already current.');
  process.exit(0);
}

const feed = {
  version: 1,
  account: payload.data[0]?.username || 'asmeohiostate',
  updatedAt: new Date().toISOString(),
  items
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(feed, null, 2) + '\n');
console.log(`Updated ${outputPath} with ${items.length} Instagram posts.`);
