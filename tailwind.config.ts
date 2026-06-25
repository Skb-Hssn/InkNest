import type { Config } from "tailwindcss";

export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8f6",
          100: "#e7ece8",
          500: "#3f6f5a",
          700: "#25483a",
          900: "#17251f"
        },
        ember: {
          400: "#d89232",
          500: "#b8731f"
        }
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
} satisfies Config;
