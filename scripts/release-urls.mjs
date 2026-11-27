import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const repoUrl = 'https://cdn.jsdelivr.net/gh/ASME-OSU/ASME-OSU-Website';
const assets = [
  // Shared CampusPress settings and the Join and Gallery page embeds.
  'ASME Custom CSS.min.css',
  'Header.css',
  'Header Integration.js',
  'Footer Integration.js',
  'Calendar Integration.js',
  'Member Points Integration.js',
  'assets/gearly/gearly.css',
  'assets/gearly/gearly-bootstrap.js',
  'Gallery Integration.js',
  'Join Page Integration.js',
  'celebration.js',

  // Responsive homepage images referenced by the shared footer.
  'assets/optimized/home/career-fair-640.webp',
  'assets/optimized/home/career-fair-960.webp',
  'assets/optimized/home/career-fair-1440.webp',
  'assets/optimized/home/career-fair-1920.webp',
  'assets/optimized/home/pickleball-group-640.webp',
  'assets/optimized/home/pickleball-group-960.webp',
  'assets/optimized/home/pickleball-group-1440.webp',
  'assets/optimized/home/spring-career-fair-480.webp',
  'assets/optimized/home/spring-career-fair-768.webp',
  'assets/optimized/home/spring-career-fair-1100.webp',
  'assets/optimized/home/spring-career-fair-1440.webp',
  'assets/optimized/home/chapter-meeting-480.webp',
  'assets/optimized/home/chapter-meeting-768.webp',
  'assets/optimized/home/chapter-social-640.webp',
  'assets/optimized/home/chapter-social-960.webp',
  'assets/optimized/home/chapter-social-1380.webp',

  // Bundle and stylesheet dependencies included in the cache measurements.
  'assets/groupme-mark.svg',
  'assets/celebration/experience.js',
  'assets/celebration/chapter-logo.webp',
  'assets/gearly/gearly-data.json',
  'assets/gearly/gearly.js',
  'assets/gearly/gearly-tour.css',
  'assets/gearly/gearly-index.json',
  'assets/gearly/gearly-site.json',
  'assets/gearly/gearly-officers.json',
  'assets/gearly/sprites/gearly-centered-idle.webp',

  // Verify public data delivery, but keep production feed requests on GitHub Pages.
  'data/calendar-events.json',
  'data/calendar-history.json',
  'data/instagram-feed.json',
  'data/google-photos-feed.json',
  'data/google-photos-titles.json',
  'data/points-source.json',
  'data/leaderboard-rank-snapshots.json'
];

function git(args) {
  return execFileSync('git', args, { cwd: root, maxBuffer: 25 * 1024 * 1024 });
}

async function verify(commit, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = repoUrl + '@' + commit + '/' + encodedPath;
  try {
    const expected = git(['show', commit + ':' + path]);
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000) });
    if (response.status !== 200) {
      await response.body?.cancel();
      return { url, error: 'HTTP ' + response.status + ' (expected 200)' };
    }
    const actual = Buffer.from(await response.arrayBuffer());
    if (!actual.equals(expected)) {
      return { url, error: 'HTTP 200, bytes differ (jsDelivr ' + actual.length + ', Git ' + expected.length + ')' };
    }
    return { url, bytes: actual.length };
  } catch (error) {
    return { url, error: error.message };
  }
}

async function main() {
  const commit = git(['rev-parse', '--verify', 'HEAD^{commit}']).toString().trim();
  console.log('Checking commit ' + commit);
  let passed = 0;
  const concurrency = 6;
  for (let start = 0; start < assets.length; start += concurrency) {
    const batch = await Promise.all(assets.slice(start, start + concurrency).map(path => verify(commit, path)));
    for (const result of batch) {
      if (result.error) console.error('FAIL ' + result.url + ' | ' + result.error);
      else {
        passed += 1;
        console.log('OK ' + result.url + ' | HTTP 200, ' + result.bytes + ' bytes identical');
      }
    }
  }

  console.log(passed + '/' + assets.length + ' URLs returned HTTP 200 with byte-identical content.');
  if (passed !== assets.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
