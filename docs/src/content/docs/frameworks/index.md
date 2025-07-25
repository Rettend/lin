---
title: Integrations
description: How lin automatically detects your i18n setup.
---

`lin` will try to automatically detect your i18n configuration from your existing project setup.
If that fails, just use `lin.config.ts` or `i18n.config.ts`.

To force it to use a specific integration, use the `integration` option in your `lin.config.ts` or the `--integration` (`-i`) flag.

Supported integrations:

    - i18next (`i18next-parser.config.js`)
    - Next.js (`next.config.js`)
    - Nuxt.js (`nuxt.config.js`)
    - Vue I18n (`vue.config.js`)
    - Angular (`angular.json`)
    - Svelte (`svelte.config.js`)
    - Ember.js (`ember-cli-build.js`)
    - Gatsby (`gatsby-config.js`)
    - Solid.js (`vite.config.js`)
    - Qwik (`vite.config.js` or `package.json`)
    - Astro (`astro.config.mjs` or `astro-i18next.config.mjs`)
    - Remix (`package.json`)
