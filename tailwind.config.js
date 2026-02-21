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
        // Couleurs sombres (mode dark - lavender undertones)
        dark: {
          900: '#0F0D14',
          800: '#161420',
          700: '#1E1B2A',
          600: '#2A2640',
          500: '#3E3858',
          400: '#5A5270',
          300: '#A49BB5',
        },
        // Couleurs claires (mode light - lavender)
        light: {
          50: '#FAFAFC',
          100: '#F3F1F6',
          200: '#EDE9F5',
          300: '#E4DFF0',
          400: '#B0ABBD',
          500: '#9490A8',
          600: '#7A7190',
          700: '#585270',
          800: '#1E1B2E',
          900: '#0F0D14',
        },
        // Couleurs thématiques
        surface: {
          DEFAULT: 'var(--bg-secondary)',
          elevated: 'var(--bg-tertiary)',
        },
        // Accent rouge bordeaux
        accent: {
          DEFAULT: '#B91C1C',
          light: '#DC4444',
          dark: '#991B1B',
          bg: 'var(--accent-bg)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundColor: {
        theme: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
          elevated: 'var(--bg-elevated)',
        },
      },
      textColor: {
        theme: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
        },
      },
      borderColor: {
        theme: {
          DEFAULT: 'var(--border-primary)',
          secondary: 'var(--border-secondary)',
        },
      },
    },
  },
  plugins: [],
}
