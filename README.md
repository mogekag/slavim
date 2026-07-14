# Lexi Recall

A free Chrome extension for building vocabulary in **English and Russian**. Highlight
a word on any webpage, see its definition instantly, save it, and review your
saved words later with Anki-style multiple-choice recall sessions.

Built as a free alternative to [Wordie.app](https://wordie.app) — with Cyrillic
support that Wordie lacks.

## Features

- **Highlight & lookup** — select a word (English or Russian) on any page and a
  popup shows its definition, part of speech, and an example sentence, sourced
  from Wiktionary.
- **Save words** — one click saves a word for later review.
- **Word manager** — a full-page view of all saved words, filterable by
  language and by group (Learning / Learned), sortable by accuracy, date, or
  alphabetically.
- **Recall sessions** — Anki-style multiple-choice quizzes (4 options, mixing
  word→definition and definition→word direction) that track your accuracy per
  word.
- **Auto-promotion** — a word moves from "Learning" to "Learned" after 10
  consecutive correct answers.
- **Cross-device sync** — your progress (not the cached definitions) follows
  you via `chrome.storage.sync`.

## Tech stack

- [WXT](https://wxt.dev) (Manifest V3 framework) + TypeScript + React
- [Wiktionary REST API](https://en.wiktionary.org/api/rest_v1/) for
  definitions (both English and Russian headwords are served from
  `en.wiktionary.org` — see [CLAUDE.md](./CLAUDE.md) for why)
- [DOMPurify](https://github.com/cure53/DOMPurify) to sanitize remote HTML
  before rendering it
- [Vitest](https://vitest.dev) for unit tests

No backend, no accounts, no paid API keys.

## Getting started

```bash
npm install
npm run dev
```

`wxt dev` opens a Chrome instance with the extension pre-loaded and hot
reload enabled. To load it into your own Chrome profile instead:

```bash
npm run build
```

Then go to `chrome://extensions`, enable **Developer mode**, click
**Load unpacked**, and select `.output/chrome-mv3`.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with hot reload, extension pre-loaded in Chrome |
| `npm run build` | Production build to `.output/chrome-mv3` |
| `npm run compile` | TypeScript typecheck (`tsc --noEmit`) |
| `npm run test` | Run the unit test suite (Vitest) |
| `npm run zip` | Build and zip for store submission |

## How it works

- **Content script** (`entrypoints/content.tsx`) listens for text selections
  on any page and renders a popup (`components/HighlightPopup.tsx`) inside a
  shadow root, so its styles never leak into the host page.
- **Manager page** (`entrypoints/manager/`) is a full extension page (opened
  in a new tab) for browsing saved words and running recall sessions.
- **Toolbar popup** (`entrypoints/popup/`) shows a quick word/learned count
  and a button to open the manager page.
- **Storage** is split across two areas to work around `chrome.storage.sync`'s
  ~100KB quota: small per-word stats (attempts, correct, streak, learned flag)
  live in `sync` storage so progress follows you across devices; full cached
  definitions/examples live in `local` storage and are re-fetched from
  Wiktionary on demand if missing (e.g. on a new device).

See [CLAUDE.md](./CLAUDE.md) for the full architecture writeup, including
several non-obvious bugs that were found and fixed during development — worth
reading before making changes to the dictionary or recall-session logic.

## Project structure

```
entrypoints/
  background.ts        # minimal - fetches happen directly from content/manager/popup
  content.tsx           # selection listener, mounts the highlight popup
  popup/                 # toolbar popup (quick stats + "Open manager")
  manager/                # full-page word browser + recall session UI
components/
  HighlightPopup.tsx      # lookup tooltip shown on text selection
  WordList.tsx, WordCard.tsx
  RecallSession.tsx, QuizCard.tsx
lib/
  dictionary.ts            # Wiktionary fetch + sense selection
  distractors.ts            # random-word fetching for quiz wrong answers
  storage.ts                 # chrome.storage.sync (stats) + local (content cache)
  language.ts                 # Cyrillic vs Latin detection
  sanitize.ts                  # DOMPurify wrapper
  quiz-selection.ts             # picks which words go into a recall session
  *.test.ts                      # Vitest unit tests, colocated with the code
types/word.ts                     # WordStats, WordContent, WordEntry types
```

## Known limitations

- No IPA/phonetic pronunciation (Wiktionary's REST definition endpoint
  doesn't expose it — would need a separate integration).
- No custom extension icons yet (still WXT/React starter defaults).
- Definitions for a language are sourced from a single wiki
  (`en.wiktionary.org`); very obscure words may have no entry there.
- Not published to the Chrome Web Store.
