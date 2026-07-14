import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Lexi Recall',
    description:
      'Highlight English or Russian words on any page, look up definitions, and review them with spaced multiple-choice recall.',
    permissions: ['storage'],
    // Highlighting needs to work on any page the user is reading; definitions
    // and quiz distractors are fetched from Wiktionary/Wikimedia.
    host_permissions: [
      '*://*.wiktionary.org/*',
      '*://*.wikipedia.org/*',
    ],
  },
});
