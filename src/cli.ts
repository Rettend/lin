import process from 'node:process'
import { defineCommand, runMain, showUsage } from 'citty'
import { commands } from '@/commands'
import { commonArgs, resolveConfig } from '@/config'
import { console, destroyRegistry, ICONS } from '@/utils'
import { description, version } from '../package.json'
import 'dotenv/config'

const main = defineCommand({
  meta: {
    name: 'lin',
    version,
    description,
  },
  args: {
    version: {
      alias: 'v',
      type: 'boolean',
      description: 'show version',
    },
    ...commonArgs,
  },
  subCommands: commands,
  async run({ args, cmd, rawArgs }) {
    if (args.version)
      console.log(`lin \`v${version}\``)

    if (rawArgs.length === 0 && !args.version)
      showUsage(cmd)

    const { config } = await resolveConfig(args)
    if (args.debug) {
      console.log(ICONS.info, 'Config:')
      const redactedConfig = { ...config }
      if (redactedConfig.options?.apiKey)
        redactedConfig.options = { ...redactedConfig.options, apiKey: '***' }

      console.log(redactedConfig)
    }
  },
})

const rawArgs = process.argv.slice(2)
const providers = []
const otherArgs = []
let isModels = false

for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i]
  if (arg === '-M' || arg === '--models') {
    isModels = true
    if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
      providers.push(rawArgs[i + 1])
      i++
    }
    continue
  }
  if (arg.startsWith('--models=')) {
    isModels = true
    providers.push(arg.split('=')[1])
    continue
  }
  otherArgs.push(arg)
}

let finalArgs = rawArgs
if (isModels) {
  const commandsInArgs = otherArgs.filter(arg => Object.keys(commands).includes(arg))
  if (commandsInArgs.length === 0)
    finalArgs = ['models', ...providers, ...otherArgs]
}

runMain(main, { rawArgs: finalArgs })
  .then(() => {
    destroyRegistry()
  })
  .catch((err) => {
    console.error(err)
    destroyRegistry()
    process.exit(1)
  })
