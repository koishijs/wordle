import { defineConfig } from '@koishijs/vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'Wordle Bot',
  description: '在 Koishi 里游玩 Wordle',

  head: [
    ['link', { rel: 'icon', href: 'https://koishi.chat/logo.png' }],
    ['link', { rel: 'manifest', href: 'https://koishi.chat/manifest.json' }],
    ['meta', { name: 'theme-color', content: '#5546a3' }],
  ],

  themeConfig: {
    nav: [
      {
        text: '更多',
        items: [
          {
            text: '关于我们',
            items: [{ text: 'Koishi 官网', link: 'https://koishi.chat' }],
          },
        ],
      },
    ],

    sidebar: [
      {
        text: '指南',
        items: [{ text: '介绍', link: '/' }],
      },
      {
        text: '插件',
        items: [
          { text: 'Wordle', link: '/plugins/wordle' },
          { text: 'Reactle', link: '/plugins/reactle' },
        ],
      },
      {
        text: '更多',
        items: [{ text: 'Koishi 官网', link: 'https://koishi.chat' }],
      },
    ],

    socialLinks: {
      discord: 'https://discord.com/invite/xfxYwmd284',
      github: 'https://github.com/koishijs/wordle',
    },

    footer: {
      message: `Released under the AGPL 3.0 License.`,
      copyright: 'Copyright © 2023-present Seidko & Maiko Tan',
    },

    editLink: {
      pattern: 'https://github.com/koishijs/wordle/edit/master/docs/:path',
    },
  },
})
