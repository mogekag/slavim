# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Overview

Lexi Recall is a Manifest V3 Chrome extension (WXT + TypeScript + React) for
building English/Russian vocabulary: highlight a word on any page → see a
Wiktionary definition in a popup → save it → review saved words later via
Anki-style multiple-choice recall sessions. No backend — all data lives in
`chrome.storage`, all dictionary lookups go directly to public Wiktionary/
Wikimedia APIs from the extension itself.

Full feature rationale and the original planning discussion live in
[README.md](./README.md); this file is about how the code is actually built
and the non-obvious traps in this problem space.

## Commands

```bash
npm run dev        # wxt dev — hot-reload Chrome instance with extension loaded
npm run build       # production build -> .output/chrome-mv3
npm run compile      # tsc --noEmit
npm run test          # vitest run (unit tests only, colocated *.test.ts files)
```

There is no e2e test suite committed to the repo. During initial development,
correctness was verified with an ad-hoc Playwright script that launched
Chromium via `chromium.launchPersistentContext` with
`--load-extension=.output/chrome-mv3`, loaded a local HTML fixture, and drove
the highlight → save → manager → recall flow. That script is not checked in
(it was a scratch verification tool), but the same technique is the right one
to reach for if you need to prove an end-to-end behavior rather than just
typecheck it — **typechecking alone missed all three bugs below.**

## Architecture

### Entrypoints (WXT convention: `entrypoints/*` maps to manifest surfaces)

- `content.tsx` — content script, `matches: ['<all_urls>']`. Mounts
  `HighlightPopup` into a shadow root via `createShadowRootUi(ctx, { position: 'modal', ... })`.
- `popup/` — toolbar popup (small window from the extension icon).
- `manager/` — an **unlisted page** (plain extension tab, opened via
  `browser.tabs.create({ url: browser.runtime.getURL('/manager.html') })`).
  This is where browsing and recall sessions actually happen — the toolbar
  popup is deliberately minimal.
- `background.ts` — essentially empty. Dictionary/Wikimedia fetches happen
  directly from content scripts and extension pages, not proxied through the
  background service worker, because `host_permissions` grants CORS-safe
  fetch access from any extension context, not just the background.

WXT auto-imports certain globals project-wide (see `.wxt/types/imports.d.ts`
after running `wxt prepare`) — notably `browser`, `storage`,
`createShadowRootUi`, `defineContentScript`, `defineBackground`, and React
hooks. **Do not add explicit imports for these** — they're already global.
Path alias `@/*` maps to the project root (e.g. `@/types/word`,
`@/lib/storage`).

### Storage split (`lib/storage.ts`)

`chrome.storage.sync` has a hard ~100KB total / 8KB-per-item / 512-item quota
— nowhere near enough to sync full definitions for hundreds of words. Data is
therefore split:

- **`sync:stat:{lang}:{word}`** — small `WordStats` record (counts, streak,
  `learned` flag, timestamps). This is what needs to follow the user across
  devices, and it's small enough to comfortably fit the quota.
- **`local:content:{lang}:{word}`** — `WordContent` (definition, POS,
  example). Not synced. If missing (e.g. freshly synced to a new device),
  `lib/dictionary.ts#lookupWord` re-fetches it from Wiktionary on demand.

`getAllWords()` joins the two. `watchStats()` wraps
`browser.storage.onChanged` filtered to the `sync` area and the `stat:`
prefix — this is what the manager page and toolbar popup use to live-update.

### Dictionary (`lib/dictionary.ts`)

Both English **and** Russian definitions are fetched from
**`en.wiktionary.org`**, not `ru.wiktionary.org`. This is intentional, not a
bug: `ru.wiktionary.org`'s REST definition endpoint returns `501` (unsupported
on that wiki), whereas `en.wiktionary.org` documents headwords from hundreds
of languages in one response, keyed by ISO code (e.g. a `ru` key with
English-language definitions of the Russian word). If you ever need to add a
third language, verify this same-endpoint behavior for it first —
`curl -s https://en.wiktionary.org/api/rest_v1/page/definition/<word> | jq` is the
fastest way to check.

**Sense selection is deliberately biased**, not "first entry wins": Wiktionary
orders senses editorially, not by how common they are. Querying "fox" returns
`Symbol` (an ISO 639-5 language code) *before* `Noun` (the animal), and some
entries have an empty first `definition` string. `POS_PRIORITY` in
`dictionary.ts` ranks common parts of speech (Noun, Verb, Adjective, …) ahead
of everything else, and `firstNonEmptyDefinition` skips blank entries. If
lookups start returning obscure/wrong senses again, this is the first place
to check — don't revert to `entries[0].definitions[0]`.

No IPA/phonetic field is populated — the REST definition endpoint doesn't
expose it. Adding it would require a separate API call/parse path.

### Distractors (`lib/distractors.ts`)

