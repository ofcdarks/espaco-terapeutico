import type { Config } from "tailwindcss";
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f2ee", 100: "#ede6dc", 200: "#e8d8c3", 300: "#d4c0a4",
          400: "#c4a882", 500: "#8b6f5e", 600: "#54423b", 700: "#3d302a",
          800: "#2a2523", 900: "#1a1412", 950: "#0f0a08",
        },
        surface: {
          0: "#ffffff", 50: "#f5f2ee", 100: "#ede6dc", 200: "#e8d8c3",
          300: "#d4c0a4", 400: "#b8b0aa", 500: "#8b7f77", 600: "#6b5f57",
          700: "#54423b", 800: "#3d302a", 850: "#2a2523", 900: "#1a1412", 950: "#0f0a08",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: { xl: "12px", "2xl": "16px", "3xl": "20px" },
      boxShadow: {
        soft: "0 1px 3px rgba(84,66,59,0.04), 0 1px 2px rgba(84,66,59,0.06)",
        card: "0 2px 8px rgba(84,66,59,0.06), 0 1px 2px rgba(84,66,59,0.04)",
        elevated: "0 4px 16px rgba(84,66,59,0.1), 0 2px 4px rgba(84,66,59,0.06)",
      },
      animation: { "fade-in": "fadeIn 0.4s ease-out", "slide-up": "slideUp 0.4s ease-out" },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
