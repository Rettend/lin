import type { StringArgDef } from 'citty'
import type { CommonConfig, ConfigToArgDef, LinConfig } from './types'
import { providers } from './constants'

type CommonArgs = ConfigToArgDef<CommonConfig>
type LLMArgs = Omit<ConfigToArgDef<LinConfig>, 'options' | 'i18n' | 'limits'> & {
  'provider': StringArgDef
  'model': StringArgDef
  'mode': StringArgDef
  'temperature': StringArgDef
  'limit.locale': StringArgDef
  'limit.key': StringArgDef
  'limit.char': StringArgDef
}

export const commonArgs = {
  locale: {
    alias: 'l',
    type: 'string',
    description: 'only act on a specific locale',
  },
  cwd: {
    alias: 'c',
    type: 'string',
    description: 'project root',
  },
  debug: {
    alias: 'd',
    type: 'boolean',
    description: 'debug mode',
  },
  adapter: {
    alias: 'a',
    type: 'string',
    description: 'the adapter(s) to use',
    default: 'all',
  },
  undo: {
    type: 'boolean',
    description: 'enable/disable undo history, use --no-undo to disable',
  },
} as const satisfies CommonArgs

export const llmArgs = {
  'context': {
    alias: 'C',
    type: 'string',
    description: 'extra information to include in the LLM system prompt',
  },
  'integration': {
    alias: 'i',
    type: 'string',
    description: 'the i18n integration used',
  },
  'provider': {
    alias: 'p',
    type: 'string',
    description: `the LLM provider to use (e.g., ${providers.join(', ')})`,
  },
  'model': {
    alias: 'm',
    type: 'string',
    description: 'the model to use (e.g., gpt-4.1-mini)',
  },
  'limit.locale': {
    alias: 'll',
    type: 'string',
    description: 'the number of locales to process in a single LLM request',
  },
  'limit.key': {
    alias: 'lk',
    type: 'string',
    description: 'the number of keys to process in a single LLM request',
  },
  'limit.char': {
    alias: 'lc',
    type: 'string',
    description: 'the maximum number of characters to process in a single LLM request',
  },
  'mode': {
    type: 'string',
    description: 'the output mode to use for the LLM',
    valueHint: 'auto | json | custom',
  },
  'temperature': {
    alias: 't',
    type: 'string',
    description: 'the temperature to use',
  },
  'with': {
    alias: 'w',
    type: 'string',
    description: 'the context profile to use. (def, tgt, both, all, or locales like en)',
  },
} as const satisfies LLMArgs

export const allArgs = { ...commonArgs, ...llmArgs }
