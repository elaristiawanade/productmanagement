import { useEffect, useRef } from 'react';

// Ctrl+V attachments. One hook shared by every form that has a "Lampiran" block (AttachmentSection for
// Backlog / Bugs / QA, and the public bug report page) so they all behave the same.
//
// A paste is only taken over when the clipboard carries file(s) and NO text. Copying cells from Excel/Word,
// or any plain text, puts text next to an image preview in the clipboard — those must keep pasting as text
// into the focused input. Pasting text never reaches `onFiles` and is never preventDefault()ed.

const IMAGE_EXT = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };

const pad = (n) => String(n).padStart(2, '0');

// Screenshots / "copy image" arrive as a generic `image.png`. Give them a recognisable, sortable name
// (screenshot-20261111-103245.png, -2 for several files in the same paste); real file names are kept.
function nameClipboardFile(file, index) {
  const generic = !file.name || /^image\.(png|jpe?g|gif|webp)$/i.test(file.name);
  if (!generic) return file;
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const ext = IMAGE_EXT[file.type] || (file.name.match(/\.[A-Za-z0-9]+$/)?.[0].toLowerCase()) || '.png';
  const name = `screenshot-${stamp}${index > 0 ? `-${index + 1}` : ''}${ext}`;
  return new File([file], name, { type: file.type, lastModified: file.lastModified });
}

// Files from a paste event, or [] when the paste should be left to the browser (plain text, rich text, empty).
export function filesFromPaste(e) {
  const cd = e.clipboardData;
  if (!cd || !cd.files || cd.files.length === 0) return [];
  if ((cd.getData('text/plain') || '').trim() !== '') return [];
  return Array.from(cd.files).map(nameClipboardFile);
}

// `onFiles(files)` is called with the pasted File objects while `enabled`. Always calls the latest callback,
// so callers can pass an inline function without re-subscribing.
export function usePasteFiles(onFiles, enabled = true) {
  const cb = useRef(onFiles);
  cb.current = onFiles;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (e.defaultPrevented) return;
      const files = filesFromPaste(e);
      if (files.length === 0) return;
      e.preventDefault();
      cb.current(files);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enabled]);
}
