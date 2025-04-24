/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065',
        },
        gray: {
          750: '#374151',
          850: '#1e2533',
        },
        dark: {
          bg: '#111827',
          card: '#1f2937',
          border: '#374151',
          text: '#f9fafb',
          text2: '#d1d5db',
        },
      },
      typography: {
        DEFAULT: {
          css: {
            color: '#f9fafb',
            a: {
              color: '#8b5cf6',
              '&:hover': {
                color: '#a78bfa',
              },
            },
            h1: {
              color: '#f9fafb',
            },
            h2: {
              color: '#f9fafb',
            },
            h3: {
              color: '#f9fafb',
            },
            h4: {
              color: '#f9fafb',
            },
            h5: {
              color: '#f9fafb',
            },
            h6: {
              color: '#f9fafb',
            },
            strong: {
              color: '#c4b5fd',
            },
            code: {
              color: '#f9fafb',
              backgroundColor: '#1f2937',
              padding: '0.2em 0.4em',
              borderRadius: '0.25rem',
            },
            pre: {
              backgroundColor: '#1f2937',
              color: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
            },
            blockquote: {
              color: '#d1d5db',
              borderLeftColor: '#4c1d95',
            },
            ul: {
              li: {
                '&::marker': {
                  color: '#8b5cf6',
                },
              },
            },
            ol: {
              li: {
                '&::marker': {
                  color: '#8b5cf6',
                },
              },
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}; 