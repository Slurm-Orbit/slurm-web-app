// https://nuxt.com/docs/api/configuration/nuxt-config
import eslint from '@nuxt/eslint'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: [eslint],
  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  vite: {
    plugins: [tailwindcss()]
  },
  nitro: {
    experimental: {
      websocket: true
    }
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }
      ],
      title: 'Slurm Orbital'
    }
  }
})
