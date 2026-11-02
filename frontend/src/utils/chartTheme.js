import { useEffect, useState } from 'react';

// Recharts takes literal colours (SVG attributes), so charts can't use the CSS theme tokens directly.
// This hook returns the palette for the current <html data-theme> and re-renders when it changes.
const PALETTES = {
  light: { ink: '#18181B', muted: '#D1D1D7', grid: '#EFEFF2', tick: '#6E7079', panel: '#FFFFFF', line: '#E5E5E9' },
  dark:  { ink: '#ECECEE', muted: '#4A4A52', grid: '#2A2A30', tick: '#8E8F98', panel: '#1B1B1F', line: '#2E2E34' },
};

// Status hues, same as StatusBadge
export const STATUS_COLORS = {
  todo: '#7C8494', in_progress: '#3E63DD', in_review: '#D9891A', done: '#1F9D55', blocked: '#E5484D', backlog: '#8B5CF6',
};

const currentTheme = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

export function useChartTheme() {
  const [theme, setTheme] = useState(currentTheme);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(currentTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  const p = PALETTES[theme];
  return {
    ...p,
    axisTick: { fontSize: 11, fill: p.tick },
    tooltip: {
      contentStyle: { background: p.panel, border: `1px solid ${p.line}`, borderRadius: 8, fontSize: 12, color: p.ink },
      labelStyle: { color: p.ink },
      itemStyle: { color: p.ink },
      cursor: { fill: p.grid },
    },
  };
}
