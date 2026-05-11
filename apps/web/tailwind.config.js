/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // AYC Global Market Color Palette
        void: "#030c22",       // AYC dark navy
        deep: "#07163a",       // AYC navy bg
        surface: "#0e2252",    // AYC panel
        border: "#1a3066",     // AYC border
        primary: "#c9a040",    // AYC gold
        secondary: "#1b3060",  // AYC navy accent
        accent: "#e8bc52",     // AYC gold strong
        neon: "#f0cc6a",       // AYC bright gold
        bull: "#10b981",       // green — long
        bear: "#ef4444",       // red — short
        neutral: "#c9a040",    // gold neutral
        kalkan: "#ef4444",     // kalkan red
        gold: "#c9a040",       // AYC gold
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "neural-gradient": "radial-gradient(ellipse at 50% 0%, rgba(201,160,64,0.15) 0%, transparent 70%)",
        "card-gradient": "linear-gradient(135deg, rgba(17,17,31,0.9) 0%, rgba(10,10,18,0.95) 100%)",
        "bull-gradient": "linear-gradient(135deg, rgba(16,185,129,0.1) 0%, transparent 100%)",
        "bear-gradient": "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, transparent 100%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "neural-glow": "neural-glow 2s ease-in-out infinite alternate",
        "ticker": "ticker 40s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "neural-glow": {
          "0%": { boxShadow: "0 0 5px rgba(124,58,237,0.3), 0 0 10px rgba(124,58,237,0.1)" },
          "100%": { boxShadow: "0 0 20px rgba(124,58,237,0.6), 0 0 40px rgba(124,58,237,0.2)" },
        },
        ticker: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(-100%)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
