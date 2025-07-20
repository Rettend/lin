# Adapter Refactor Roadmap

> Goal: introduce a **first-class adapter layer** so that Lin can treat each _content type_ (JSON, Markdown, …) in a uniform way.
> This removes hard-coded markdown logic from `check`/`sync` and prepares the ground for future formats (e.g. YAML, CSV, HTML, PO).

---

## 1. Terminology & Target Architecture

• **Adapter** – a module that knows how to _extract_ translation units from a file type and how to _render_ them back.
• **Source locale** – the canonical language we translate _from_ (currently `i18n.defaultLocale`).
• **Target locale** – any language we translate _to_.

```
┌──────────────┐   extract   ┌──────────────┐   translate   ┌──────────────┐
│  <file.xxx>  │ ──────────▶│  <units.json>│ ─────────────▶│  <units.json>│
└──────────────┘             └──────────────┘               └──────────────┘
                                     ▲                           │
                                     │           render          │
                                     └───────────────────────────┘
```

All commands (`check`, `sync`, `translate`, …) will:

1. Resolve **which adapters** are enabled (CLI `--adapter` flag or `config.adapters`).
2. For each adapter run its lifecycle (check/extract/translate/render) **independently**.
3. Print grouped console output, e.g. vertical bars:

```
JSON     | ✓ All locales up-to-date (13 keys)
Markdown | ⚠  4 missing keys → translating…  ✓ done
```

---

## 2. Config Changes

### 2.1 `lin.config.ts`

```ts
export default defineConfig({
  i18n: { /* unchanged */ },
  adapters: {
    json: {
      /** keep current defaults, plus future knobs like `sort: 'abc'` */
    },
    markdown: {
      files: ['docs/**/*.mdx'],      // moved from top-level markdown.files
      localesDir: '.lin/markdown',   // moved from markdown.localesDir
    },
    // yaml: { … }
  },
  // global options…
})
```

* `markdown` & future formats live under `adapters.<name>`.
* Top-level `markdown` key is deprecated.
* `config.adapters` keys **must** match the adapter id exported in `src/adapters/index.ts`.

### 2.2 CLI Args

* New shared flag `--adapter (-A)` accepting comma-separated list or `all` (default).
* Commands that previously accepted `--locale`, `--with`, etc. keep them – they act **inside** each adapter.

Examples:

```
lin sync                    # all adapters
lin sync -A json            # only json
lin translate -A markdown   # markdown only
```

---

## 3. Code Refactor Steps

1. **Define `AdapterContext` type** in `src/adapters/index.ts`:

   ```ts
   export interface AdapterContext {
     config: DeepRequired<ResolvedConfig>  // full config
     i18n: I18nConfig
   }
   ```

   Each adapter’s `extract`/`render` becomes `extract(ctx, filePath, source)` …

2. **Move hard-coded markdown logic** from `check.ts` & `sync.ts` into
   `adapters/markdown.ts` – expose new helper functions:

   ```ts
   export async function collectFiles(cfg: MarkdownConfig, cwd: string): Promise<string[]> { … }
   export function getSnapshotPath(locale: string, cfg: MarkdownConfig, cwd: string): string { … }
   ```

3. **Create a thin service layer** `src/engine/<adapter>.ts` per adapter that
   implements:
   * `checkMissing()` – returns missing / unused keys
   * `addMissing()` / `removeUnused()`
   * `sync()` – figure out keysToTranslate & call `translateKeys`

   Commands will import these engine functions instead of touching fs directly.

4. **Update Commands**
   * Introduce `for (const adapterId of selectedAdapters)` loops in `check`, `sync`, `translate`, etc.
   * Preserve current JSON behaviour by implementing a `json` engine that simply proxies existing logic.

5. **Console Grouping Utility** – helper in `utils/console.ts`:

   ```ts
   export async function section(title: string, task: () => Promise<void>) { … }
   ```

   It draws a prefix bar and indents output while `task` runs.

---

## 4. Incremental Implementation Plan

| Phase | Scope | Outcome |
|-------|-------|---------|
| 1 | Types & Config scaffolding | `config.adapters` typed, CLI `--adapter` parsed but **no behaviour change** |
| 2 | Engine extraction | Move markdown logic into `engine/markdown.ts`; commands call new engine but flow identical |
| 3 | Loop over adapters | Commands iterate over selected adapters; JSON & Markdown work side-by-side |
| 4 | Console polish | Nice sectioned output, verbose/silent respected |
| 5 | Future work | Add sample `yaml` adapter, adapter test harness |

---

## 5. Testing & QA

* **Unit tests** per engine (extract → translate → render) using Vitest.
* **Integration tests**: replicate `test/commands/*` for markdown flow.
* **Docs**: update `docs/` pages.

---

## 6. Potential Challenges

1. _Translation context size_: batching across adapters must respect token limits.
2. _Undo history_: must track writes/deletes per adapter consistently.
3. _Performance_: avoid parsing same markdown file multiple times.

---

### Outcome

With this refactor Lin gains:
• Clean separation of concerns.
• Easy path to add new formats.
• Simpler commands (adapter-agnostic core).
• Feature parity with tools like **Languine**.
