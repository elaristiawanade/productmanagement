import {
  ListTodo, Bug, TestTube2, Zap, Package, Layers, Puzzle, Map, Crown, User, Shield, Building2, ClipboardList,
} from 'lucide-react';
import client from '../api/client';

// What the Ctrl K palette can create and find. Every entry carries `gates` — [module, action] pairs that must ALL
// pass for the signed-in role (super_admin passes via can()'s bypass) — so the palette never offers something the
// role could not do from the menus. Entries that need a page behind a route gate repeat that gate: Users & Roles
// is only reachable with users.update, Bugs with bugs.access, C-Level with c_level.access.
// Destinations are one-shot deep links consumed by the target page (see utils/deepLink.js).

export const allowed = (gates, can) => !gates || gates.every(g => can(...g));

const USERS_PAGE = ['users', 'update'];

// "New …" actions. `words` are extra search terms; the label is matched as well.
export const ACTIONS = [
  { id: 'backlog',    label: 'Backlog item baru', icon: ListTodo,      to: '/backlog?new=1',            gates: [['backlog', 'create']] },
  { id: 'bug',        label: 'Bug baru',          icon: Bug,           to: '/bugs?new=1',               gates: [['bugs', 'access']] },
  { id: 'testcase',   label: 'Test case baru',    icon: TestTube2,     to: '/qa?new=1',                 gates: [['qa', 'create']], words: 'qa' },
  { id: 'sprint',     label: 'Sprint baru',       icon: Zap,           to: '/sprints?new=1',            gates: [['sprints', 'create']] },
  { id: 'product',    label: 'Produk baru',       icon: Package,       to: '/products?new=product',     gates: [['products', 'create']], words: 'product' },
  { id: 'epic',       label: 'Epic baru',         icon: Layers,        to: '/epic-board?new=1',         gates: [['epics', 'create']], words: 'epic board' },
  { id: 'roadmap',    label: 'Item roadmap baru', icon: Map,           to: '/products?new=roadmap',     gates: [['roadmap', 'create']] },
  { id: 'leadertask', label: 'Leader task baru',  icon: Crown,         to: '/c-level?new=task',         gates: [['c_level', 'access']], words: 'c-level' },
  { id: 'standup',    label: 'Isi standup hari ini', icon: ClipboardList, to: '/standup',               words: 'daily' },
  { id: 'user',       label: 'User baru',         icon: User,          to: '/users?new=user',           gates: [USERS_PAGE, ['users', 'create']] },
  { id: 'role',       label: 'Role baru',         icon: Shield,        to: '/users?new=role',           gates: [USERS_PAGE, ['roles', 'create']] },
  { id: 'department', label: 'Departemen baru',   icon: Building2,     to: '/users?new=department',     gates: [USERS_PAGE, ['departments', 'create']] },
];

// Epic/Feature forms on the Products page are per product, so these are offered once per visible product.
export const PRODUCT_ACTIONS = [
  { id: 'feature', label: p => `Feature baru — ${p.name}`,       icon: Puzzle, to: p => `/products?new=feature&pid=${p.id}`, gates: [['features', 'create']], words: 'feature' },
  { id: 'epicp',   label: p => `Epic produk baru — ${p.name}`,  icon: Layers, to: p => `/products?new=epic&pid=${p.id}`,    gates: [['epics', 'create']],    words: 'epic' },
];

const SILENT = { silent: true };   // background lookups must not toast an error
const pick = (res) => res.data;

// Searched on the server (these lists are big): the query goes to the existing `search` parameter.
export const SERVER_SOURCES = [
  {
    key: 'backlog', label: 'Backlog item', icon: ListTodo, gates: [],
    fetch: (q) => client.get('/backlog', { params: { search: q, limit: 6 }, ...SILENT }).then(r => r.data.items || []),
    row: (it) => ({ code: it.code, title: it.title, status: it.status, to: `/backlog?item=${it.id}` }),
  },
  {
    key: 'leadertask', label: 'Leader task', icon: Crown, gates: [['c_level', 'access']],
    fetch: (q) => client.get('/leader-tasks', { params: { search: q, limit: 6 }, ...SILENT }).then(r => r.data.items || []),
    row: (t) => ({ code: t.code, title: t.title, status: t.status, to: `/c-level?task=${t.id}` }),
  },
];

