import type { Lang, WordEntry } from '@/types/word';
import { accuracy } from '@/types/word';

export interface SessionOptions {
  lang: Lang | 'all';
  onlyLearning: boolean;
  size: number;
}

function daysSince(dateIso?: string): number {
  if (!dateIso) return Infinity;
  return (Date.now() - new Date(dateIso).getTime()) / (1000 * 60 * 60 * 24);
}

/** Higher priority = more worth reviewing: low accuracy and/or not tested recently. */
function priority(entry: WordEntry): number {
  const acc = entry.attemptCount > 0 ? accuracy(entry) : 0;
  const staleness = Math.min(daysSince(entry.lastTested), 30) / 30;
  return (1 - acc) * 0.7 + staleness * 0.3;
}

export function selectSessionWords(all: WordEntry[], options: SessionOptions): WordEntry[] {
  let pool = all;
  if (options.lang !== 'all') pool = pool.filter((w) => w.lang === options.lang);
  if (options.onlyLearning) pool = pool.filter((w) => !w.learned);

  return [...pool].sort((a, b) => priority(b) - priority(a)).slice(0, options.size);
}
