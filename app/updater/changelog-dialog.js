"use strict";

const params = new URLSearchParams(window.location.search);
const initialLocaleParam = params.get("locale") || "";
let currentLocale = ["pt", "es", "en"].includes(initialLocaleParam)
  ? initialLocaleParam
  : "pt";

let currentVersion = "";
let currentReleaseNotes = "";
let currentReleaseName = "";

function getStrings(loc) {
  if (
    window.ZAPPR_STRINGS &&
    window.ZAPPR_STRINGS[loc] &&
    window.ZAPPR_STRINGS[loc].changelogDialog
  ) {
    return window.ZAPPR_STRINGS[loc].changelogDialog;
  }
  if (
    window.ZAPPR_STRINGS &&
    window.ZAPPR_STRINGS.pt &&
    window.ZAPPR_STRINGS.pt.changelogDialog
  ) {
    return window.ZAPPR_STRINGS.pt.changelogDialog;
  }
  return {
    windowTitle: "Novidades do Zappr",
    heading: (version) => `Zappr foi atualizado para ${version}`,
    subheading: "Confira o que há de novo nesta versão:",
    noNotes: "Sem notas detalhadas para esta versão.",
    noNotesDesc:
      "Você pode acompanhar o histórico completo de lançamentos e novidades no GitHub.",
    viewOnGithub: "Ver no GitHub",
    close: "Fechar",
  };
}

const headingEl = document.getElementById("heading");
const subheadingEl = document.getElementById("subheading");
const releaseTagEl = document.getElementById("release-tag");
const releaseNameEl = document.getElementById("release-name");
const notesEl = document.getElementById("notes");
const modalCloseBtn = document.getElementById("modal-close-btn");
const closeBtn = document.getElementById("close");
const githubBtn = document.getElementById("github-releases-btn");
const releasesBtnLabelEl = document.getElementById("releases-btn-label");
const emptyStateTitleEl = document.getElementById("empty-state-title");
const emptyStateDescEl = document.getElementById("empty-state-desc");

function applyLocale(loc) {
  currentLocale = ["pt", "es", "en"].includes(loc) ? loc : "pt";
  const L = getStrings(currentLocale);

  document.documentElement.lang = currentLocale;
  document.title = L.windowTitle;

  if (headingEl) {
    if (currentVersion) {
      headingEl.textContent =
        typeof L.heading === "function"
          ? L.heading(currentVersion)
          : `Zappr ${currentVersion}`;
    } else {
      headingEl.textContent = L.windowTitle;
    }
  }

  if (subheadingEl) {
    subheadingEl.textContent = L.subheading;
  }

  if (modalCloseBtn) {
    modalCloseBtn.setAttribute("aria-label", L.close);
  }

  if (closeBtn) {
    closeBtn.textContent = L.close;
  }

  if (releasesBtnLabelEl) {
    releasesBtnLabelEl.textContent = L.viewOnGithub;
  }

  if (emptyStateTitleEl) {
    emptyStateTitleEl.textContent = L.noNotes;
  }

  if (emptyStateDescEl) {
    emptyStateDescEl.textContent = L.noNotesDesc || L.noNotes;
  }
}

function closeDialog() {
  if (
    window.changelogDialog &&
    typeof window.changelogDialog.close === "function"
  ) {
    window.changelogDialog.close();
  } else {
    window.close();
  }
}

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeDialog);
if (closeBtn) closeBtn.addEventListener("click", closeDialog);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDialog();
  }
});

