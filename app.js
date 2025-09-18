// ===== CONFIG you edit =====
const CONFIG = {
  csvUrl: "meetings.csv",
  defaultStart: { hour: 12, minute: 30, durationMins: 45 },
  topics: {
    current: { text: "TBD", href: "#" },
    previous: [{ text: "—", href: "#" }],
    guides: [
      { text: "Position Paper Template (Google Doc)", href: "#" },
      { text: "Resolution & Clauses Cheat-Sheet", href: "#" },
      { text: "Rules of Procedure Quick Guide", href: "#" },
    ],
  },
  board: {
    president: { name: "Maya Dobre", email: "mailto:1041332@lwsd.org" },
    usg1: { name: "Reem Shadeck", email: "mailto:1095185@lwsd.org" },
    usg2: { name: "Anya Bammi", email: "mailto:1083416@lwsd.org" },
    advisor: { name: "—", email: "mailto:" },
    clubEmail: "teslastemmun@example.org",
  },
  admin: { enabled: true, code: "changeme123" },
};

// ===== Helpers =====
const $ = (sel) => document.querySelector(sel);
const toISO = (d) => new Date(d).toISOString().slice(0, 10);
const fmtDate = (d) =>
  d.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const fmtTime = (d) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function splitCSVLine(line) {
  // handles commas inside quotes
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      q = !q;
      continue;
    }
    if (c === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseDateString(val) {
  val = (val || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val; // ISO
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) {
    const [m, d, y] = val.split("/");
    return `${y.padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
      d
    ).padStart(2, "0")}`;
  }
  return val;
}

async function loadCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok)
    throw new Error(
      `Couldn’t load ${url} (HTTP ${res.status}). Make sure meetings.csv is in the repo root and Pages is enabled.`
    );
  const text = await res.text();
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV is empty.");
  const header = splitCSVLine(lines.shift()).map((s) => s.toLowerCase());
  const di = header.indexOf("date"),
    ri = header.indexOf("room"),
    ti = header.indexOf("topic");
  if (di < 0 || ri < 0 || ti < 0)
    throw new Error("CSV header must be exactly: Date, Room, Topic");
  return lines
    .map((l) => splitCSVLine(l))
    .map((cols) => ({
      date: parseDateString(cols[di]),
      room: (cols[ri] || "").trim(),
      topic: (cols[ti] || "").trim(),
    }))
    .filter((r) => r.date);
}

function computeNext(rows) {
  const now = new Date();
  const { hour, minute, durationMins } = CONFIG.defaultStart;
  const upcoming = rows
    .map((r) => {
      const dt = new Date(r.date + "T00:00:00");
      dt.setHours(hour, minute, 0, 0);
      return { dt, room: r.room || "—", topic: r.topic || "—" };
    })
    .filter((e) => e.dt > now)
    .sort((a, b) => a.dt - b.dt);
  return upcoming[0] ? { ...upcoming[0], durationMins } : null;
}

// Admin (local-only)
function isAdmin() {
  if (!CONFIG.admin.enabled) return false;
  const u = new URL(location.href);
  return u.searchParams.get("admin") === CONFIG.admin.code;
}
function getCancelOverride() {
  try {
    return JSON.parse(localStorage.getItem("mun_cancel_override") || "null");
  } catch {
    return null;
  }
}
function setCancelOverride(dateISO) {
  localStorage.setItem("mun_cancel_override", JSON.stringify({ dateISO }));
}
function clearCancelOverride() {
  localStorage.removeItem("mun_cancel_override");
}

