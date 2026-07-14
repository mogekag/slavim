import { describe, expect, it } from 'vitest';
import { selectSessionWords } from './quiz-selection';
import type { WordEntry } from '@/types/word';

function makeWord(overrides: Partial<WordEntry>): WordEntry {
  return {
    word: 'test',
    lang: 'en',
    correctCount: 0,
    attemptCount: 0,
    consecutiveCorrect: 0,
    learned: false,
    dateAdded: new Date().toISOString(),
    ...overrides,
  };
}

describe('selectSessionWords', () => {
  it('filters by language', () => {
    const words = [makeWord({ word: 'cat', lang: 'en' }), makeWord({ word: 'кот', lang: 'ru' })];
    const result = selectSessionWords(words, { lang: 'ru', onlyLearning: false, size: 10 });
    expect(result.map((w) => w.word)).toEqual(['кот']);
  });

  it('excludes learned words when onlyLearning is true', () => {
    const words = [
      makeWord({ word: 'learned', learned: true }),
      makeWord({ word: 'learning', learned: false }),
    ];
    const result = selectSessionWords(words, { lang: 'all', onlyLearning: true, size: 10 });
    expect(result.map((w) => w.word)).toEqual(['learning']);
  });

  it('prioritizes lower-accuracy words over high-accuracy words', () => {
    const words = [
      makeWord({ word: 'easy', attemptCount: 10, correctCount: 10, lastTested: new Date().toISOString() }),
      makeWord({ word: 'hard', attemptCount: 10, correctCount: 1, lastTested: new Date().toISOString() }),
    ];
    const result = selectSessionWords(words, { lang: 'all', onlyLearning: false, size: 1 });
    expect(result[0].word).toBe('hard');
  });

  it('caps the result at the requested size', () => {
    const words = Array.from({ length: 20 }, (_, i) => makeWord({ word: `w${i}` }));
    const result = selectSessionWords(words, { lang: 'all', onlyLearning: false, size: 5 });
    expect(result).toHaveLength(5);
  });
});