function openExternalUrl(url) {
  if (!url) return;
  if (
    window.changelogDialog &&
    typeof window.changelogDialog.openLink === "function"
  ) {
    window.changelogDialog.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

if (githubBtn) {
  githubBtn.addEventListener("click", () => {
    const tag = currentVersion
      ? currentVersion.startsWith("v")
        ? currentVersion
        : `v${currentVersion}`
      : "";
    const url = tag
      ? `https://github.com/pedruhb/Zappr/releases/tag/${encodeURIComponent(tag)}`
      : "https://github.com/pedruhb/Zappr/releases";
    openExternalUrl(url);
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInline(str) {
  let s = escapeHtml(str);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" class="changelog-link" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return s;
}

function parseMarkdown(md) {
  if (!md) return "";
  if (/<\/?(p|ul|ol|li|h[1-6]|pre|code|div|table|blockquote|hr)\b/i.test(md)) {
    return md;
  }

  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;
  let codeBlockLines = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        out.push(
          `<pre><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`,
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        if (inOrderedList) {
          out.push("</ol>");
          inOrderedList = false;
        }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inOrderedList) {
        out.push("</ol>");
        inOrderedList = false;
      }
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inOrderedList) {
        out.push("</ol>");
        inOrderedList = false;
      }
      const level = Math.min(Math.max(headingMatch[1].length, 2), 4);
      out.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inOrderedList) {
        out.push("</ol>");
        inOrderedList = false;
      }
      out.push("<hr>");
      continue;
    }

    if (trimmed.startsWith(">")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inOrderedList) {
        out.push("</ol>");
        inOrderedList = false;
      }
      const content = trimmed.replace(/^>\s?/, "");
      out.push(`<blockquote>${formatInline(content)}</blockquote>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[*+-]\s+(.*)$/);
    if (ulMatch) {
      if (inOrderedList) {
        out.push("</ol>");
        inOrderedList = false;
      }
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (!inOrderedList) {
        out.push("<ol>");
        inOrderedList = true;
      }
      out.push(`<li>${formatInline(olMatch[1])}</li>`);
      continue;
    }

    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (inOrderedList) {
      out.push("</ol>");
      inOrderedList = false;
    }
    out.push(`<p>${formatInline(trimmed)}</p>`);
  }

  if (inCodeBlock) {
    out.push(
      `<pre><code>${escapeHtml(codeBlockLines.join("\n"))}</code></pre>`,
    );
  }
  if (inList) out.push("</ul>");
  if (inOrderedList) out.push("</ol>");

  return out.join("\n");
}

const ALLOWED = new Set([
  "P",
  "UL",
  "OL",
  "LI",
  "STRONG",
  "B",
  "EM",
  "I",
  "CODE",
  "PRE",
  "HR",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "A",
  "SPAN",
]);

const DROPPED = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "NOSCRIPT",
]);

function rebuild(source, target) {
  for (const node of source.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(document.createTextNode(node.textContent));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (DROPPED.has(node.tagName)) continue;
      if (node.tagName === "BR") {
        target.appendChild(document.createElement("br"));
      } else if (ALLOWED.has(node.tagName)) {
        const el = document.createElement(node.tagName);
        if (node.tagName === "A") {
          const href = node.getAttribute("href");
          if (
            href &&
            (href.startsWith("https://") || href.startsWith("http://"))
          ) {
            el.setAttribute("href", href);
            el.className = "changelog-link";
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
            el.addEventListener("click", (e) => {
              e.preventDefault();
              openExternalUrl(href);
            });
          }
        }
        rebuild(node, target.appendChild(el));
      } else {
        rebuild(node, target);
      }
    }
  }
}

function renderNotes(container, notes) {
  if (!notes || !notes.trim()) {
    container.innerHTML = `
      <div class="empty-state" id="empty-state">
        <div class="empty-state-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        </div>
        <h3 class="empty-state-title" id="empty-state-title">${escapeHtml(getStrings(currentLocale).noNotes)}</h3>
        <p class="empty-state-desc" id="empty-state-desc">${escapeHtml(getStrings(currentLocale).noNotesDesc || getStrings(currentLocale).noNotes)}</p>
      </div>
    `;
    return;
  }

  const html = parseMarkdown(notes);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  container.innerHTML = "";
  rebuild(parsed.body, container);
}

applyLocale(currentLocale);

if (window.changelogDialog && window.changelogDialog.onLocaleChanged) {
  window.changelogDialog.onLocaleChanged((newLocale) => {
    applyLocale(newLocale);
    if (notesEl && (!currentReleaseNotes || !currentReleaseNotes.trim())) {
      renderNotes(notesEl, currentReleaseNotes);
    }
  });
}

if (window.changelogDialog && window.changelogDialog.onNotes) {
  window.changelogDialog.onNotes(
    ({ version, releaseName, releaseNotes, locale }) => {
      if (locale) {
        applyLocale(locale);
      }

      currentVersion = version
        ? version.startsWith("v")
          ? version
          : `v${version}`
        : "";
      currentReleaseNotes = releaseNotes || "";
      currentReleaseName = releaseName || "";

      const L = getStrings(currentLocale);

      if (headingEl) {
        headingEl.textContent =
          typeof L.heading === "function"
            ? L.heading(currentVersion || currentReleaseName || "")
            : `Zappr ${currentVersion}`;
      }

      if (releaseTagEl) {
        releaseTagEl.textContent = currentVersion || "Release";
      }

      if (releaseNameEl) {
        releaseNameEl.textContent =
          currentReleaseName || "Cliente desktop para WhatsApp Web";
      }

      if (notesEl) {
        renderNotes(notesEl, currentReleaseNotes);
      }
    },
  );
}
