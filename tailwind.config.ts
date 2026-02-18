import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        sidebar: "var(--sidebar)",
        surface: "var(--surface)",
        border: "var(--border)",
        primary: {
          DEFAULT: "#0A84FF",
          hover: "#007AFF",
          glow: "rgba(10, 132, 255, 0.5)",
        },
        secondary: {
          DEFAULT: "#2C2C2E",
          hover: "#3A3A3C",
        },
        "text-secondary": "var(--text-secondary)",
        glass: {
          100: "rgba(255, 255, 255, 0.05)",
          200: "rgba(255, 255, 255, 0.1)",
          300: "rgba(255, 255, 255, 0.15)",
          border: "rgba(255, 255, 255, 0.1)",
          surface: "rgba(20, 20, 25, 0.6)",
        },
        gray: {
          400: "#8E8E93",
          500: "#636366",
        },
      },
      backgroundImage: {
        'liquid-grade': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)',
        'glass-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.0) 100%)',
      },
      boxShadow: {
        'glass-inset': 'inset 0 0 0 1px rgba(255, 255, 255, 0.1)',
        'glass-hover': 'inset 0 0 0 1px rgba(255, 255, 255, 0.2), 0 8px 20px -6px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 20px rgba(10, 132, 255, 0.3)',
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
};
export default config;



