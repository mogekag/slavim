import type { Lang } from '@/types/word';

const CYRILLIC_RE = /[Ѐ-ӿ]/;
const LATIN_RE = /[a-zA-Z]/;

/** Detects whether a selected string is Russian (Cyrillic) or English (Latin). */
export function detectLang(text: string): Lang | null {
  if (CYRILLIC_RE.test(text)) return 'ru';
  if (LATIN_RE.test(text)) return 'en';
  return null;
}

/**
 * Extracts a single "word" from an arbitrary text selection: trims whitespace,
 * strips surrounding punctuation, and rejects multi-word selections.
 */
export function extractWord(selection: string): string | null {
  const trimmed = selection.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const cleaned = trimmed.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  return cleaned.length > 0 ? cleaned : null;
}
