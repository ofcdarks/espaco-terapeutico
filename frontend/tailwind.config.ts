import type { Config } from "tailwindcss";
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        brand: {
          50: "#f5f2ee", 100: "#ede6dc", 200: "#e8d8c3", 300: "#d4c0a4",
          400: "#c4a882", 500: "#8b6f5e", 600: "#54423b", 700: "#3d302a",
          800: "#2a2523", 900: "#1a1412", 950: "#0f0a08",
        },
        surface: {
          50: "#f5f2ee", 100: "#ede6dc", 200: "#e8d8c3", 300: "#d4c0a4",
          400: "#b8b0aa", 500: "#8b7f77", 600: "#6b5f57", 700: "#54423b",
          800: "#3d302a", 850: "#2a2523", 900: "#1a1412", 950: "#0f0a08",
        },
      },
      borderColor: { DEFAULT: "hsl(var(--border))" },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "12px", "2xl": "16px", "3xl": "20px",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(84,66,59,0.04), 0 1px 2px rgba(84,66,59,0.06)",
        card: "0 2px 8px rgba(84,66,59,0.06), 0 1px 2px rgba(84,66,59,0.04)",
        elevated: "0 4px 16px rgba(84,66,59,0.1), 0 2px 4px rgba(84,66,59,0.06)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
