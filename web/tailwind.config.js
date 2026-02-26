/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:    '#F6F3EE',
        espresso: '#3B2F2A',
        taupe:    '#C8BFB6',
        gold:     '#C9A24D',
        blue:     '#6492D8',
        // Semantic aliases
        primary:    '#3B2F2A',
        accent:     '#C9A24D',
        muted:      '#C8BFB6',
        background: '#F6F3EE',
      },
      fontFamily: {
        display: ['"Playfair Display SC"', 'Georgia', 'serif'],
        sans:    ['Lato', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 2px 8px rgba(59, 47, 42, 0.08)',
        lg:   '0 4px 24px rgba(59, 47, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
