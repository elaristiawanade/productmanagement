// Unread-notification badge on the browser tab, so people who keep PO Tracker in a background tab still
// notice new notifications: the title becomes "(3) Product Tracker — Internal Dev" (count first, because a
// narrow tab cuts off the end of its title) and the favicon gets a red dot with the count (still visible when
// the tab is too narrow to show any title). Browsers give pages only these two spots on a tab.
// Driven by NotificationBell's unread poll; setTabBadge(0) restores the original title and favicon.

const COUNT_PREFIX = /^\(\d+\+?\)\s+/;
const BADGE_RED = '#D71F2B';   // brand red 600 (RED_BRAND in tailwind.config.js)
const SIZE = 64;               // drawn at 64 px, the browser scales it down to 16/32 px

let wanted = null;             // favicon label requested last; an older image load must not overwrite it
let baseImage = null;          // Promise<HTMLImageElement | null>, loaded once
const drawn = {};              // label -> data URL

const iconLink = () => document.querySelector('link[rel~="icon"]');

// The original href lives on the <link> itself, so it survives a module reload (Vite HMR) while a badge is shown.
function baseHref(link) {
  if (link.dataset.baseHref === undefined) link.dataset.baseHref = link.getAttribute('href') || '';
  return link.dataset.baseHref;
}

function loadBase(href) {
  if (!baseImage) {
    baseImage = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = href;
    });
  }
  return baseImage;
}

function draw(img, label) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const r = 22, cx = SIZE - r, cy = r;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = BADGE_RED;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${label.length > 1 ? 24 : 30}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 2);
  try { return canvas.toDataURL('image/png'); } catch { return null; }
}

function setFavicon(label) {
  const link = iconLink();
  if (!link) return;
  const original = baseHref(link);
  wanted = label;
  if (!label) { link.setAttribute('href', original); return; }
  if (drawn[label]) { link.setAttribute('href', drawn[label]); return; }
  loadBase(original).then((img) => {
    if (!img) return;                          // logo failed to load: the title still carries the count
    if (!drawn[label]) {
      const url = draw(img, label);
      if (!url) return;
      drawn[label] = url;
    }
    if (wanted === label) link.setAttribute('href', drawn[label]);
  });
}

export function setTabBadge(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  const base = document.title.replace(COUNT_PREFIX, '');
  document.title = n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base;
  // The favicon is tiny: one digit, then "9+" (the exact count is in the title)
  setFavicon(n > 0 ? (n > 9 ? '9+' : String(n)) : null);
}
