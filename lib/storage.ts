import type { Lang, WordContent, WordEntry, WordStats } from '@/types/word';
import { contentKey, statKey } from '@/types/word';

const STAT_PREFIX = 'stat:';
const CONTENT_PREFIX = 'content:';

export async function getStats(lang: Lang, word: string): Promise<WordStats | null> {
  return storage.getItem<WordStats>(`sync:${statKey(lang, word)}`);
}

export async function saveStats(stats: WordStats): Promise<void> {
  await storage.setItem(`sync:${statKey(stats.lang, stats.word)}`, stats);
}

export async function getAllStats(): Promise<WordStats[]> {
  const snapshot = await storage.snapshot('sync');
  return Object.entries(snapshot)
    .filter(([key]) => key.startsWith(STAT_PREFIX))
    .map(([, value]) => value as WordStats);
}

export async function getContent(lang: Lang, word: string): Promise<WordContent | null> {
  return storage.getItem<WordContent>(`local:${contentKey(lang, word)}`);
}

/** All saved words with their cached content joined in (content may be null if not yet cached). */
export async function getAllWords(): Promise<WordEntry[]> {
  const stats = await getAllStats();
  const contents = await Promise.all(stats.map((s) => getContent(s.lang, s.word)));
  return stats.map((s, i) => ({ ...s, content: contents[i] ?? undefined }));
}

export async function saveContent(content: WordContent): Promise<void> {
  await storage.setItem(`local:${contentKey(content.lang, content.word)}`, content);
}

export async function deleteWord(lang: Lang, word: string): Promise<void> {
  await storage.removeItems([
    `sync:${statKey(lang, word)}`,
    `local:${contentKey(lang, word)}`,
  ]);
}

/** Notifies `callback` whenever any saved word's stats change (add/update/delete). */
export function watchStats(callback: () => void): () => void {
  const listener = (changes: Record<string, unknown>, areaName: string) => {
    if (areaName !== 'sync') return;
    const touchedStats = Object.keys(changes).some((key) => key.startsWith(STAT_PREFIX));
    if (touchedStats) callback();
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

function makeInitialStats(lang: Lang, word: string): WordStats {
  return {
    word,
    lang,
    correctCount: 0,
    attemptCount: 0,
    consecutiveCorrect: 0,
    learned: false,
    dateAdded: new Date().toISOString(),
  };
}

/** Saves a newly looked-up word: creates stats if new, always refreshes cached content. */
export async function saveWord(content: WordContent): Promise<WordStats> {
  const existing = await getStats(content.lang, content.word);
  const stats = existing ?? makeInitialStats(content.lang, content.word);
  await Promise.all([saveStats(stats), saveContent(content)]);
  return stats;
}

const PROMOTION_STREAK = 10;

/** Records a recall-quiz answer and applies the promotion rule. */
export async function recordAnswer(lang: Lang, word: string, correct: boolean): Promise<WordStats> {
  const existing = await getStats(lang, word);
  const stats = existing ?? makeInitialStats(lang, word);
  stats.attemptCount += 1;
  if (correct) {
    stats.correctCount += 1;
    stats.consecutiveCorrect += 1;
  } else {
    stats.consecutiveCorrect = 0;
  }
  stats.lastTested = new Date().toISOString();
  if (stats.consecutiveCorrect >= PROMOTION_STREAK) {
    stats.learned = true;
  }
  await saveStats(stats);
  return stats;
}
