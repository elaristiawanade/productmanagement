import colors from 'tailwindcss/colors';

// ClickUp-style revamp: red primary, white secondary, black tertiary.
// `indigo` (and the old `brand`) now resolve to the red brand scale, so every existing
// indigo-* class turns red without touching the pages.
const RED_BRAND = {
  50: '#FFF1F1', 100: '#FFE2E3', 200: '#FFC9CB', 300: '#FCA3A7', 400: '#F56D73',
  500: '#EA3F47', 600: '#D71F2B', 700: '#B4151F', 800: '#93161D', 900: '#79181D', 950: '#430A0E',
};
// Neutral greys (ClickUp-like) replace the bluish slate; text-slate-800 = main ink #18181B.
const NEUTRAL = {
  50: '#F7F7F8', 100: '#F1F1F3', 200: '#E5E5E9', 300: '#D1D1D7', 400: '#9A9CA4',
  500: '#6E7079', 600: '#52545C', 700: '#3A3B41', 800: '#18181B', 900: '#0F0F11', 950: '#09090B',
};
const NEUTRAL_DARK = {
  50: '#212126', 100: '#27272C', 200: '#313137', 300: '#3F3F46', 400: '#71727B',
  500: '#8E8F98', 600: '#A5A6AE', 700: '#C4C5CB', 800: '#ECECEE', 900: '#F4F4F5', 950: '#FAFAFA',
};

const PALETTES = {
  slate: NEUTRAL, gray: NEUTRAL, indigo: RED_BRAND, brand: RED_BRAND,
  red: colors.red, orange: colors.orange, amber: colors.amber, yellow: colors.yellow,
  green: colors.green, emerald: colors.emerald, teal: colors.teal, cyan: colors.cyan,
  sky: colors.sky, blue: colors.blue, violet: colors.violet, purple: colors.purple,
  pink: colors.pink, rose: colors.rose,
};
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const DARK_PANEL = '#1B1B1F';

const rgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => rgb(a).map((v, i) => Math.round(v * t + rgb(b)[i] * (1 - t)));
const channels = c => (Array.isArray(c) ? c : rgb(c)).join(' ');

// Dark theme for coloured palettes: light tints (50–300, used as badge/backgrounds) become dark
// tints of the hue; text shades (700–950) move up the scale so they stay readable on dark.
function darkShade(p, s) {
  const tint = { 50: 0.14, 100: 0.22, 200: 0.32, 300: 0.48 }[s];
  if (tint) return mix(p[500], DARK_PANEL, tint);
  return rgb({ 400: p[400], 500: p[500], 600: p[500], 700: p[400], 800: p[300], 900: p[200], 950: p[100] }[s]);
}

// Each palette shade is an "r g b" CSS variable so opacity modifiers (bg-red-500/10) keep working.
const varColors = Object.fromEntries(Object.keys(PALETTES).map(name => [name,
  Object.fromEntries(SHADES.map(s => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]))]));

function paletteVars({ addBase }) {
  const light = {}, dark = {};
  for (const [name, p] of Object.entries(PALETTES)) {
    for (const s of SHADES) {
      light[`--c-${name}-${s}`] = channels(p[s]);
      dark[`--c-${name}-${s}`] = channels(p === NEUTRAL ? NEUTRAL_DARK[s] : darkShade(p, s));
    }
  }
  addBase({ ':root': light, '[data-theme="dark"]': dark });
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ...varColors,
        // Shell tokens (defined in index.css, swapped for dark mode there)
        ink: { DEFAULT: 'rgb(var(--ink) / <alpha-value>)', 2: 'rgb(var(--ink-2) / <alpha-value>)', 3: 'rgb(var(--ink-3) / <alpha-value>)' },
        panel: 'rgb(var(--panel) / <alpha-value>)',
        app: 'rgb(var(--app) / <alpha-value>)',
        line: { DEFAULT: 'rgb(var(--line) / <alpha-value>)', soft: 'rgb(var(--line-soft) / <alpha-value>)' },
        hover: 'rgb(var(--hover) / <alpha-value>)',
        frame: { DEFAULT: '#0F0F11', 2: '#1D1D21', 3: '#2B2B30', ink: '#F4F4F5', 'ink-2': '#A1A1AA' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        pop: '0 8px 24px rgb(15 15 17 / .12), 0 2px 6px rgb(15 15 17 / .06)',
      },
    },
  },
  plugins: [paletteVars],
};
