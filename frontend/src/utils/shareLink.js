// Share links: an absolute URL to a record's one-shot deep link (see deepLink.js), e.g. /backlog?item=12.
// The address bar can't be copied instead — the page strips ?item= once the modal is open — so the link
// is always built from the record id.

export const shareUrl = (path) => `${window.location.origin}${path}`;

// navigator.clipboard only exists in a secure context (HTTPS or localhost), but the app is often served over
// plain http://<server-ip> — so fall back to a hidden textarea + execCommand('copy') there.
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  const prevFocus = document.activeElement;
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  document.body.removeChild(ta);
  prevFocus?.focus?.();
  return ok;
}
