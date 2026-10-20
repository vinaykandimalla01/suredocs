/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'suredocs-blue': '#2563EB',
        'suredocs-dark': '#111827',
      }
    },
  },
  plugins: [],
}