// ===== Render =====
document.addEventListener("DOMContentLoaded", async () => {
  // Static links/content
  $("#interest-link").href = CONFIG.links.interest || "#";
  $("#current-topic").innerHTML = `<a href="${CONFIG.topics.current.href}">${CONFIG.topics.current.text}</a>`;
  const prev = $("#previous-topics");
  prev.innerHTML = "";
  CONFIG.topics.previous.forEach((t) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${t.href}">${t.text}</a>`;
    prev.appendChild(li);
  });
  const gl = $("#guide-links");
  gl.innerHTML = "";
  CONFIG.topics.guides.forEach((g) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${g.href}">${g.text}</a>`;
    gl.appendChild(li);
  });

  const B = CONFIG.board;
  const set = (id, v) => (document.getElementById(id).textContent = v);
  set("president-name", B.president.name);
  $("#president-email").href = B.president.email;
  $("#president-email").textContent = B.president.email.replace("mailto:", "");
  set("usg1-name", B.usg1.name);
  $("#usg1-email").href = B.usg1.email;
  $("#usg1-email").textContent = B.usg1.email.replace("mailto:", "");
  set("usg2-name", B.usg2.name);
  $("#usg2-email").href = B.usg2.email;
  $("#usg2-email").textContent = B.usg2.email.replace("mailto:", "");
  set("treas-name", B.treasurer.name);
  $("#treas-email").href = B.treasurer.email;
  $("#treas-email").textContent = B.treasurer.email.replace("mailto:", "");
  set("advisor-name", B.advisor.name);
  $("#advisor-email").href = B.advisor.email;
  $("#advisor-email").textContent = B.advisor.email.replace("mailto:", "");
  $("#club-email").href = "mailto:" + B.clubEmail;
  $("#club-email").textContent = B.clubEmail;

  // Admin bubble
  if (isAdmin()) {
    const bar = $("#adminBar");
    bar.classList.remove("hidden");
    const status = $("#adminStatus");
    const refresh = () => {
      const ov = getCancelOverride();
      status.textContent = ov
        ? `Local override: cancel ${ov.dateISO}`
        : "No local cancel override";
    };
    $("#toggleCancel").onclick = () => {
      if (window.__NEXT_MEETING) {
        const iso = toISO(window.__NEXT_MEETING.dt);
        const ov = getCancelOverride();
        if (ov && ov.dateISO === iso) clearCancelOverride();
        else setCancelOverride(iso);
        refresh();
        renderNext();
      }
    };
    $("#clearCancel").onclick = () => {
      clearCancelOverride();
      refresh();
      renderNext();
    };
    refresh();
  }

  // CSV fetch with a short timeout to avoid forever “loading”
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 6000);

  let rows = [],
    next = null,
    error = null;
  try {
    rows = await loadCSV(CONFIG.csvUrl, { signal: controller.signal });
    next = computeNext(rows);
    window.__NEXT_MEETING = next;
  } catch (e) {
    error = e;
  } finally {
    clearTimeout(t);
  }

  function renderNext() {
    const line = $("#meeting-line"),
      note = $("#meeting-note"),
      err = $("#errorBox");

    err.classList.add("hidden");
    err.textContent = "";

    if (error) {
      line.textContent = "No upcoming meetings";
      note.textContent = "";
      err.textContent =
        error.message ||
        "Could not load schedule. Check meetings.csv is in the repo root.";
      err.classList.remove("hidden");
      return;
    }
    if (!next) {
      line.textContent = "No upcoming meetings";
      note.textContent = "";
      return;
    }

    const iso = toISO(next.dt);
    const local = getCancelOverride();
    const canceled =
      String(next.topic).toUpperCase() === "CANCELLED" ||
      (local && local.dateISO === iso);

    if (canceled) {
      line.textContent = `${fmtDate(next.dt)} • ${fmtTime(
        next.dt
      )} • Room ${next.room} • CANCELED`;
      note.textContent = `Topic was: ${next.topic}`;
    } else {
      line.textContent = `${fmtDate(next.dt)} • ${fmtTime(
        next.dt
      )} • Room ${next.room} • ${next.topic}`;
      note.textContent = `Duration: ${CONFIG.defaultStart.durationMins} min`;
    }
  }

  renderNext();
});
