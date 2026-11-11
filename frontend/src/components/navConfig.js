import {
  LayoutDashboard, ListTodo, Zap, Package, Users, TestTube2, FileDown, ClipboardList, Layers, CheckSquare,
  Settings, Crown, Bug, Home, CalendarRange, User, Landmark, Building2, Tags,
} from 'lucide-react';

// Navigation grouped into icon-rail sections. `title` (when set) is the page title from the old header,
// shown in the breadcrumb; menus use the shorter `label`. Gates are the same permissions the old Sidebar used:
// an item with `gate: [module, action]` only shows when can(module, action) passes
// (super_admin always passes via can()'s bypass). Route-level gates stay in App.jsx.
export const SECTIONS = [
  { key: 'home', label: 'Home', icon: Home, items: [
    { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
    { to: '/my-tasks', label: 'My Tasks',  icon: CheckSquare },
  ] },
  { key: 'plan', label: 'Planning', icon: CalendarRange, items: [
    { to: '/backlog',    label: 'Backlog',    icon: ListTodo,      title: 'Backlog Management' },
    { to: '/epic-board', label: 'Epic Board', icon: Layers },
    { to: '/sprints',    label: 'Sprints',    icon: Zap,           title: 'Sprint Management' },
    { to: '/standup',    label: 'Standup',    icon: ClipboardList, title: 'Daily Standup' },
    { to: '/products',   label: 'Products',   icon: Package,       title: 'Product Management' },
  ] },
  { key: 'quality', label: 'Quality', icon: TestTube2, items: [
    { to: '/qa',   label: 'QA Module',     icon: TestTube2 },
    { to: '/bugs', label: 'Bugs Incident', icon: Bug, gate: ['bugs', 'access'] },
  ] },
  { key: 'clients', label: 'Clients', icon: Landmark, items: [
    { to: '/clients', label: 'Client List', icon: Building2, title: 'Client Management', gate: ['clients', 'access'] },
  ] },
  { key: 'leaders', label: 'Leaders', icon: Crown, items: [
    { to: '/c-level', label: 'C-Level Dashboard', icon: Crown, gate: ['c_level', 'access'] },
  ] },
  { key: 'admin', label: 'Admin', icon: Settings, items: [
    { to: '/users',                  label: 'Users & Roles',         icon: Users,    gate: ['users', 'update'] },
    { to: '/import/jira',            label: 'Import Jira',           icon: FileDown, gate: ['import', 'run'], title: 'Import dari Jira' },
    { to: '/settings/notifications', label: 'Notification Settings', icon: Settings, gate: ['settings', 'update'] },
    { to: '/settings/clients',       label: 'Client Statuses',       icon: Tags,     gate: ['settings', 'update'], title: 'Pengaturan Status Client' },
  ] },
];

// Pages reachable outside the menus still need a breadcrumb.
export const EXTRA_PAGES ={ '/profile': { section: 'home', label: 'Profile Saya', icon: User } };

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
