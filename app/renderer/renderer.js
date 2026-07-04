const list = document.getElementById("list");
const emptyState = document.getElementById("empty");
const markAllBtn = document.getElementById("mark-all");
const clearBtn = document.getElementById("clear");
const statusEl = document.getElementById("status");

const SEVERITIES = new Set(["info", "success", "warning", "alert"]);

function relTime(iso) {
  const diff = Date.now() - Date.parse(iso);
  if (!Number.isFinite(diff)) return "";
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function render(record) {
  const sev = SEVERITIES.has(record.severity) ? record.severity : "info";
  const el = document.createElement("article");
  el.className = `msg sev-${sev}${record.read ? " read" : ""}`;
  el.dataset.id = record.id || "";
  el.setAttribute("role", "listitem");
  // Roving tabindex: exactly one card is Tab-reachable at a time (see updateRoving).
  el.tabIndex = -1;
  if (!record.read) el.title = "Click or press Enter to mark as read";

  const head = document.createElement("div");
  head.className = "msg-head";
  const dot = document.createElement("span");
  dot.className = "dot";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = record.title || "";
  const spacer = document.createElement("span");
  spacer.className = "spacer";
  const time = document.createElement("time");
  time.className = "time";
  time.dateTime = record.receivedAt || "";
  time.textContent = relTime(record.receivedAt);
  head.append(dot, title, spacer, time);
  el.append(head);

  if (record.source) {
    const src = document.createElement("span");
    src.className = "source";
    src.textContent = record.source;
    el.append(src);
  }

  const body = document.createElement("div");
  body.className = "body";
  body.innerHTML = DOMPurify.sanitize(marked.parse(String(record.body || "")));
  el.append(body);

  return el;
}

function updateMarkAll() {
  const anyUnread = list.querySelector(".msg:not(.read)") !== null;
  markAllBtn.disabled = !anyUnread;
}

function refreshEmpty() {
  emptyState.hidden = list.children.length > 0;
}

// Keep exactly one card in the Tab order. If a card already holds focus, leave it;
// otherwise the first card is the entry point.
function updateRoving() {
  const cards = [...list.children];
  const focused = cards.find((c) => c === document.activeElement);
  cards.forEach((c, i) => { c.tabIndex = focused ? (c === focused ? 0 : -1) : (i === 0 ? 0 : -1); });
}

function markReadEl(el) {
  if (el.classList.contains("read")) return;
  el.classList.add("read");
  el.removeAttribute("title");
  window.raccourier.markRead(el.dataset.id);
  updateMarkAll();
}

function setAll(records) {
  list.replaceChildren(...records.map(render));
  refreshEmpty();
  updateMarkAll();
  updateRoving();
}

function prepend(record) {
  const el = render(record);
  el.classList.add("enter");
  el.addEventListener("animationend", () => el.classList.remove("enter"), { once: true });
  list.prepend(el);
  list.scrollTo({ top: 0 });
  refreshEmpty();
  updateMarkAll();
  updateRoving();
}

// Click a notification to mark it read. Links inside still open externally
// (handled in the main process); the click also marks the message read.
list.addEventListener("click", (e) => {
  const el = e.target.closest(".msg");
  if (el) markReadEl(el);
});

// Keyboard operability — the audience lives on the keyboard. Roving focus with
// arrows / j-k, Home/End to jump, Enter or Space to mark the focused card read.
function moveFocus(current, dir) {
  const cards = [...list.children];
  if (!cards.length) return;
  let idx = cards.indexOf(current);
  if (idx === -1) idx = dir > 0 ? -1 : cards.length;
  const next = cards[Math.min(cards.length - 1, Math.max(0, idx + dir))];
  if (next) { next.tabIndex = 0; cards.forEach((c) => { if (c !== next) c.tabIndex = -1; }); next.focus(); }
}

list.addEventListener("keydown", (e) => {
  // Only when the card itself holds focus — never hijack Enter/Space from a
  // focused link inside the message body (that must still open the link).
  const el = e.target.closest(".msg");
  if (!el || e.target !== el) return;
  const key = e.key;
  if (key === "ArrowDown" || key === "j") { e.preventDefault(); moveFocus(el, 1); }
  else if (key === "ArrowUp" || key === "k") { e.preventDefault(); moveFocus(el, -1); }
  else if (key === "Home") { e.preventDefault(); const f = list.firstElementChild; if (f) { updateRovingTo(f); f.focus(); } }
  else if (key === "End") { e.preventDefault(); const l = list.lastElementChild; if (l) { updateRovingTo(l); l.focus(); } }
  else if (key === "Enter" || key === " ") { e.preventDefault(); markReadEl(el); }
});

function updateRovingTo(target) {
  [...list.children].forEach((c) => { c.tabIndex = c === target ? 0 : -1; });
}

markAllBtn.addEventListener("click", () => {
  window.raccourier.markAllRead();
  list.querySelectorAll(".msg:not(.read)").forEach((el) => {
    el.classList.add("read");
    el.removeAttribute("title");
  });
  updateMarkAll();
});

// Clear hides the currently-visible messages (overlay-only in the main process —
// the append-log is never wiped). Capture the ids so Undo can bring them back.
clearBtn.addEventListener("click", () => {
  const ids = [...list.children].map((el) => el.dataset.id).filter(Boolean);
  if (!ids.length) return;
  window.raccourier.clear();
  showUndo(ids);
});

// ---------- Undo strip ----------
let undoTimer = null;
const undoStrip = document.getElementById("undo");

function hideUndo() {
  if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
  undoStrip.hidden = true;
  undoStrip.classList.remove("show");
}

function showUndo(ids) {
  const n = ids.length;
  undoStrip.querySelector(".undo-label").textContent = `Cleared ${n} ${n === 1 ? "message" : "messages"}`;
  const btn = undoStrip.querySelector(".undo-btn");
  btn.onclick = () => { window.raccourier.unclear(ids); hideUndo(); };
  undoStrip.hidden = false;
  // Reflow so the entrance transition runs from the hidden state.
  void undoStrip.offsetWidth;
  undoStrip.classList.add("show");
  if (undoTimer) clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 6000);
}

// ---------- Connection status ----------
// Main sends a display-ready status: { tone: 'idle'|'ok'|'warn'|'down', text, detail }.
function renderStatus(s) {
  if (!statusEl || !s) return;
  statusEl.dataset.tone = s.tone || "idle";
  statusEl.querySelector(".status-text").textContent = s.text || "";
  statusEl.title = s.detail || s.text || "";
  statusEl.hidden = false;
}

window.raccourier.onInit((records) => setAll(records)); // records arrive newest-first
window.raccourier.onMessage((record) => { hideUndo(); prepend(record); });
if (window.raccourier.onStatus) window.raccourier.onStatus(renderStatus);

window.raccourier.ready();
