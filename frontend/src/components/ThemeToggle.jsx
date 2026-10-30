import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Saved per browser (pt_theme), like the sidebar state: users have no theme column and the backend stays as is.
// index.html applies the saved value before first paint; this keeps <html data-theme> in sync afterwards.
const readTheme = () => {
  try { return localStorage.getItem('pt_theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
};

export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  const dark = theme === 'dark';

  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('pt_theme', next); } catch { /* storage blocked: theme just won't persist */ }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Mode gelap"
      title={dark ? 'Mode gelap' : 'Mode terang'}
      onClick={toggle}
      className="relative w-[46px] h-6 rounded-full bg-frame-2 border border-frame-3 hover:border-[#3d3d44] shrink-0 mr-1.5 transition-colors">
      <span className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full grid place-items-center transition-all duration-200
        ${dark ? 'translate-x-[22px] bg-frame-ink text-[#18181B]' : 'bg-[#fff] text-[#D9891A]'}`}>
        {dark ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      </span>
    </button>
  );
}
