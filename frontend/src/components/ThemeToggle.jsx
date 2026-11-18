import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

// Saved per browser (pt_theme), like the sidebar state: users have no theme column and the backend stays as is.
// index.html applies the saved value before first paint; this keeps <html data-theme> in sync afterwards.
const readTheme = () => {
  try { return localStorage.getItem('pt_theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
};

// The top bar is black in both themes, so a dark track disappeared into it. The track is a bright
// colour instead (amber in light mode, blue in dark mode) and both icons stay visible, so it
// reads as a two-way switch at a glance. Hard-coded hex on purpose: the bar never changes with the theme.
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
      title={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      onClick={toggle}
      className={`relative w-[60px] h-[30px] rounded-full shrink-0 mr-1.5 transition-colors duration-200
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fff]
        ${dark ? 'bg-[#3B82F6] hover:bg-[#60A5FA]' : 'bg-[#F5B83D] hover:bg-[#F8C85F]'}`}>
      <span className={`absolute left-0 inset-y-0 w-7 grid place-items-center z-10 transition-colors duration-200
        ${dark ? 'text-[#0A2247]' : 'text-[#FBBF24]'}`}>
        <Sun className="w-3.5 h-3.5" />
      </span>
      <span className={`absolute right-0 inset-y-0 w-7 grid place-items-center z-10 transition-colors duration-200
        ${dark ? 'text-[#fff]' : 'text-[#5B3E08]'}`}>
        <Moon className="w-3.5 h-3.5" />
      </span>
      <span className={`absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-[#18181B] transition-transform duration-200
        ${dark ? 'translate-x-[30px]' : ''}`} />
    </button>
  );
}