Quiz wrong-answers are built by pulling random Wiktionary page titles
(`action=query&list=random`) and keeping only the ones with an entry in the
target language — most random titles are headwords in *other* languages, so
this needs multiple batches, especially for Russian (a smaller share of
Wiktionary's random pages than English).

**This is rate-limit-sensitive.** An earlier version fired ~40 definition
fetches per batch via a bare `Promise.all` and reliably got 429'd by
Wikimedia mid-session, which threw and killed the entire recall session with
no fallback. The fix, and the constraint to preserve if you touch this file:
a hand-rolled concurrency limiter (`mapWithConcurrency`, capped at
`CONCURRENCY = 6`) plus best-effort failure handling — a failed batch
`break`s out of the loop and returns whatever was already found, instead of
throwing. A quiz question can render with fewer than 3 distractors; it should
never hard-fail the session. If you increase `BATCH_SIZE`/`MAX_BATCHES`,
re-verify against the live API rather than assuming it's fine.

### Content script UI (`components/HighlightPopup.tsx`, `assets/highlight-popup.css`)

The shadow-root UI uses `position: 'modal'`, which makes WXT set the shadow
tree's positioning wrapper (`html`/`body`-equivalent inside the shadow root)
to `position: fixed; inset: 0` — i.e. it spans the entire viewport so the
popup can be placed anywhere via a plain `left`/`top`. **That full-viewport
element defaults to intercepting all pointer events**, which silently makes
the entire underlying page unclickable and unselectable the moment the
content script mounts — this shipped once and was only caught by driving a
real browser, not by typechecking or code review. The fix lives in
`assets/highlight-popup.css`:

```css
:host, html, body { pointer-events: none !important; }
.lexi-popup { pointer-events: auto; }
```

If you add new shadow-root UI elements, they need `pointer-events: auto`
explicitly, or they'll be invisible to clicks.

Outside-click / dismiss detection uses `event.composedPath()` rather than
`event.target`, because `target` gets retargeted to the shadow host for
listeners outside the shadow tree — `composedPath()` still exposes the real
internal element for an `open`-mode shadow root (which is what's used here).

### Recall engine (`lib/quiz-selection.ts`, `components/RecallSession.tsx`, `components/QuizCard.tsx`)

- Session word selection is a simple priority score (`lib/quiz-selection.ts`):
  `(1 - accuracy) * 0.7 + staleness * 0.3`, not full spaced-repetition (no
  SM-2/interval scheduling) — matches the product spec's simpler "10
  consecutive correct → learned" rule rather than Anki's actual algorithm.
- Promotion logic lives in `lib/storage.ts#recordAnswer`: `consecutiveCorrect`
  increments on correct, resets to 0 on any wrong answer, and `learned` flips
  true once it hits `PROMOTION_STREAK = 10`. This is unit-tested in
  `lib/storage.test.ts` — if you change the rule, update those tests, they're
  the fastest way to check the streak/reset/promotion edges without clicking
  through 10 quiz rounds by hand.
- Quiz direction (word→definition vs definition→word) is randomized per
  question in `RecallSession.tsx#pickDirection`.
- Distractor pools are fetched **once per language per session** (not once
  per question) and sampled from per question, for latency reasons. This
  means within one session, the same distractor word can repeat across
  different questions of the same language — acceptable for v1, but a place
  to improve if session sizes grow much larger than the default of 10.

## Testing conventions

- Unit tests are colocated (`lib/foo.ts` + `lib/foo.test.ts`), using Vitest.
- `vitest.config.ts` uses `WxtVitest()` from `wxt/testing/vitest-plugin`,
  which wires up the same path aliases and auto-imports as the extension
  build — including the global `fakeBrowser` (from `@webext-core/fake-browser`
  via `wxt/testing`) for mocking `chrome.storage` in tests. Call
  `fakeBrowser.reset()` in `beforeEach` when a test touches storage.
- There's deliberately no component/DOM test layer — the highest-value bugs
  found so far (pointer-events, rate limiting, wrong dictionary sense) were
  all things a component test wouldn't have caught; they needed a real
  browser exercising the real API. Prefer extending the manual/Playwright
  verification pass over adding React Testing Library scaffolding, unless a
  specific component's logic gets complex enough to warrant it.

## Data model (`types/word.ts`)

- `WordStats` — synced, small, mutable via quiz answers.
- `WordContent` — local cache, immutable once fetched (word/lang/definition/
  POS/example/sourceUrl).
- `WordEntry = WordStats & { content?: WordContent }` — the joined shape used
  throughout the UI layer.
- `statKey`/`contentKey` build the storage key strings; language and word are
  lower-cased for the key but the original casing is preserved in the stored
  value's `word` field for display.

## Known gaps / next steps

- No custom extension icons (still WXT/React starter defaults in `public/icon`).
- Not published to the Chrome Web Store.
- No phonetic/IPA pronunciation.
- No git repository initialized yet for this project.
