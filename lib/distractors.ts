import type { Lang } from '@/types/word';
import { fetchDefinition } from './dictionary';

const RANDOM_TITLES_ENDPOINT = 'https://en.wiktionary.org/w/api.php';
// Most random Wiktionary page titles are headwords in languages other than
// the one we need (English Wiktionary documents hundreds of languages), so
// several batches are usually needed to surface enough same-language matches
// - especially for a smaller-share language like Russian. Concurrency is
// capped to stay well clear of Wikimedia's rate limiting (a naive
// Promise.all across 40 requests reliably triggers 429s in practice).
const BATCH_SIZE = 20;
const MAX_BATCHES = 4;
const CONCURRENCY = 6;

interface MediaWikiRandomResponse {
  query?: { random?: Array<{ title: string }> };
}

async function fetchRandomTitles(count: number): Promise<string[]> {
  const url = `${RANDOM_TITLES_ENDPOINT}?action=query&list=random&rnnamespace=0&rnlimit=${count}&format=json&origin=*`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wiktionary random API error: ${res.status}`);
  const data: MediaWikiRandomResponse = await res.json();
  return (data.query?.random ?? []).map((entry) => entry.title);
}

/** Runs `fn` over `items` with at most `limit` requests in flight at once. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export interface Distractor {
  word: string;
  definition: string;
}

/**
 * Fetches random Wiktionary page titles and keeps only the ones that have an
 * entry in the target language. Best-effort: if a batch fails (e.g. rate
 * limited), returns whatever was already found instead of throwing, so a
 * quiz session can still proceed with fewer options rather than erroring out.
 */
export async function fetchDistractors(
  lang: Lang,
  count: number,
  exclude: Iterable<string> = [],
): Promise<Distractor[]> {
  const found: Distractor[] = [];
  const seen = new Set(Array.from(exclude, (w) => w.toLowerCase()));

  for (let batch = 0; batch < MAX_BATCHES && found.length < count; batch++) {
    let titles: string[];
    try {
      titles = await fetchRandomTitles(BATCH_SIZE);
    } catch {
      break;
    }

    const candidates = titles.filter((title) => {
      const key = title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const entries = await mapWithConcurrency(candidates, CONCURRENCY, (title) =>
      fetchDefinition(lang, title).catch(() => null),
    );
    for (const entry of entries) {
      if (entry) found.push({ word: entry.word, definition: entry.definition });
    }
  }

  return found.slice(0, count);
}
