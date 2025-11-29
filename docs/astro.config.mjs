// @ts-check
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import Icons from 'starlight-plugin-icons'
import UnoCSS from 'unocss/astro'

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
    UnoCSS(),
    Icons({
      sidebar: true,
      codeblock: true,
      extractSafelist: true,
      starlight: {
        title: 'lin',
        social: [
          { icon: 'github', label: 'GitHub', href: 'https://github.com/Rettend/lin' },
          { icon: 'discord', label: 'Discord', href: 'https://discord.gg/FvVaUPhj3t' },
        ],
        customCss: ['@fontsource/inter/400.css', '@fontsource/inter/600.css', './src/styles/custom.css'],
        components: {
          Header: './src/components/Header.astro',
        },
        sidebar: [
          {
            label: 'Guides',
            items: [
              { icon: 'i-ph:rocket-launch-duotone', label: 'Getting Started', link: '/guides/getting-started/' },
              { icon: 'i-ph:translate-duotone', label: 'Your First Translation', link: '/guides/first-translation/' },
              { icon: 'i-ph:git-branch-duotone', label: 'CI/CD Automation', link: '/guides/ci-cd/' },
              { icon: 'i-ph:code-duotone', label: 'Programmatic Usage', link: '/guides/programmatic-usage/' },
            ],
          },
          {
            label: 'Reference',
            items: [
              { icon: 'i-ph:terminal-window-duotone', label: 'Commands', link: '/reference/commands/' },
              { icon: 'i-ph:gear-duotone', label: 'Configuration', link: '/reference/configuration/' },
            ],
          },
          {
            label: 'Frameworks',
            items: [
              { icon: 'i-ph:puzzle-piece-duotone', label: 'Integrations', link: '/frameworks/' },
              { icon: 'i-material-icon-theme:svelte', label: 'Svelte', link: '/frameworks/svelte/' },
            ],
          },
        ],
      },
    }),
  ],
})
