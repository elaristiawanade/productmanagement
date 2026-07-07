// Lightweight link detection/rendering shared by comment and notes displays.
// Supports bare URLs (https://..., www...) and markdown-style [label](url) links,
// so the "insert link" popover can attach a custom display label to a URL.

const LINK_TOKEN_RE = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<]+|www\.[^\s<]+)/g;
const MD_LINK_RE = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/;

// Sentence punctuation (commas, periods, trailing parens/brackets, ...) commonly
// follows a pasted URL and shouldn't become part of the link. Peels it off the
// end, keeping a closing paren/bracket if the URL has an unmatched opening one.
function splitTrailingPunctuation(url) {
  let core = url;
  let trail = '';
  while (core.length > 0) {
    const ch = core[core.length - 1];
    if (ch === ')') {
      const opens  = (core.match(/\(/g) || []).length;
      const closes = (core.match(/\)/g) || []).length;
      if (opens >= closes) break;
    } else if (ch === ']') {
      const opens  = (core.match(/\[/g) || []).length;
      const closes = (core.match(/\]/g) || []).length;
      if (opens >= closes) break;
    } else if (!'.,;:!?'.includes(ch)) {
      break;
    }
    trail = ch + trail;
    core = core.slice(0, -1);
  }
  return [core, trail];
}

function renderUrlToken(part, key) {
  const href = part.startsWith('www.') ? `https://${part}` : part;
  const [coreHref, trail] = splitTrailingPunctuation(href);
  const coreText = part.slice(0, part.length - trail.length);
  return [
    <a key={key} href={coreHref} target="_blank" rel="noopener noreferrer"
      className="text-indigo-600 underline hover:text-indigo-700 break-all">
      {coreText}
    </a>,
    trail,
  ].filter(Boolean);
}

export function renderWithLinks(text, keyPrefix = 'lnk') {
  if (!text) return text;
  return text.split(LINK_TOKEN_RE).filter(part => part !== '').flatMap((part, i) => {
    const md = part.match(MD_LINK_RE);
    if (md) {
      return [
        <a key={`${keyPrefix}-${i}`} href={md[2]} target="_blank" rel="noopener noreferrer"
          className="text-indigo-600 underline hover:text-indigo-700 break-all">
          {md[1]}
        </a>,
      ];
    }
    if (/^https?:\/\//.test(part) || /^www\./.test(part)) {
      return renderUrlToken(part, `${keyPrefix}-${i}`);
    }
    return [part];
  });
}

// Formats a URL (+ optional display label) into the syntax renderWithLinks understands.
export function formatLinkSnippet(url, label) {
  const trimmedUrl = url.trim();
  const href = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
  const trimmedLabel = label.trim();
  return trimmedLabel ? `[${trimmedLabel}](${href})` : href;
}
