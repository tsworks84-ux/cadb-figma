import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#17232b", soft: "#3b4a54", muted: "#64737d" },
        line: "#dbe3e7",
        canvas: "#f4f7f8",
        brand: { DEFAULT: "#0b6e79", dark: "#08555d", soft: "#e2f1f2" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
