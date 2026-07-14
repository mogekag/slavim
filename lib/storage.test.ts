import { beforeEach, describe, expect, it } from 'vitest';
import { getAllWords, getStats, recordAnswer, saveWord } from './storage';
import type { WordContent } from '@/types/word';

const content: WordContent = {
  word: 'fox',
  lang: 'en',
  definition: 'A small canine mammal.',
};

beforeEach(() => {
  fakeBrowser.reset();
});

describe('saveWord', () => {
  it('creates fresh stats for a new word', async () => {
    const stats = await saveWord(content);
    expect(stats).toMatchObject({ word: 'fox', lang: 'en', attemptCount: 0, learned: false });
  });

  it('does not reset existing stats when re-saving the same word', async () => {
    await saveWord(content);
    await recordAnswer('en', 'fox', true);
    const stats = await saveWord(content);
    expect(stats.attemptCount).toBe(1);
    expect(stats.correctCount).toBe(1);
  });
});

describe('recordAnswer', () => {
  it('increments attempt/correct counts and the streak on a correct answer', async () => {
    const stats = await recordAnswer('en', 'fox', true);
    expect(stats).toMatchObject({ attemptCount: 1, correctCount: 1, consecutiveCorrect: 1, learned: false });
  });

  it('resets the streak but keeps attempt count on a wrong answer', async () => {
    await recordAnswer('en', 'fox', true);
    await recordAnswer('en', 'fox', true);
    const stats = await recordAnswer('en', 'fox', false);
    expect(stats).toMatchObject({ attemptCount: 3, correctCount: 2, consecutiveCorrect: 0 });
  });

  it('promotes to learned after 10 consecutive correct answers', async () => {
    let stats;
    for (let i = 0; i < 10; i++) {
      stats = await recordAnswer('en', 'fox', true);
    }
    expect(stats?.consecutiveCorrect).toBe(10);
    expect(stats?.learned).toBe(true);
  });

  it('does not promote before reaching the streak threshold', async () => {
    let stats;
    for (let i = 0; i < 9; i++) {
      stats = await recordAnswer('en', 'fox', true);
    }
    expect(stats?.learned).toBe(false);
  });

  it('a single wrong answer after a long streak resets promotion eligibility', async () => {
    for (let i = 0; i < 9; i++) await recordAnswer('en', 'fox', true);
    const afterWrong = await recordAnswer('en', 'fox', false);
    expect(afterWrong.consecutiveCorrect).toBe(0);
    expect(afterWrong.learned).toBe(false);
  });
});

describe('getAllWords', () => {
  it('joins stats with cached content', async () => {
    await saveWord(content);
    const words = await getAllWords();
    expect(words).toHaveLength(1);
    expect(words[0].content?.definition).toBe(content.definition);
  });

  it('reflects stat updates from recordAnswer', async () => {
    await saveWord(content);
    await recordAnswer('en', 'fox', true);
    const stats = await getStats('en', 'fox');
    expect(stats?.correctCount).toBe(1);
  });
});
