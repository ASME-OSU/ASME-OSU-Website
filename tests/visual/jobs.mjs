import { ORIGIN, PAGES, SCHEMES, STATES, WIDTHS } from './config.mjs';

// Every screenshot the suite takes: each page at each width and color scheme,
// plus each interaction state in both schemes.
export function jobs(filter = '') {
  const byName = new Map(PAGES.map(page => [page.name, page]));
  const all = [];
  for (const page of PAGES) for (const width of WIDTHS) for (const scheme of SCHEMES) {
    all.push({ id: `${page.name}--${width}--${scheme}`, url: ORIGIN + page.path, width, scheme });
  }
  for (const state of STATES) for (const scheme of SCHEMES) {
    all.push({ id: `${state.page}--${state.name}--${state.width}--${scheme}`, url: ORIGIN + byName.get(state.page).path, width: state.width, scheme, state });
  }
  const terms = filter.split(',').map(term => term.trim()).filter(Boolean);
  return terms.length ? all.filter(job => terms.some(term => job.id.includes(term))) : all;
}

export async function pool(items, size, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}

export function option(name, fallback = '') {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}
