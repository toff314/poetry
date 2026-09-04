/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0a0b',
          light: '#141516',
        },
        paper: '#f4f1ea',
        gold: '#c9a227',
        cinnabar: '#c45c3e',
        indigo: '#2a5a6b',
        charcoal: '#1a1a1a',
        slate: '#6b6b6b',
        silver: '#9a9a9a',
        darkline: '#27272a',
      },
      fontFamily: {
        serif: ['var(--font-poem)'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'slide-up': 'slideUp 0.7s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
