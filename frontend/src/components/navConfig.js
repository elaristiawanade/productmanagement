import {
  LayoutDashboard, ListTodo, Zap, Package, Users, TestTube2, FileDown, ClipboardList, Layers, CheckSquare,
  Settings, Crown, Bug, Home, CalendarRange, User,
} from 'lucide-react';

// Navigation grouped into icon-rail sections. Gates are the same permissions the old Sidebar used:
// an item with `gate: [module, action]` only shows when can(module, action) passes
// (super_admin always passes via can()'s bypass). Route-level gates stay in App.jsx.
export const SECTIONS = [
  { key: 'home', label: 'Home', icon: Home, items: [
    { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-tasks', label: 'My Tasks',  icon: CheckSquare },
  ] },
  { key: 'plan', label: 'Planning', icon: CalendarRange, items: [
    { to: '/backlog',    label: 'Backlog',    icon: ListTodo },
    { to: '/epic-board', label: 'Epic Board', icon: Layers },
    { to: '/sprints',    label: 'Sprints',    icon: Zap },
    { to: '/standup',    label: 'Standup',    icon: ClipboardList },
    { to: '/products',   label: 'Products',   icon: Package },
  ] },
  { key: 'quality', label: 'Quality', icon: TestTube2, items: [
    { to: '/qa',   label: 'QA Module',     icon: TestTube2 },
    { to: '/bugs', label: 'Bugs Incident', icon: Bug, gate: ['bugs', 'access'] },
  ] },
  { key: 'leaders', label: 'Leaders', icon: Crown, items: [
    { to: '/c-level', label: 'C-Level Dashboard', icon: Crown, gate: ['c_level', 'access'] },
  ] },
  { key: 'admin', label: 'Admin', icon: Settings, items: [
    { to: '/users',                  label: 'Users & Roles',         icon: Users,    gate: ['users', 'update'] },
    { to: '/import/jira',            label: 'Import Jira',           icon: FileDown, gate: ['import', 'run'] },
    { to: '/settings/notifications', label: 'Notification Settings', icon: Settings, gate: ['settings', 'update'] },
  ] },
];

// Pages reachable outside the menus still need a breadcrumb.
const EXTRA_PAGES = { '/profile': { section: 'home', label: 'Profile Saya', icon: User } };

export const visibleItems = (section, can) => section.items.filter(it => !it.gate || can(...it.gate));

// Breadcrumb/rail lookup for the current path: { section, item }.
export function pageMeta(pathname) {
  for (const section of SECTIONS) {
    const item = section.items.find(it => it.to === pathname);
    if (item) return { section, item };
  }
  const extra = EXTRA_PAGES[pathname];
  if (extra) return { section: SECTIONS.find(s => s.key === extra.section), item: extra };
  return { section: SECTIONS[0], item: { label: 'Product Tracker', icon: LayoutDashboard } };
}
