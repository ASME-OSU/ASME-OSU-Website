import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const username = 'asmeohiostate';
const maxItems = 8;
const minimumItems = 4;
const outputPath = path.resolve('data/instagram-feed.json');
const imageDirectory = path.resolve('assets/gallery/instagram-auto');
const publicAssetBase = 'https://asme-osu.github.io/ASME-OSU-Website/assets/gallery/instagram-auto';
const instagramWebAppId = '936619743392459';
const requestHeaders = {
  accept: 'application/json, text/plain, */*',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36',
  'x-ig-app-id': instagramWebAppId,
  referer: `https://www.instagram.com/${username}/`
};

const profileEndpoints = [
  `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
  `https://i.instagram.com/api/v1/users/web_profile_info/?username=${username}`
];

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  return values.map((value) => value.split(';', 1)[0]).join('; ');
}

async function bootstrapPublicSession() {
  try {
    const response = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': requestHeaders['accept-language'],
        'user-agent': requestHeaders['user-agent']
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000)
    });
    const cookie = cookieHeader(response);
    const csrf = cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] || '';
    return { cookie, csrf };
  } catch {
    return { cookie: '', csrf: '' };
  }
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
  return `${shortened || value.slice(0, limit - 1)}…`;
}

function makeTitle(caption, fallback) {
  const clean = cleanCaption(caption);
  if (!clean) return fallback;
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0];
  return truncate(firstSentence, 76);
}

function makeSummary(caption) {
  const clean = cleanCaption(caption);
  if (!clean) return 'Follow ASME OSU for chapter updates, upcoming events, workshops, and student opportunities.';
  const firstSentence = clean.split(/(?<=[.!?])\s+/)[0];
  const remainder = clean.slice(firstSentence.length).trim();
  return remainder
    ? truncate(remainder, 240)
    : 'See the full update on Instagram and follow ASME OSU for upcoming events and chapter news.';
}

function mediaType(node) {
  if (node.__typename === 'GraphSidecar') return 'CAROUSEL_ALBUM';
  if (node.is_video || node.__typename === 'GraphVideo') return 'VIDEO';
  return 'IMAGE';
}

function imageSource(node) {
  const resources = [
    ...(Array.isArray(node.display_resources) ? node.display_resources : []),
    ...(Array.isArray(node.thumbnail_resources) ? node.thumbnail_resources : [])
  ];
  const preferred = resources
    .filter((resource) => resource?.src)
    .sort((a, b) => Number(a.config_width || 0) - Number(b.config_width || 0))
    .find((resource) => Number(resource.config_width || 0) >= 640);
  if (preferred?.src) {
    return {
      url: preferred.src,
      width: Number(preferred.config_width || 0),
      height: Number(preferred.config_height || 0)
    };
  }
  return {
    url: node.thumbnail_src || node.display_url || '',
    width: Number(node.dimensions?.width || 0),
    height: Number(node.dimensions?.height || 0)
  };
}

function carouselSources(node) {
  const edges = node?.edge_sidecar_to_children?.edges;
  if (!Array.isArray(edges)) return [];
  return edges
    .map((edge, index) => {
      const child = edge?.node || {};
      const image = imageSource(child);
      return {
        shortcode: child.shortcode || `${node.shortcode}-slide-${index + 1}`,
        sourceImageUrl: image.url,
        sourceWidth: image.width,
        sourceHeight: image.height
      };
    })
    .filter((item) => item.sourceImageUrl);
}

function parseEmbedProfile(html) {
  const match = html.match(/"contextJSON":"((?:\\.|[^"\\])*)"/);
  if (!match) throw new Error('profile embed did not contain its public media context');
  const serializedContext = JSON.parse(`"${match[1]}"`);
  const context = JSON.parse(serializedContext)?.context;
  if (context?.username?.toLowerCase() !== username || !Array.isArray(context.graphql_media)) {
    throw new Error('profile embed did not contain the expected public account');
  }
  return {
    username: context.username,
    edge_owner_to_timeline_media: {
      edges: context.graphql_media.map((entry) => ({ node: entry?.shortcode_media }))
    }
  };
}

