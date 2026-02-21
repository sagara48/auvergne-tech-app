/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0F0D14',
          800: '#161420',
          700: '#1E1B2A',
          600: '#2A2640',
          500: '#3E3858',
          400: '#5A5270',
          300: '#A49BB5',
        },
        accent: {
          DEFAULT: '#B91C1C',
          light: '#DC4444',
          dark: '#991B1B',
          bg: 'var(--accent-bg)',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
