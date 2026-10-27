export default {
  content: [
    './app/**/*.{vue,js,ts}',
    './nuxt.config.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        orbit: {
          bg: '#030610',
          elevated: '#050a14',
          card: 'rgba(6, 14, 28, 0.78)',
          line: 'rgba(255, 255, 255, 0.14)',
          text: '#e8e8ec',
          muted: '#9a9ea6',
          accent: '#f4f4f5',
          ok: '#3cbe7a',
          danger: '#ff3b5c',
          warn: '#ffb020'
        }
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(220,220,230,0.18), 0 8px 32px rgba(0,0,0,0.35)'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        spin: 'spin 0.85s linear infinite'
      }
    }
  }
}
