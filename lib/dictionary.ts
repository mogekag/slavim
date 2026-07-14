import type { Lang, WordContent } from '@/types/word';
import { getContent } from './storage';

const DEFINITION_ENDPOINT = 'https://en.wiktionary.org/api/rest_v1/page/definition';

interface WiktionaryDefinition {
  definition: string;
  examples?: string[];
}

interface WiktionaryEntry {
  partOfSpeech: string;
  language: string;
  definitions: WiktionaryDefinition[];
}

type WiktionaryResponse = Record<string, WiktionaryEntry[]>;

// Wiktionary orders senses by editorial/historical convention, not by how
// common they are - e.g. "fox" lists the "Symbol" sense (ISO 639-5 code)
// before the "Noun" sense (the animal). Bias toward the parts of speech a
// language learner actually cares about.
const POS_PRIORITY = [
  'Noun',
  'Verb',
  'Adjective',
  'Adverb',
  'Interjection',
  'Pronoun',
  'Proper noun',
  'Preposition',
  'Conjunction',
  'Numeral',
];

function posRank(pos: string): number {
  const idx = POS_PRIORITY.indexOf(pos);
  return idx === -1 ? POS_PRIORITY.length : idx;
}

function firstNonEmptyDefinition(defs: WiktionaryDefinition[]): WiktionaryDefinition | undefined {
  return defs.find((d) => d.definition.trim().length > 0);
}

/**
 * Wiktionary's REST definition endpoint only works against en.wiktionary.org
 * (ru.wiktionary.org's equivalent 501s) but that single wiki documents
 * headwords from many languages, keyed by ISO code in the response (e.g. "ru"
 * for Russian headwords, with English-language definitions) — so both our
 * languages are served from the same host. The endpoint doesn't expose IPA
 * pronunciation, so `phonetic` is intentionally left unset here.
 */
async function fetchDefinitionExact(lang: Lang, term: string): Promise<WordContent | null> {
  const url = `${DEFINITION_ENDPOINT}/${encodeURIComponent(term)}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wiktionary definition API error: ${res.status}`);

  const data: WiktionaryResponse = await res.json();
  const entries = data[lang];
  if (!entries || entries.length === 0) return null;

  const orderedEntries = [...entries].sort((a, b) => posRank(a.partOfSpeech) - posRank(b.partOfSpeech));

  for (const entry of orderedEntries) {
    const definition = firstNonEmptyDefinition(entry.definitions);
    if (!definition) continue;
    return {
      word: term,
      lang,
      definition: definition.definition,
      partOfSpeech: entry.partOfSpeech,
      example: definition.examples?.[0],
      sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(term)}#${entry.language}`,
    };
  }
  return null;
}

/** Looks up a word, retrying lower-cased if the exact-case title has no entry. */
export async function fetchDefinition(lang: Lang, word: string): Promise<WordContent | null> {
  const attempts = Array.from(new Set([word, word.toLowerCase()]));
  for (const attempt of attempts) {
    const result = await fetchDefinitionExact(lang, attempt);
    if (result) return { ...result, word };
  }
  return null;
}

export interface WordLookupResult {
  content: WordContent;
  fromCache: boolean;
}

/** Checks the local content cache before hitting Wiktionary. */
export async function lookupWord(lang: Lang, word: string): Promise<WordLookupResult | null> {
  const cached = await getContent(lang, word);
  if (cached) return { content: cached, fromCache: true };

  const fetched = await fetchDefinition(lang, word);
  return fetched ? { content: fetched, fromCache: false } : null;
}
