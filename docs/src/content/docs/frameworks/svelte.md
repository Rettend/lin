---
title: Svelte
description: Using lin with Svelte projects.
---

For Svelte projects, it is recommended to set `integration: 'svelte'` in your `lin.config.ts` to use a custom parser that correctly handles key extraction from `.svelte` files.

```ts
// lin.config.ts
import { defineConfig } from '@rttnd/lin'

export default defineConfig({
  integration: 'svelte',
})
``` 