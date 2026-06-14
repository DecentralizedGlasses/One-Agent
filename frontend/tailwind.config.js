/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#6366f1",
        cream: "#f0ede8",
      },
    },
  },
  plugins: [],
};
