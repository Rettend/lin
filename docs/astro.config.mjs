// @ts-check
import { fileURLToPath } from 'node:url'
import starlight from '@astrojs/starlight'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://lin.rettend.me',
  base: '/',
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('../src', import.meta.url)),
      },
    },
  },
  integrations: [
    starlight({
      title: 'lin',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/Rettend/lin' }],
      customCss: ['@fontsource/inter/400.css', '@fontsource/inter/600.css', './src/styles/custom.css'],
      components: {
        Header: './src/components/Header.astro',
      },
      sidebar: [
        {
          label: 'Guides',
          items: [
            { label: 'Getting Started', link: '/guides/getting-started/' },
            { label: 'Your First Translation', link: '/guides/first-translation/' },
            { label: 'CI/CD Automation', link: '/guides/ci-cd/' },
            { label: 'Programmatic Usage', link: '/guides/programmatic-usage/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Commands', link: '/reference/commands/' },
            { label: 'Configuration', link: '/reference/configuration/' },
          ],
        },
        {
          label: 'Frameworks',
          items: [
            { label: 'Integrations', link: '/frameworks/' },
            { label: 'Svelte', link: '/frameworks/svelte/' },
          ],
        },
      ],
    }),
  ],
})
