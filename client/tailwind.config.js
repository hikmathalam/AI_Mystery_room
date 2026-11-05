/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: { colors: { ink: "#0b0f19", panel: "#111827", card: "#182230", elevated: "#202d3d", gold: "#d6a84f", mist: "#9ca3af" }, fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui"], display: ["Georgia", "serif"] } } },
  plugins: []
};
