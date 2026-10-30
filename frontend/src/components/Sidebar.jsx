import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ChevronsLeft } from 'lucide-react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SECTIONS, visibleItems } from './navConfig';

// Black icon rail: one tile per section that has at least one item the user may see.
export function IconRail({ activeKey }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Section" className="w-16 shrink-0 flex flex-col items-center gap-0.5 pt-1.5 pb-3 overflow-y-auto">
      {SECTIONS.map(section => {
        const items = visibleItems(section, can);
        if (!items.length) return null;
        const on = section.key === activeKey;
        const Icon = section.icon;
        return (
          <Link key={section.key} to={items[0].to} aria-current={on ? 'page' : undefined}
            className={`group w-14 flex flex-col items-center gap-[3px] pt-1.5 pb-1 text-[10.5px] font-medium
              ${on ? 'text-[#fff]' : 'text-frame-ink-2 hover:text-[#fff]'}`}>
            <span className={`w-[38px] h-8 rounded-[9px] grid place-items-center transition-colors
              ${on ? 'bg-indigo-600' : 'group-hover:bg-frame-2'}`}>
              <Icon className="w-[19px] h-[19px]" />
            </span>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

// Grey secondary sidebar listing the active section's pages.
export default function Sidebar({ section, onCollapse }) {
  const { can } = useAuth();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const isPlan = section.key === 'plan';
  // Products shortcut list (Planning only): each opens the Backlog filtered to that product
  const activeProduct = location.pathname === '/backlog' ? new URLSearchParams(location.search).get('product') : null;

  useEffect(() => {
    if (!isPlan || products.length) return;
    client.get('/products').then(r => setProducts(r.data || [])).catch(() => {});
  }, [isPlan, products.length]);

  const navCls = (on) => `flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13.5px] whitespace-nowrap transition-colors
    ${on ? 'bg-slate-200/70 text-slate-800 font-medium' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'}`;

  return (
    <aside className="h-full w-full bg-app flex flex-col min-w-0 overflow-hidden border-r border-slate-200">
      <div className="flex items-center gap-2 pl-[18px] pr-2.5 pt-4 pb-2">
        <span className="flex-1 text-[19px] font-semibold tracking-tight text-slate-800 truncate">{section.label}</span>
        <button onClick={onCollapse} title="Sembunyikan sidebar" aria-label="Sembunyikan sidebar"
          className="hidden md:grid w-7 h-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          <ChevronsLeft className="w-4 h-4" />
        </button>
      </div>
      <nav className="flex flex-col gap-px px-2 pt-1 pb-4 overflow-y-auto">
        {visibleItems(section, can).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => navCls(isActive && !(to === '/backlog' && activeProduct))}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
        {isPlan && products.length > 0 && (
          <>
            <p className="pt-[18px] pb-1.5 pl-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-slate-400">Products</p>
            {products.map(p => (
              <Link key={p.id} to={`/backlog?product=${p.id}`} className={navCls(activeProduct === String(p.id))}>
                <span className="w-5 h-5 rounded-[5px] grid place-items-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: p.color || '#9A9CA4' }}>
                  {(p.code || p.name || '?').charAt(0)}
                </span>
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
