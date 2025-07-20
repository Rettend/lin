<h1 align="center">lin</h1>
<p align="center">
  <code>lin</code> is a CLI tool that translates locale JSONs using LLMs
</p>

[![NPM Version](https://img.shields.io/npm/v/%40Rettend%2Flin?color=red)](https://www.npmjs.com/package/%40Rettend%2Flin)
[![JSR Version](https://img.shields.io/jsr/v/%40rttnd/lin?color=yellow)](https://jsr.io/%40rttnd/lin)

Check out the [docs](https://lin.rettend.me) or continue reading below.

## get started

### install

```bash
npm i -D @rttnd/lin
```

or use `-g` to install globally for non-npm projects.

### setup

You will need:

- a project with i18n set up
- a default locale JSON file (e.g. `en-US.json`)
- API keys for your chosen LLM providers in your .env file (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)

See [LLM Config](#llm-config).

`lin` will try to automatically detect your i18n configuration from your existing project setup. It supports:

- i18next (`i18next-parser.config.js`)
- Next.js (`next.config.js`)
- Nuxt.js (`nuxt.config.js`)
- Vue I18n (`vue.config.js`)
- Angular (`angular.json`)
- Svelte (`svelte.config.js`): ⚠️ There were issues with parsing svelte files, please set `integration: 'svelte'` in your lin config to use a custom parser.
- Ember.js (`ember-cli-build.js`)
- Gatsby (`gatsby-config.js`)
- Solid.js (`vite.config.js`)
- Qwik (`vite.config.js` or `package.json`)
- Astro (`astro.config.mjs` or `astro-i18next.config.mjs`)
- Remix (`package.json`)

If your setup is not detected automatically, you can specify the integration using the `integration` config, and `lin` will only try to load the specified framework.

Or you can create a configuration file to tell `lin` about your i18n setup. You have two options:

1. **Use `lin.config.ts`**:
    Add an `i18n` object to your main `lin.config.ts` file.

    Example `lin.config.ts`:

    ```ts
    import { defineConfig } from '@rttnd/lin'

    export default defineConfig({
      i18n: {
        locales: ['en-US', 'es-ES'],
        defaultLocale: 'en-US',
        directory: 'locales',
      },
      // ... other lin config
    })
    ```

2. **Use `i18n.config.ts`**:
    Or if you don't plan to use other `lin` config, just create a `i18n.config.ts` file.

    Example `i18n.config.ts`:

    ```ts
    import { defineI18nConfig } from '@rttnd/lin'

    export default defineI18nConfig({
      locales: ['en-US', 'es-ES'],
      defaultLocale: 'en-US',
      directory: 'locales',
    })
    ```

## usage

You can use `lin` in the terminal, in [GitHub Actions](#ci), or [programmatically](#programmatic-usage).

> [!TIP]
> Run `lin -h` and `lin <command> -h` to see all the options.

The main command is **`translate`**. It automates the entire process of finding new keys in your code, adding them to your default locale, and translating them into all other languages.

For it to work, you need to provide a default value when you use your translation function:

```js
t('header.title', 'Default value')
```

Then, just run:

```bash
lin translate
```

`lin` will find `header.title`, add it to your default locale file with the value "Default value", and then translate it to all other locales.

Use the [`with`](#with-in-config-and-cli) option to manage the LLM's context.

To translate only specific locales, list them like this:

```bash
lin translate es fr
```

To also remove unused keys from all locales, use the `--remove-unused` flag:

```bash
lin translate -r
```

To make the output more minimal (for CI or scripts), use the `--silent` flag:

```bash
lin translate -S
```

### CI

You can use `translate` in GitHub Actions. `lin` will automatically find new keys, add them to your locales, and translate them on every push to `main`.

Here's an example workflow:

```yaml
# .github/workflows/lin.yml
name: Lin Translate

on:
  push:
    branches:
      - main

jobs:
  translate:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: checkout repo
        uses: actions/checkout@v4

      - name: setup bun
        uses: oven-sh/setup-bun@v2

      - name: install deps
        run: bun install

      - name: lin translate
        run: bunx lin translate -S
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          # Add other provider API keys as needed
          # GOOGLE_GENERATIVE_AI_API_KEY: ${{ secrets.GOOGLE_GENERATIVE_AI_API_KEY }}
          # GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
          # CEREBRAS_API_KEY: ${{ secrets.CEREBRAS_API_KEY }}

      - name: commit and push changes
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
          git add locales/
          if ! git diff --staged --quiet; then
            git commit -m "i18n: auto-translate locales"
            git push
          fi
```

Don't forget to add your LLM provider API keys to your repo secrets.

---

While `translate` is the most end-to-end command, `lin` provides more granular commands for specific tasks:

- **`translate`**: `check --fix` + `sync`
- **`sync`**: Translates missing keys from your default locale to all other locales using LLMs.
- **`add`**: Adds a new key to your default locale and translates it to all other locales using LLMs.
- **`edit`**: Edit an existing key and its translations manually.
- **`del`**: Remove one or more keys.
- **`check`**: Validate locale files, check for missing/unused keys, or sort them. Quick config check.
- **`models`**: List available LLM models.
- **`undo`**: Revert the last change made by `translate`, `sync`, `add`, `del`, `edit`, or `check`.

### sync

The **sync** command syncs all locale JSON files with the default locale JSON file. It finds the missing keys in locales, and translates them.

```bash
lin sync
```

To sync only specific locales, list them like this:

```bash
lin sync es fr
```

You can also use the `sync` command to **add a new language**.

1. First add the locale code to `locales` in the i18n config
2. Then run `lin sync` and it will create the new locale JSON file

> [!NOTE]
> There is some syntax around **locale codes**:
>
> - Locale JSON file names must match the codes in your `locales` configuration (e.g., `en-US.json` for an `'en-US'` entry).
> - Short codes like `'en'` also work (e.g., `'en.json'`), but these also function as shorthands: `lin sync en` will match all locales starting with `en-` (like `en-US` and `en-GB`).
> - `all` is a special keyword that matches all locales
> - `def` means the default locale from the config

### add

`add` can be useful when writing a new part of the UI. You can use it to quickly add a new key to the default locale and translate it to all the other locales.

```bash
lin add ui.button.save Text of the save button
```

`ui.button.save` will be the key, and `Text of the save button` will be the value for the default locale. This will then be translated to all other locales.

> [!NOTE]
> if the key is nested, it should be in dot notation like `ui.button.save`

To add a key to only specific locales, use the `-l` flag. You can repeat the flag for multiple locales.

```bash
lin add -l es -l fr -l def ui.button.save Text of the save button
```

This will add the key to `es` and `fr` locales (and the default locale).

> [!TIP]
> The `add`, `edit`, and `del` commands support key suggestions. If you're not sure about a key, try one of these:
>
> - End your key with a dot to see all available sub-keys (e.g., `lin del ui.button.`).
> - Type the beginning of a key to get suggestions for matching keys (e.g., `lin edit ui.but`).
>
> `lin add ui.b` will show suggestions, but if you really want to add an empty key, use an empty string: `lin add ui.b ""`

### edit

`edit` can be used to quickly edit an existing key in the default locale and all the other locales.

This is a niche command, but maybe useful for quickly editing a specific key without having to search for it, or for LLM agents if you don't want to feed the entire locale json file, or have them edit the files themselves.

```bash
lin edit ui.button.save Text of the save button
```

To edit a key in only specific locales, use the `-l` flag.

```bash
lin edit -l en ui.button.save Text of the save button
```

### del

`del` removes keys from the locale JSON files.

```bash
lin del nav.title footer.description
```

### check

The `check` command is a versatile tool for validating and maintaining locale files.
It's ideal for running in pre-commit hooks or in CI.

By default, it lints your codebase for missing and unused translation keys by comparing your source files against the default locale.

```bash
lin check
```

To get a minimal output, use the `--silent` or `-S` flag. This is recommended for CI and git hooks. See [check with git hooks](#check-with-git-hooks).

```bash
lin check -S
```

This will report any discrepancies. To add the missing keys to your default locale file with empty strings instead of throwing an error, use the `--fix` flag:

```bash
lin check -f
```

To remove unused keys from all locale files, use the `--remove-unused` flag.

```bash
lin check -r
```

You can also use `check` to find missing keys in your locales compared to the default locale file with the `--keys` flag (this skips the codebase parsing):

```bash
lin check -k
```

This will report any discrepancies. If you want to automatically add the missing keys with empty strings, use the `--fix` flag:

```bash
lin check -k -f
```

You can also use `check` to sort your locale JSON files, either alphabetically or based on the key order in your default locale file.

```bash
lin check -s abc # sort alphabetically
lin check -s def # sort by default locale
```

To display detailed info about your config and locales, use the `--info` flag:

```bash
lin check -i
```

### check with git hooks

A great way to enforce i18n consistency is to run `lin check` automatically before each commit. You can use `simple-git-hooks` with `lint-staged` to set this up easily.

Add this to your `package.json`:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  },
  "lint-staged": {
    "{src/**/*.{js,jsx,ts,tsx,vue,svelte,astro},locales/**/*.json}": "lin check -S"
  }
}
```

Then run:

```bash
npm i -D lint-staged simple-git-hooks

# activate hooks
npx simple-git-hooks
```

You can also run `lin check -S -f` or `lin check -S -r` to automatically fix issues, or even `lin translate -S` to translate them too.

### undo

`undo` reverts the last changes made by `translate`, `sync`, `add`, `del`, `edit`, or `check`.

```bash
lin undo
```

### models

To see a list of all available LLM providers and models:

- Run `lin -M`, `lin --models` or `lin models` to list all models.
- To filter by provider, just specify providers after the command: `lin -M openai google`

### programmatic usage

You can also use `lin` as a library and run commands programmatically. This is useful for integrating `lin` into your own scripts or tools.

All commands and types are exported from the main package entry point.

The `run` function allows you to execute any command:

```ts
import { run } from '@rttnd/lin'

// Simple usage: run the 'translate' command with the --silent flag
await run('translate', ['-S'])
```

#### Advanced Usage

The `run` function accepts an optional third argument, `options`, to control execution behavior. It returns a `RunResult` object with details about the execution.

```ts
function run(
  command: keyof Commands,
  rawArgs?: string[],
  options?: {
    dry?: boolean // default: false
    output?: 'live' | 'capture' | 'silent' // default: 'live'
  }
): Promise<{
  result: unknown
  output?: string
  writes?: Record<string, string>
  deletes?: string[]
}>
```

- **`dry`**: A boolean that, if `true`, prevents any file system modifications. Instead of writing or deleting files, `run` will return the planned changes in the `writes` and `deletes` objects.
- **`output`**: can return the console output in `output`
  - `'live'`   (default) – print only.
  - `'capture'` – print *and* return captured text.
  - `'silent'`  – capture text *without* printing.

**Example: Dry Run with Output Capture**

Here's how you can see what files `check --fix` would change, without actually modifying your disk:

```ts
import { run } from '@rttnd/lin'

const { output, writes } = await run(
  'check',
  ['--fix'],
  { dry: true, output: 'silent' },
)

console.log('--- Captured Console Output ---')
console.log(output)

console.log('\n--- Files to be Written ---')
for (const [file, content] of Object.entries(writes || {})) {
  console.log(`File: ${file}`)
  console.log(content) // content is the full file content
}
```

## config

> [!TIP]
> All properties in the config can be used as CLI flags too.

`lin` automatically saves a backup of any files modified by the `add`, `del`, `check`, and `translate` commands. You can disable this feature with the `--no-undo` flag, or by setting `undo: false` in your config file.

> [!IMPORTANT]
> Otherwise, add the `.lin` directory to your `.gitignore` file.

### config file

`lin` uses `unconfig` to find and load your configuration files. You can use one of the following:

- `lin.config.ts` (or `.js`, `.mjs`, etc.)
- `.linrc` (without extension or `.json`)
- `lin` property in `package.json`
If you are not using one of the auto-detected frameworks, you can put your i18n config inside your `lin` config, or create a separate `i18n.config.ts` file.

See [`src/config/i18n.ts`](./src/config/i18n.ts) for a full list of configuration sources.

### LLM config

*for the `add` and `sync` commands*

`lin` uses the [Vercel AI SDK](https://sdk.vercel.ai/) to support multiple LLM providers. The currently supported providers are:

- `openai`
- `anthropic`
- `google`
- `xai`
- `mistral`
- `groq`
- `azure`

You need to specify the model and the provider in your configuration or via the `--model` (`-m`) and `--provider` (`-p`) CLI flags.

Make sure the corresponding API key is set in your env variables (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

Example `lin.config.ts` with LLM options:

```ts
import { defineConfig } from '@rttnd/lin'

export default defineConfig({
  options: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    temperature: 0,
  }
})
```

All options under `options` are passed to the Vercel AI SDK.

#### `presets` in config and CLI

To save LLM options, you can define and name different model configurations in your `lin.config.ts` file.

```ts
// lin.config.ts
export default defineConfig({
  options: {
    provider: 'openai',
    model: 'gpt-4.1-mini',
  },
  presets: {
    'creative-claude': {
      provider: 'anthropic',
      model: 'claude-sonnet-4-0',
      temperature: 0.6,
      context: 'Use a playful tone.'
    },
    'fast-deepseek': {
      provider: 'groq',
      model: 'deepseek-r1-distill-llama-70b',
    },
  }
})
```

You can then activate a preset using the `--model` flag. Any other CLI flags will override the preset's values.

```bash
# Use the 'creative-claude' preset
lin sync -m creative-claude

# Use the 'fast-deepseek' preset, but override the temperature
lin add ui.new.feature A new feature -m fast-deepseek -t 0
```

#### `context` in config

This simple string is directly added to the system prompt. Use it to provide extra information to the LLM about your project.

#### `batchSize` in config and CLI

The `batchSize` option controls how many target locale files are sent to the LLM for translation in a single request. This can be useful for projects with many languages.

You can set this in your `lin.config.ts` using `batchSize` or use the `--batchSize` (or `-b`) flag in the CLI. The CLI flag will always override the config file setting.

#### `with` in config and CLI

The `with` option allows you to control which locale files are included in the LLM's context window. This can significantly improve translation quality by providing the model with more context about your project's wording and style.

You can set this in your `lin.config.ts` using `with` or use the `--with` (or `-w`) flag in the CLI. The CLI flag will always override the config file setting.

**Context Profiles:**

- `none` (default): Only the keys to be translated are sent to the LLM. This is the most cost-effective option.
- `def`: Includes the entire default locale JSON file (e.g., `en-US.json`) in the context.
- `tgt`: Includes the full JSON of each locale currently being translated.
- `both`: Includes both the default locale file and the target locale files.
- `all`: Includes every locale JSON file in the context. This may be expensive.
- `<locale>`: You can also provide one or more specific locale codes (e.g., `es-ES`, `fr`).

**Examples:**

```ts
// lin.config.ts
export default defineConfig({
  with: 'tgt',
})
```

```bash
# Override config and use 'both' profile for this command
lin sync -w both

# Provide specific locales for context
lin add ui.new.key New Key -w es-ES -w fr-FR

# Force no additional context, overriding any config
lin sync -w none
```