async function fetchEmbedProfile() {
  const response = await fetch(`https://www.instagram.com/${username}/embed/`, {
    headers: {
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': requestHeaders['accept-language'],
      'user-agent': 'Mozilla/5.0'
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`profile embed returned HTTP ${response.status}`);
  return parseEmbedProfile(await response.text());
}

function isPinned(node) {
  return Array.isArray(node.pinned_for_users) && node.pinned_for_users.length > 0;
}

function normalizePosts(user) {
  const edges = user?.edge_owner_to_timeline_media?.edges;
  if (!Array.isArray(edges)) throw new Error('Instagram did not return a public timeline.');

  const posts = edges
    .map((edge) => edge?.node)
    .map((node) => ({ node, image: imageSource(node || {}) }))
    .filter(({ node, image }) => node?.shortcode && node?.taken_at_timestamp && image.url)
    .map(({ node, image }) => {
      const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
      return {
        shortcode: node.shortcode,
        timestamp: Number(node.taken_at_timestamp),
        pinned: isPinned(node),
        mediaType: mediaType(node),
        sourceImageUrl: image.url,
        sourceWidth: image.width,
        sourceHeight: image.height,
        carouselSources: carouselSources(node),
        caption
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  const featured = posts.find((post) => !post.pinned) || posts[0];
  if (!featured) return [];
  return [featured, ...posts.filter((post) => post !== featured)].slice(0, maxItems);
}

async function fetchPublicProfile() {
  const failures = [];
  try {
    return await fetchEmbedProfile();
  } catch (error) {
    failures.push(`official profile embed: ${error.message}`);
  }
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const session = await bootstrapPublicSession();
    for (const endpoint of profileEndpoints) {
      try {
        const headers = {
          ...requestHeaders,
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'x-requested-with': 'XMLHttpRequest'
        };
        if (session.cookie) headers.cookie = session.cookie;
        if (session.csrf) headers['x-csrftoken'] = session.csrf;
        const response = await fetch(endpoint, {
          headers,
          redirect: 'follow',
          signal: AbortSignal.timeout(20_000)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const user = payload?.data?.user;
        if (!user || user.username?.toLowerCase() !== username) {
          throw new Error('response did not contain the expected public account');
        }
        return user;
      } catch (error) {
        failures.push(`attempt ${attempt} on ${new URL(endpoint).host}: ${error.message}`);
      }
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`Instagram public profile requests failed (${failures.join('; ')}).`);
}

function extensionFor(contentType) {
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('webp')) return '.webp';
  return '.jpg';
}

async function existingImage(baseName) {
  try {
    const files = await fs.readdir(imageDirectory);
    const fileName = files.find((file) => file.startsWith(`${baseName}.`));
    if (!fileName) return '';
    const details = await fs.stat(path.join(imageDirectory, fileName));
    return details.size >= 1_000 ? fileName : '';
  } catch {
    return '';
  }
}

async function downloadImage(post, temporaryDirectory) {
  const dimensions = post.sourceWidth > 0 && post.sourceHeight > 0
    ? `-${post.sourceWidth}x${post.sourceHeight}`
    : '';
  const baseName = `${post.shortcode}${dimensions}`;
  const current = await existingImage(baseName);
  if (current) return { fileName: current, temporaryPath: '' };

  const response = await fetch(post.sourceImageUrl, {
    headers: {
      'user-agent': requestHeaders['user-agent'],
      referer: requestHeaders.referer
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`image ${post.shortcode} returned HTTP ${response.status}`);

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) throw new Error(`image ${post.shortcode} returned ${contentType || 'an unknown file type'}`);

  const image = Buffer.from(await response.arrayBuffer());
  if (image.length < 1_000 || image.length > 12_000_000) {
    throw new Error(`image ${post.shortcode} had an unexpected size (${image.length} bytes)`);
  }

  const fileName = `${baseName}${extensionFor(contentType)}`;
  const temporaryPath = path.join(temporaryDirectory, fileName);
  await fs.writeFile(temporaryPath, image);
  return { fileName, temporaryPath };
}

async function readExistingFeed() {
  try {
    return JSON.parse(await fs.readFile(outputPath, 'utf8'));
  } catch {
    return null;
  }
}

function sameFeed(existing, next) {
  if (!existing) return false;
  return JSON.stringify({ version: existing.version, account: existing.account, source: existing.source, items: existing.items }) ===
    JSON.stringify({ version: next.version, account: next.account, source: next.source, items: next.items });
}

async function publishImages(downloads) {
  await fs.mkdir(imageDirectory, { recursive: true });
  for (const download of downloads) {
    if (download.temporaryPath) {
      await fs.copyFile(download.temporaryPath, path.join(imageDirectory, download.fileName));
    }
  }

  const keep = new Set(downloads.map((download) => download.fileName));
  const existing = await fs.readdir(imageDirectory);
  await Promise.all(existing
    .filter((file) => !keep.has(file))
    .map((file) => fs.unlink(path.join(imageDirectory, file))));
}

async function main() {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'asme-instagram-'));
  try {
    const user = await fetchPublicProfile();
    const posts = normalizePosts(user);
    if (posts.length < minimumItems) {
      throw new Error(`Instagram returned only ${posts.length} usable public posts; the existing feed was preserved.`);
    }

    const downloadSets = [];
    for (let index = 0; index < posts.length; index += 1) {
      const post = posts[index];
      const sources = index === 0 && post.carouselSources.length > 1
        ? post.carouselSources
        : [post];
      const postDownloads = [];
      for (const source of sources) postDownloads.push(await downloadImage(source, temporaryDirectory));
      downloadSets.push(postDownloads);
    }
    const downloads = downloadSets.flat();

    const items = posts.map((post, index) => {
      const caption = cleanCaption(post.caption);
      const fallback = index === 0 ? 'Latest from ASME OSU' : 'More from the chapter';
      const title = makeTitle(caption, fallback);
      const sourceSet = index === 0 && post.carouselSources.length > 1
        ? post.carouselSources
        : [post];
      const carouselImages = downloadSets[index].map((download, slideIndex) => ({
        imageUrl: `${publicAssetBase}/${download.fileName}`,
        imageWidth: sourceSet[slideIndex].sourceWidth,
        imageHeight: sourceSet[slideIndex].sourceHeight,
        alt: `${title} — image ${slideIndex + 1} of ${downloadSets[index].length}`
      }));
      const firstImage = carouselImages[0];
      const item = {
        id: post.shortcode,
        permalink: `https://www.instagram.com/p/${post.shortcode}/`,
        mediaType: post.mediaType,
        imageUrl: firstImage.imageUrl,
        imageWidth: firstImage.imageWidth,
        imageHeight: firstImage.imageHeight,
        timestamp: new Date(post.timestamp * 1000).toISOString(),
        title,
        summary: makeSummary(caption),
        caption,
        alt: title
      };
      if (index === 0 && carouselImages.length > 1) item.carouselImages = carouselImages;
      return item;
    });

    const next = {
      version: 4,
      account: username,
      source: 'instagram-public-profile',
      updatedAt: new Date().toISOString(),
      items
    };
    const existing = await readExistingFeed();

    await publishImages(downloads);
    if (!sameFeed(existing, next)) {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, `${JSON.stringify(next, null, 2)}\n`);
      console.log(`Updated ${outputPath} with ${items.length} public Instagram posts.`);
    } else {
      console.log('Instagram feed data is already current.');
    }
  } finally {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`::error title=Instagram public feed refresh failed::${error.message}`);
  console.error('The existing feed and locally stored images were left available to the Gallery.');
  process.exitCode = 1;
});
