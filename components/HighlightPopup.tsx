import { useEffect, useRef, useState } from 'react';
import { detectLang, extractWord } from '@/lib/language';
import { lookupWord } from '@/lib/dictionary';
import { getStats, saveWord } from '@/lib/storage';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Lang, WordContent } from '@/types/word';

type Status = 'loading' | 'ready' | 'not-found' | 'error';

interface PopupState {
  visible: boolean;
  word: string;
  lang: Lang;
  rect: DOMRect;
  status: Status;
  content: WordContent | null;
  alreadySaved: boolean;
  justSaved: boolean;
}

const POPUP_WIDTH = 320;
const GAP = 8;
const FLIP_THRESHOLD = 160;

export default function HighlightPopup() {
  const [state, setState] = useState<PopupState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    function isInsideOwnUi(e: Event): boolean {
      return !!rootRef.current && e.composedPath().includes(rootRef.current);
    }

    function handleMouseDown(e: MouseEvent) {
      if (isInsideOwnUi(e)) return;
      setState((prev) => (prev ? { ...prev, visible: false } : prev));
    }

    function handleMouseUp(e: MouseEvent) {
      if (isInsideOwnUi(e)) return;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const word = extractWord(selection.toString());
      if (!word) return;

      const lang = detectLang(word);
      if (!lang) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      const requestId = ++requestIdRef.current;
      setState({
        visible: true,
        word,
        lang,
        rect,
        status: 'loading',
        content: null,
        alreadySaved: false,
        justSaved: false,
      });

      Promise.all([lookupWord(lang, word), getStats(lang, word)])
        .then(([lookup, stats]) => {
          if (requestId !== requestIdRef.current) return;
          setState((prev) =>
            prev
              ? {
                  ...prev,
                  status: lookup ? 'ready' : 'not-found',
                  content: lookup?.content ?? null,
                  alreadySaved: !!stats,
                }
              : prev,
          );
        })
        .catch(() => {
          if (requestId !== requestIdRef.current) return;
          setState((prev) => (prev ? { ...prev, status: 'error' } : prev));
        });
    }

    function handleScroll() {
      setState((prev) => (prev ? { ...prev, visible: false } : prev));
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setState((prev) => (prev ? { ...prev, visible: false } : prev));
    }

    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  if (!state || !state.visible) return null;

  const showAbove = state.rect.top >= FLIP_THRESHOLD;
  const left = Math.min(Math.max(8, state.rect.left), window.innerWidth - POPUP_WIDTH - 8);
  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    top: showAbove ? state.rect.top : state.rect.bottom,
    transform: showAbove ? `translateY(calc(-100% - ${GAP}px))` : `translateY(${GAP}px)`,
    width: POPUP_WIDTH,
  };

  async function handleSave() {
    if (!state?.content) return;
    await saveWord(state.content);
    setState((prev) => (prev ? { ...prev, alreadySaved: true, justSaved: true } : prev));
  }

  return (
    <div ref={rootRef} className="lexi-popup" style={style}>
      <div className="lexi-popup__header">
        <span className="lexi-popup__word">{state.word}</span>
        <span className="lexi-popup__lang">{state.lang === 'ru' ? 'RU' : 'EN'}</span>
      </div>

      {state.status === 'loading' && <div className="lexi-popup__body">Looking up…</div>}
      {state.status === 'error' && (
        <div className="lexi-popup__body lexi-popup__error">Couldn't reach the dictionary.</div>
      )}
      {state.status === 'not-found' && (
        <div className="lexi-popup__body lexi-popup__error">No definition found.</div>
      )}
      {state.status === 'ready' && state.content && (
        <div className="lexi-popup__body">
          {state.content.partOfSpeech && (
            <div className="lexi-popup__pos">{state.content.partOfSpeech}</div>
          )}
          <div
            className="lexi-popup__definition"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(state.content.definition) }}
          />
          {state.content.example && (
            <div
              className="lexi-popup__example"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(state.content.example) }}
            />
          )}
          <button
            className="lexi-popup__save"
            onClick={handleSave}
            disabled={state.alreadySaved}
          >
            {state.justSaved ? 'Saved ✓' : state.alreadySaved ? 'Already saved' : 'Save word'}
          </button>
        </div>
      )}
    </div>
  );
}
