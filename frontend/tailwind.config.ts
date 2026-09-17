import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#F4F7FA",
          100: "#E4EBF3",
          200: "#C5D5E5",
          300: "#9BB6CF",
          400: "#5F87AD",
          500: "#2C5A82",
          600: "#0B2545",
          700: "#091E39",
          800: "#07182D",
          900: "#050F1E",
        },
        teal: {
          50: "#EFFAFA",
          100: "#D7F2F1",
          200: "#AEE4E2",
          300: "#7ACFCB",
          400: "#45B2AC",
          500: "#0E7C7B",
          600: "#0B6362",
          700: "#0A4F4E",
          800: "#083B3A",
          900: "#062B2A",
        },
        gold: {
          100: "#F7EFD8",
          400: "#C9A227",
          500: "#B08D1E",
          600: "#8F7318",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,37,69,.05), 0 10px 28px -14px rgba(11,37,69,.14)",
        lift: "0 2px 4px rgba(11,37,69,.06), 0 16px 40px -16px rgba(11,37,69,.22)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp .6s cubic-bezier(.22,.8,.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
