import { describe, expect, it } from 'vitest';
import { detectLang, extractWord } from './language';

describe('detectLang', () => {
  it('detects Cyrillic text as Russian', () => {
    expect(detectLang('привет')).toBe('ru');
  });

  it('detects Latin text as English', () => {
    expect(detectLang('hello')).toBe('en');
  });

  it('returns null for text with no letters', () => {
    expect(detectLang('123')).toBeNull();
  });
});

describe('extractWord', () => {
  it('trims whitespace', () => {
    expect(extractWord('  hello  ')).toBe('hello');
  });

  it('strips surrounding punctuation', () => {
    expect(extractWord('"hello,"')).toBe('hello');
  });

  it('rejects multi-word selections', () => {
    expect(extractWord('hello world')).toBeNull();
  });

  it('rejects empty selections', () => {
    expect(extractWord('   ')).toBeNull();
  });

  it('handles Cyrillic words', () => {
    expect(extractWord('привет!')).toBe('привет');
  });
});
