/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Palette Ventoux — inspirée du granit, du bitume et du coucher de soleil sur le sommet
        ventoux: {
          50:  '#FFF8F0',
          100: '#FFECD8',
          200: '#FFD4A8',
          300: '#FFB870',
          400: '#FF9440',
          500: '#FF6B35', // Orange Ventoux principal
          600: '#E8521A',
          700: '#C43D10',
          800: '#9D2F0B',
          900: '#7A2509',
        },
        stone: {
          50:  '#F8F8F7',
          100: '#EFEFED',
          200: '#DCDBD8',
          300: '#BFBDBA',
          400: '#979592',
          500: '#6E6C69',
          600: '#514F4C',
          700: '#3C3A38',
          800: '#242220',
          900: '#141312',
          950: '#0A0908',
        },
        summit: {
          // Blanc sommet / neige
          light: '#F5F4F0',
          DEFAULT: '#EAE8E2',
          dark: '#D0CEC8',
        },
        zone: {
          // Zones de puissance
          1: '#6B9EFF', // Récupération active
          2: '#4ECCA3', // Endurance
          3: '#F7C948', // Tempo
          4: '#FF9F45', // Seuil
          5: '#FF5252', // VO2Max
          6: '#C45EFF', // Anaérobique
          7: '#FF2D9A', // Neuromusculaire
        },
      },
      fontFamily: {
        display: ['var(--font-barlow-condensed)', 'sans-serif'],
        body:    ['var(--font-dm-sans)', 'sans-serif'],
        mono:    ['var(--font-jetbrains-mono)', 'monospace'],
      },
      backgroundImage: {
        'ventoux-gradient': 'linear-gradient(135deg, #FF6B35 0%, #FFB347 50%, #FF6B35 100%)',
        'dark-gradient':    'linear-gradient(180deg, #0A0908 0%, #141312 100%)',
        'card-gradient':    'linear-gradient(135deg, rgba(255,107,53,0.08) 0%, transparent 60%)',
        'summit-glow':      'radial-gradient(ellipse at top, rgba(255,107,53,0.15) 0%, transparent 60%)',
      },
      boxShadow: {
        'ventoux':     '0 0 40px rgba(255,107,53,0.15)',
        'ventoux-sm':  '0 0 20px rgba(255,107,53,0.10)',
        'card':        '0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        'card-hover':  '0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,107,53,0.2)',
      },
      animation: {
        'fade-in':      'fadeIn 0.4s ease-out',
        'slide-up':     'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer':      'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
