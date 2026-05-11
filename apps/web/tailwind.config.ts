import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        syne:  ["Syne", "sans-serif"],
        dm:    ["DM Sans", "sans-serif"],
        mono:  ["IBM Plex Mono", "monospace"],
      },
      colors: {
        base:    "#0C0E14",
        panel:   "#11141C",
        card:    "#161B26",
        hover:   "#1C2230",
        active:  "#1E2840",
        gold:    "#D4A843",
        "gold-bright": "#F0C755",
        up:      "#0ECB81",
        down:    "#F6465D",
        t1:      "#E8EDF5",
        t2:      "#8896A5",
        t3:      "#3A4555",
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.07)",
      },
    },
  },
  plugins: [],
};

export default config;