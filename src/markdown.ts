// Tiny zero-dependency Markdown renderer. Supports the common subset:
// headings, bold, italic, inline code, fenced code, bullet/ordered lists,
// task checkboxes (- [ ] / - [x]), blockquotes, horizontal rules, and links.
// All input is HTML-escaped first, so rendered notes can never inject markup.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Only allow safe link protocols — blocks javascript:, data:, etc.
function safeUrl(url: string): string | null {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(url.trim()) ? url.trim() : null;
}

// Null-char placeholder: cannot occur in user text, so it safely brackets
// extracted code spans without colliding with note content (e.g. "3 apples").
const Z = String.fromCharCode(0);

function inline(text: string): string {
  // Protect code spans first so their contents aren't further formatted.
  const codes: string[] = [];
  let s = escapeHtml(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `${Z}${codes.length - 1}${Z}`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, url) => {
    const safe = safeUrl(url);
    return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${t}</a>` : m;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(new RegExp(`${Z}(\\d+)${Z}`, "g"), (_, i) => codes[Number(i)]);
  return s;
}

const TASK_RE = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const ORDERED_RE = /^\s*\d+\.\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^(-{3,}|\*{3,}|_{3,})$/;
const QUOTE_RE = /^>\s?(.*)$/;

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: "ul" | "ol" | "tasks" | "quote" | null = null;
  let inFence = false;
  let fence: string[] = [];
  let checkIdx = 0;

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br>")}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (list === "quote") out.push("</blockquote>");
    else if (list === "ol") out.push("</ol>");
    else if (list) out.push("</ul>");
    list = null;
  };
  const open = (type: typeof list) => {
    if (list !== type) {
      flushPara();
      closeList();
      if (type === "tasks") out.push(`<ul class="md-tasks">`);
      else if (type === "ul") out.push("<ul>");
      else if (type === "ol") out.push("<ol>");
      else if (type === "quote") out.push("<blockquote>");
      list = type;
    }
  };

  for (const line of lines) {
    if (inFence) {
      if (/^```/.test(line)) {
        out.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
        fence = [];
        inFence = false;
      } else {
        fence.push(line);
      }
      continue;
    }
    if (/^```/.test(line)) {
      flushPara();
      closeList();
      inFence = true;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      closeList();
      continue;
    }

    let m: RegExpMatchArray | null;
    if ((m = line.match(HEADING_RE))) {
      flushPara();
      closeList();
      const level = m[1].length;
      out.push(`<h${level}>${inline(m[2])}</h${level}>`);
    } else if (HR_RE.test(line.trim())) {
      flushPara();
      closeList();
      out.push("<hr>");
    } else if ((m = line.match(TASK_RE))) {
      open("tasks");
      const checked = /[xX]/.test(m[1]);
      out.push(
        `<li class="md-task"><input type="checkbox" class="md-check" data-check="${checkIdx++}"${
          checked ? " checked" : ""
        }><span>${inline(m[2])}</span></li>`,
      );
    } else if ((m = line.match(BULLET_RE))) {
      open("ul");
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(ORDERED_RE))) {
      open("ol");
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(QUOTE_RE))) {
      open("quote");
      out.push(`${inline(m[1])}<br>`);
    } else {
      closeList();
      para.push(line);
    }
  }
  if (inFence) out.push(`<pre><code>${escapeHtml(fence.join("\n"))}</code></pre>`);
  flushPara();
  closeList();
  return out.join("\n");
}

/**
 * Flip the Nth task checkbox (0-based, in document order) in a markdown
 * string between `[ ]` and `[x]`. Returns the updated source.
 */
export function toggleTaskCheckbox(src: string, index: number): string {
  let n = -1;
  return src
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*[-*]\s+\[)([ xX])(\].*)$/);
      if (!m) return line;
      n++;
      if (n !== index) return line;
      return m[1] + (/[xX]/.test(m[2]) ? " " : "x") + m[3];
    })
    .join("\n");
}
