import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
  ],
  dts: {
    tsgo: true,
  },
  minify: true,
  alias: {
    '@/*': './src/*',
  },
})
