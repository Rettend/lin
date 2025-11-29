/* eslint-disable no-console */
import process from 'node:process'
import { createRegistry } from '@rttnd/llm'

async function main() {
  const client = createRegistry({
    baseUrl: 'https://llm.rettend.me',
    cache: 'fs',
  })

  try {
    const { data, error } = await client.searchModels({
      provider: ['anthropic', 'google'],
      status: ['latest', 'preview'],
    })

    if (error) {
      console.error('Error:', error.message)
      process.exit(1)
    }

    console.log('Found models:')
    console.log(data?.map(model => `${model.name}, ${model.provider}, ${model.status}`).join('\n'))
  }
  catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
  finally {
    client.destroy()
  }
}

main()
