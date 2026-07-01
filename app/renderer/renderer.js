const list = document.getElementById("list");
const emptyState = document.getElementById("empty");

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
  el.className = `msg sev-${sev}`;

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

function refreshEmpty() {
  const has = list.children.length > 0;
  emptyState.hidden = has;
}

function setAll(records) {
  list.replaceChildren(...records.map(render));
  refreshEmpty();
}

function prepend(record) {
  const el = render(record);
  el.classList.add("enter");
  el.addEventListener("animationend", () => el.classList.remove("enter"), { once: true });
  list.prepend(el);
  list.scrollTo({ top: 0 });
  refreshEmpty();
}

window.raccourier.onInit((records) => setAll(records)); // records arrive newest-first
window.raccourier.onMessage((record) => prepend(record));

document.getElementById("clear").addEventListener("click", () => window.raccourier.clear());

window.raccourier.ready();
