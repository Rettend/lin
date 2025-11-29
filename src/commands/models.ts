import { defineCommand } from 'citty'
import c from 'picocolors'
import { resolveConfig } from '@/config'
import { commonArgs } from '@/config/args'
import { console, generateScoreDots, ICONS } from '@/utils/console'
import { getRegistry } from '@/utils/llm'

export default defineCommand({
  meta: {
    name: 'models',
    description: 'List available LLM models',
  },
  args: {
    ...commonArgs,
    'provider': {
      type: 'string',
      description: 'Filter by provider',
      alias: 'p',
    },
    'clear-cache': {
      type: 'boolean',
      description: 'Clear the LLM registry cache',
    },
  },
  async run({ args }) {
    const { config } = await resolveConfig(args)
    const registry = getRegistry(config)

    if (args['clear-cache']) {
      registry.clearCache()
      console.logL(ICONS.result, 'LLM registry cache cleared.')
      return
    }

    const providersFromArgs = new Set<string>()

    if (args.provider) {
      const p = Array.isArray(args.provider) ? args.provider : [args.provider]
      p.forEach((val: string) => providersFromArgs.add(val))
    }

    if (args._ && Array.isArray(args._))
      args._.forEach((val: string) => providersFromArgs.add(val))

    const { data: models } = await registry.searchModels({
      provider: providersFromArgs.size > 0 ? Array.from(providersFromArgs) : undefined,
      status: config.registry.status,
    })

    if (!models || models.length === 0) {
      console.logL(ICONS.warning, 'No models found.')
      return
    }

    // Group by provider
    const modelsByProvider = models.reduce((acc, model) => {
      if (!acc[model.provider])
        acc[model.provider] = []

      acc[model.provider].push(model)
      return acc
    }, {} as Record<string, NonNullable<typeof models>>)

    console.log('`Available Models:`')

    let maxLength = 0
    for (const provider in modelsByProvider) {
      modelsByProvider[provider].forEach((model) => {
        const modelInfoLength = `    - ${model.alias}: ${model.value}`.length
        if (modelInfoLength > maxLength)
          maxLength = modelInfoLength
      })
    }

    for (const [provider, providerModels] of Object.entries(modelsByProvider)) {
      console.log(`  \`${provider}\``)
      providerModels.forEach((model) => {
        const iqDots = generateScoreDots(model.iq, c.magenta)
        const speedDots = generateScoreDots(model.speed, c.cyan)

        const attributesString = [iqDots, speedDots].filter(Boolean).join('  ')
        const modelInfo = `    - **${model.alias}**: ${model.value}`
        const modelInfoLength = `    - ${model.alias}: ${model.value}`.length
        const padding = ' '.repeat(maxLength - modelInfoLength)

        console.log(`${modelInfo}${padding}  ${attributesString}`)
      })
    }
  },
})
