import { useState } from 'react';
import type { WordEntry } from '@/types/word';
import { accuracy } from '@/types/word';
import { lookupWord } from '@/lib/dictionary';
import { deleteWord, saveContent } from '@/lib/storage';
import { sanitizeHtml } from '@/lib/sanitize';

interface Props {
  entry: WordEntry;
  onChanged: () => void;
}

export default function WordCard({ entry, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(entry.content ?? null);
  const [loadingContent, setLoadingContent] = useState(false);

  async function toggleExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && !content) {
      setLoadingContent(true);
      try {
        const result = await lookupWord(entry.lang, entry.word);
        if (result) {
          setContent(result.content);
          if (!result.fromCache) await saveContent(result.content);
        }
      } finally {
        setLoadingContent(false);
      }
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    await deleteWord(entry.lang, entry.word);
    onChanged();
  }

  const pct = Math.round(accuracy(entry) * 100);

  return (
    <div className="word-card">
      <div className="word-card__row" onClick={toggleExpand}>
        <span className="word-card__word">{entry.word}</span>
        <span className="word-card__lang">{entry.lang.toUpperCase()}</span>
        {entry.learned && <span className="word-card__badge word-card__badge--learned">Learned</span>}
        <span className="word-card__stat">
          {entry.attemptCount > 0 ? `${pct}% (${entry.correctCount}/${entry.attemptCount})` : 'Not tested'}
        </span>
        <span className="word-card__stat">Streak: {entry.consecutiveCorrect}</span>
        <button className="word-card__delete" onClick={handleDelete}>
          Delete
        </button>
      </div>
      {expanded && (
        <div className="word-card__details">
          {loadingContent && <div>Loading…</div>}
          {!loadingContent && content && (
            <>
              {content.partOfSpeech && <div className="word-card__pos">{content.partOfSpeech}</div>}
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.definition) }} />
              {content.example && (
                <div
                  className="word-card__example"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.example) }}
                />
              )}
              {content.sourceUrl && (
                <a href={content.sourceUrl} target="_blank" rel="noreferrer">
                  View on Wiktionary
                </a>
              )}
            </>
          )}
          {!loadingContent && !content && <div>No cached definition available.</div>}
        </div>
      )}
    </div>
  );
}
