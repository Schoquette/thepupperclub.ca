/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The Pupper Club brand palette. The Community uses Just Blue
        // as its single accent. Soft Gold is reserved for the paid
        // service and should not appear here.
        cream:    '#F6F3EE',
        espresso: '#3B2F2A',
        taupe:    '#C8BFB6',
        blue:     '#6492D8',
      },
      fontFamily: {
        display: ['"Playfair Display SC"', 'Georgia', 'serif'],
        serif:   ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['Alleron', 'Lato', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        wider:   '0.08em',
        widest:  '0.2em',
        'super-wide': '0.32em',
      },
    },
  },
  plugins: [],
};
