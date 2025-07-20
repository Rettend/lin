# TODO

## v1.0.0

- [x] REFACTOR
- [x] support a ton of i18n frameworks
- [x] **`undo` command:** undo the last command, store prev file in .lin folder
- [x] support any LLM
- [x] model presets

## v1.1.0

- [x] key suggestions
- [x] better context management
- [x] **`check` command:** lint codebase for missing keys (compare to default locale json), `--fix` to add empty keys, `--remove-unused` to remove unused keys

## v2.0.0

- [x] **`sync` command:** rename old `translate` command to `sync`
- [x] **NEW `translate` command:** the e2e magic command: `check -f` + default locale values from t('key', 'default value') + `sync`
- [x] add github action example with `translate`
- [x] batch size config for how many locales to translate at once

## v2.1.0

- [x] programmatic usage, capture output and writes
- [x] the readme is yuge, create lin docs instead

## v3.0.0

- [x] adapter layer, support json and markdown too
- [ ] markdown works with check, sync, translate
- [ ] why is sort in adapters.json? it should work on markdown too
- [ ] allow any model string not in lin constants to be used
- [ ] fix gemini schema issue: <https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/control-generated-output#fields>, <https://github.com/vercel/ai/issues/4725>
- [ ] update docs

## later

- [ ] add a ton of parser tests, like do we even need i18next-parser if it fails randomly and we only need key and default value?
- [ ] vercel ai sdk v5
- [ ] custom llm system prompt:

  ```ts
  {
    system: (targetLocale, ...args) => `...`
    system: (targetLocale, ...args) => {
      switch (targetLocale) {
        case 'ko-KR':
          return `...`
        default:
          return `...`
      }
    }
  }
  ```

- [ ] config for llm reasoning tokens and reasoning effort
- [ ] `estimateTokens: boolean` config to enable/disable token estimation, show estimated tokens and ask before the llm call
- [ ] **`verify` command:** reflect on the quality of the translations, check if the translations are accurate
- [ ] **`convert` command:** convert a project to use i18n by extracting all the strings from the code and adding them to the locale json files.