// Small lists with no `search` parameter: fetched once per palette session and filtered here, the same way the
// pages themselves filter them. `ctx.productName(id)` resolves a product id to its name.
export const LIST_SOURCES = [
  {
    key: 'bugs', label: 'Bug', icon: Bug, url: '/bugs', gates: [['bugs', 'access']],
    text: (b) => [b.code, b.title],
    row: (b) => ({ code: b.code, title: b.title, status: b.stage, to: `/bugs?bug=${b.id}` }),
  },
  {
    key: 'testcases', label: 'Test case', icon: TestTube2, url: '/qa/test-cases', gates: [],
    text: (t) => [t.code, t.title],
    row: (t) => ({ code: t.code, title: t.title, status: t.status, to: `/qa?case=${t.id}` }),
  },
  {
    key: 'sprints', label: 'Sprint', icon: Zap, url: '/sprints', gates: [],
    text: (s) => [s.name, s.goal],
    row: (s, ctx) => ({ title: s.name, sub: ctx.productName(s.product_id), status: s.status, to: `/sprints?sprint=${s.id}&product=${s.product_id}` }),
  },
  {
    key: 'products', label: 'Produk', icon: Package, url: '/products', gates: [],
    text: (p) => [p.code, p.name, p.description],
    row: (p) => ({ code: p.code, title: p.name, status: p.status, to: `/products?product=${p.id}` }),
  },
  {
    key: 'epics', label: 'Epic produk', icon: Layers, url: '/epics', gates: [],
    text: (e) => [e.code, e.name],
    row: (e, ctx) => ({ code: e.code, title: e.name, sub: ctx.productName(e.product_id), status: e.status, to: `/products?epic=${e.id}` }),
  },
  {
    key: 'features', label: 'Feature', icon: Puzzle, url: '/features', gates: [],
    text: (f) => [f.code, f.name],
    row: (f, ctx) => ({ code: f.code, title: f.name, sub: ctx.productName(f.product_id), status: f.status, to: `/products?feature=${f.id}` }),
  },
  {
    key: 'roadmap', label: 'Roadmap', icon: Map, url: '/roadmap', gates: [],
    text: (r) => [r.feature_name, r.product_version, r.description],
    row: (r) => ({ title: r.feature_name, sub: r.product_name, status: r.status, to: `/products?roadmap=${r.id}` }),
  },
  {
    key: 'users', label: 'User', icon: User, url: '/users', gates: [USERS_PAGE],
    text: (u) => [u.name, u.email],
    row: (u) => ({ title: u.name, sub: u.email, to: `/users?user=${u.id}` }),
  },
  {
    key: 'roles', label: 'Role', icon: Shield, url: '/users/roles', gates: [USERS_PAGE],
    text: (r) => [r.display_name, r.name],
    row: (r) => ({ title: r.display_name || r.name, sub: r.name, to: `/users?role=${r.id}` }),
  },
  {
    key: 'departments', label: 'Departemen', icon: Building2, url: '/departments', gates: [USERS_PAGE],
    text: (d) => [d.code, d.name],
    row: (d) => ({ code: d.code, title: d.name, to: `/users?department=${d.id}` }),
  },
];

export const fetchList = (url) => client.get(url, SILENT).then(pick);

// Every word of the query must appear in one of the fields (case-insensitive), so "login bug" finds "Bug login error".
export const matches = (query, fields) => {
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return query.split(/\s+/).filter(Boolean).every(w => hay.includes(w));
};
