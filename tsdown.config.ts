import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index',
    'src/cli',
    'src/vite',
  ],
  dts: {
    tsgo: true,
  },
  minify: true,
})
