/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        shell: {
          bg: "#050509",
          panel: "#05050a",
          border: "rgba(255,255,255,0.08)",
        },
        brand: {
          pink: "#ff2a8b",
          pinkSoft: "#ff4aa0",
          amber: "#ffb347",
        },
        trend: {
          emerging: "#ffdd80",
          peaking: "#4df3a3",
          stable: "#7dd3fc",
          declining: "#ff7878",
        },
      },
      borderRadius: {
        pill: "999px",
        xl2: "1.25rem",
      },
      boxShadow: {
        "ring-soft": "0 0 0 1px rgba(255,255,255,0.04)",
        "brand-glow": "0 0 30px rgba(255,42,139,0.55)",
      },
    },
  },
  plugins: [],
};
