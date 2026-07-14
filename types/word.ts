export type Lang = 'en' | 'ru';

export type QuizDirection = 'word-to-definition' | 'definition-to-word';

export interface WordStats {
  word: string;
  lang: Lang;
  correctCount: number;
  attemptCount: number;
  consecutiveCorrect: number;
  learned: boolean;
  dateAdded: string;
  lastTested?: string;
}

export interface WordContent {
  word: string;
  lang: Lang;
  definition: string;
  partOfSpeech?: string;
  phonetic?: string;
  example?: string;
  sourceUrl?: string;
}

export type WordEntry = WordStats & { content?: WordContent };

export function accuracy(stats: Pick<WordStats, 'correctCount' | 'attemptCount'>): number {
  return stats.attemptCount === 0 ? 0 : stats.correctCount / stats.attemptCount;
}

export function statKey(lang: Lang, word: string): string {
  return `stat:${lang}:${word.toLowerCase()}`;
}

export function contentKey(lang: Lang, word: string): string {
  return `content:${lang}:${word.toLowerCase()}`;
}
