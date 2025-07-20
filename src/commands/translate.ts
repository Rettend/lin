import { defineCommand } from 'citty'
import { allArgs, resolveConfig } from '@/config'
import { r } from '@/utils'
import { saveUndoState } from '@/utils/undo'
import checkCommand from './check'
import syncCommand from './sync'

export default defineCommand({
  meta: {
    name: 'translate',
    description: 'Find new keys, add them to locales, and translate them. An alias for `check -f` + `sync`.',
  },
  args: {
    ...allArgs,
    locale: {
      type: 'positional',
      description: 'the locales to translate',
      required: false,
      valueHint: 'all | def | en | en-US',
    },
    silent: {
      alias: 'S',
      type: 'boolean',
      description: 'show minimal, script-friendly output',
      default: false,
    },
    prune: {
      alias: 'u',
      type: 'boolean',
      description: 'remove unused keys from all locales',
      default: false,
    },
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)

    if (config.undo) {
      const localeFiles = config.i18n.locales.map(locale => r(`${locale}.json`, config))
      saveUndoState(localeFiles, config as any)
    }

    const checkArgs: any = {
      ...args,
      silent: args.silent,
      fix: true,
      keys: false,
      prune: args.prune,
      info: false,
      undo: false,
    }

    await checkCommand.run?.({ args: checkArgs, rawArgs: [], cmd: checkCommand.meta as any })

    const syncArgs: any = {
      ...args,
      force: false,
      undo: false,
      silent: args.silent,
    }

    await syncCommand.run?.({ args: syncArgs, rawArgs: [], cmd: syncCommand.meta as any })
  },
})
