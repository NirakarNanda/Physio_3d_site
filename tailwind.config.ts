import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#F7F5F0", // primary background — warm off-white
          secondary: "#ECE9E2", // secondary panels / section alternation
        },
        ink: {
          DEFAULT: "#171717", // primary text
          muted: "#77736C", // secondary / caption text
        },
        accent: {
          DEFAULT: "#A8B7A1", // medical sage — primary accent, used sparingly
          warm: "#C9A68B", // optional warm clay accent, rarer still
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        editorial: ["var(--font-editorial)", "Georgia", "serif"],
      },
      letterSpacing: {
        label: "0.18em",
      },
      maxWidth: {
        content: "1440px",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
