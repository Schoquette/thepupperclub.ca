/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:    '#F6F3EE',
        espresso: '#3B2F2A',
        taupe:    '#C8BFB6',
        gold:     '#C9A24D',
        blue:     '#6492D8',
      },
    },
  },
  plugins: [],
};
