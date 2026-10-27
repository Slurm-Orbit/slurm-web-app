// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss'],
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  tailwindcss: {
    configPath: './tailwind.config.js',
    cssPath: '~/assets/css/main.css'
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
