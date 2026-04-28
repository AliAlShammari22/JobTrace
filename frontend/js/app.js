// ── Auth guard ──
if (!getToken()) navigateTo("index.html");

// ── Smooth navigation ──
function navigateTo(url) {
  document.body.classList.add("fade-out");
  setTimeout(() => { window.location.href = url; }, 250);
}

// ── State ──
let jobToDeleteId   = null;
let cardToDelete    = null;
let debounceTimer   = null;
let currentView     = localStorage.getItem("jobtrace_view") || "list";
let lastStats       = { total: 0, Applied: 0, Interview: 0, Offer: 0, Rejected: 0 };
let chatHistory     = [];
let chatRendered    = false;
const CHAT_KEY      = "jobtrace_chat";
const getChatKey    = () => { const u = getUser(); const id = u?.id || u?._id; return id ? `${CHAT_KEY}_${id}` : CHAT_KEY; };

// ── Motivational quotes ──
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Opportunities don't happen. You create them.", author: "Chris Grosser" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "Your work is going to fill a large part of your life. Make it great.", author: "Steve Jobs" },
  { text: "Every expert was once a beginner.", author: "Helen Hayes" },
  { text: "Push yourself, because no one else is going to do it for you.", author: "Unknown" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
];

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  const user = getUser();
  if (user) {
    const first = user.name.split(" ")[0];
const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    document.getElementById("welcomeHeading").textContent = `${greeting}, ${first}! 👋`;
  }
  const now = new Date();
  document.getElementById("welcomeDate").textContent = now.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  document.getElementById("viewList").classList.toggle("active", currentView === "list");
  document.getElementById("viewKanban").classList.toggle("active", currentView === "kanban");
  showQuote();
  loadStats();
  loadJobs();
  loadHeatmap();
  maybeStartTour();
  document.getElementById("dateApplied").valueAsDate = new Date();

  // Auto-refresh: reload data every 60 seconds
  setInterval(() => { loadStats(); loadJobs(); loadHeatmap(); }, 60000);

  // Also refresh when the user comes back to this tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { loadStats(); loadJobs(); loadHeatmap(); }
  });

  // 3D tilt on stat cards
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform = `perspective(500px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateY(-3px)`;
    });
    card.addEventListener("mouseleave", () => { card.style.transform = ""; });
  });
});

// ════════════════════════════════════════
// STATS  (with animated counters)
// ════════════════════════════════════════
async function loadStats() {
  try {
    const { stats } = await Jobs.getStats();
    lastStats = stats;
    animateCounter(document.getElementById("statTotal"),     stats.total);
    animateCounter(document.getElementById("statApplied"),   stats.Applied);
    animateCounter(document.getElementById("statInterview"), stats.Interview);
    animateCounter(document.getElementById("statOffer"),     stats.Offer);
    animateCounter(document.getElementById("statRejected"),  stats.Rejected);
    updateSuggestionChips(stats);
    renderFunnel(stats);
    checkMilestones(stats);
  } catch {
    // silent
  }
}

// ── Milestone badges ──
const MILESTONES = [
  { id: "first_app",   icon: "🎯", label: "First Step",       check: (s) => s.total >= 1 },
  { id: "five_apps",   icon: "🚀", label: "Getting Started",  check: (s) => s.total >= 5 },
  { id: "ten_apps",    icon: "💼", label: "In Full Swing",    check: (s) => s.total >= 10 },
  { id: "twenty_apps", icon: "📬", label: "Committed",        check: (s) => s.total >= 20 },
  { id: "first_int",   icon: "🗣️", label: "First Interview",  check: (s) => (s.Interview + s.Offer) >= 1 },
  { id: "multi_int",   icon: "🎤", label: "Hot Candidate",    check: (s) => (s.Interview + s.Offer) >= 5 },
  { id: "first_offer", icon: "🏆", label: "Offer Received",   check: (s) => s.Offer >= 1 },
  { id: "resilient",   icon: "💪", label: "Resilient",        check: (s) => s.Rejected >= 5 },
];

function checkMilestones(stats) {
  const shelf = document.getElementById("milestoneShelf");
  shelf.hidden = false;

  const prev    = JSON.parse(localStorage.getItem("jobtrace_milestones") || "[]");
  const earned  = MILESTONES.filter((m) => m.check(stats));
  const earnedIds = earned.map((m) => m.id);

  earned.filter((m) => !prev.includes(m.id))
        .forEach((m) => showToast(`${m.icon} Badge unlocked: ${m.label}!`, "success"));
  localStorage.setItem("jobtrace_milestones", JSON.stringify(earnedIds));

  document.getElementById("milestoneItems").innerHTML = MILESTONES.map((m) => {
    const unlocked = earnedIds.includes(m.id);
    return `
    <div class="milestone-badge ${unlocked ? "milestone-unlocked" : "milestone-locked"}" title="${unlocked ? m.label : "???"}" >
      <span class="ms-icon">${unlocked ? m.icon : "🔒"}</span>
      <span class="ms-label">${unlocked ? m.label : "???"}</span>
    </div>`;
  }).join("");
}

function renderFunnel(stats) {
  const section = document.getElementById("funnelSection");
  if (!section || !stats.total) { if (section) section.hidden = true; return; }
  section.hidden = false;

  const interviewed   = stats.Interview + stats.Offer;
  const toInterview   = Math.round((interviewed   / stats.total)   * 100);
  const toOffer       = interviewed > 0 ? Math.round((stats.Offer / interviewed) * 100) : 0;

  const rateColor = (pct) => pct >= 30 ? "#22c55e" : pct >= 10 ? "#f59e0b" : "#ef4444";

  document.getElementById("funnelStages").innerHTML = `
    <div class="funnel-node">
      <div class="funnel-node-num" style="color:#3b82f6">${stats.total}</div>
      <div class="funnel-node-name">Total Applied</div>
    </div>
    <div class="funnel-connector">
      <span class="funnel-rate" style="color:${rateColor(toInterview)}">${toInterview}%</span>
      <svg class="funnel-arrow-svg" viewBox="0 0 32 10" fill="none">
        <path d="M0 5 H26 M22 1 L30 5 L22 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="funnel-rate-label">interview rate</span>
    </div>
    <div class="funnel-node">
      <div class="funnel-node-num" style="color:#f59e0b">${interviewed}</div>
      <div class="funnel-node-name">Interviews</div>
    </div>
    <div class="funnel-connector">
      <span class="funnel-rate" style="color:${rateColor(toOffer)}">${toOffer}%</span>
      <svg class="funnel-arrow-svg" viewBox="0 0 32 10" fill="none">
        <path d="M0 5 H26 M22 1 L30 5 L22 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="funnel-rate-label">offer rate</span>
    </div>
    <div class="funnel-node">
      <div class="funnel-node-num" style="color:#22c55e">${stats.Offer}</div>
      <div class="funnel-node-name">Offers 🎉</div>
    </div>`;
}

function animateCounter(el, target, duration = 900) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ════════════════════════════════════════
// JOBS LIST
// ════════════════════════════════════════
function getFilters() {
  return {
    status: document.getElementById("statusFilter").value,
    search: document.getElementById("searchInput").value.trim(),
    sort:   document.getElementById("sortSelect").value,
  };
}

function setView(view) {
  currentView = view;
  localStorage.setItem("jobtrace_view", view);
  document.getElementById("viewList").classList.toggle("active", view === "list");
  document.getElementById("viewKanban").classList.toggle("active", view === "kanban");
  loadJobs();
}

async function loadJobs() {
  const list    = document.getElementById("jobsList");
  const empty   = document.getElementById("emptyState");
  const loading = document.getElementById("loadingState");
  const board   = document.getElementById("kanbanBoard");

  list.hidden    = false;
  board.hidden   = true;
  loading.hidden = true;
  empty.hidden   = true;
  list.querySelectorAll(".job-card, .skeleton-card").forEach((el) => el.remove());
  if (currentView === "list") showSkeletons(list, 4);

  try {
    const { jobs } = await Jobs.getAll(getFilters());
    list.querySelectorAll(".skeleton-card").forEach((el) => el.remove());

    if (jobs.length === 0) {
      const { status, search } = getFilters();
      const isFiltered = status !== "All" || search !== "";
      const emptyH3  = empty.querySelector("h3");
      const emptyP   = empty.querySelector("p");
      const emptyBtn = empty.querySelector("button");
      if (isFiltered) {
        emptyH3.textContent = "No matching applications";
        emptyP.textContent  = "Try adjusting your search or filter to find what you're looking for.";
        emptyBtn.hidden = true;
      } else {
        emptyH3.textContent = "No applications yet";
        emptyP.textContent  = "Start tracking your job search by adding your first application.";
        emptyBtn.hidden = false;
      }
      empty.hidden = false;
      return;
    }

    if (currentView === "kanban") {
      list.hidden  = true;
      board.hidden = false;
      renderKanban(jobs);
    } else {
      jobs.forEach((job) => list.appendChild(createJobCard(job)));
    }

    showStreak(jobs);
    const badge = document.getElementById("jobsCount");
    if (badge) badge.textContent = jobs.length;
  } catch (err) {
    list.querySelectorAll(".skeleton-card").forEach((el) => el.remove());
    showToast(err.message, "error");
  }
}

function showSkeletons(container, count = 4) {
  for (let i = 0; i < count; i++) {
    const sk = document.createElement("div");
    sk.className = "skeleton-card";
    sk.innerHTML = `
      <div class="sk-accent"></div>
      <div class="sk-body">
        <div class="sk-header">
          <div class="sk-avatar shimmer"></div>
          <div class="sk-titles">
            <div class="sk-line sk-company shimmer"></div>
            <div class="sk-line sk-role shimmer"></div>
          </div>
          <div class="sk-badge shimmer"></div>
        </div>
        <div class="sk-meta shimmer"></div>
        <div class="sk-pipeline shimmer"></div>
      </div>`;
    container.appendChild(sk);
  }
}

const KANBAN_COLS = [
  { status: "Applied",   color: "#2563eb", bg: "rgba(219,234,254,.5)", border: "#bfdbfe" },
  { status: "Interview", color: "#d97706", bg: "rgba(254,243,199,.5)", border: "#fde68a" },
  { status: "Offer",     color: "#16a34a", bg: "rgba(220,252,231,.5)", border: "#bbf7d0" },
  { status: "Rejected",  color: "#dc2626", bg: "rgba(254,226,226,.5)", border: "#fecaca" },
];

function renderKanban(jobs) {
  const board = document.getElementById("kanbanBoard");
  board.innerHTML = "";
  KANBAN_COLS.forEach((col) => {
    const colJobs = jobs.filter((j) => j.status === col.status);
    const colEl   = document.createElement("div");
    colEl.className = "kanban-col";
    colEl.innerHTML = `
      <div class="kanban-col-header" style="background:${col.bg};border-color:${col.border}">
        <span class="kanban-col-title" style="color:${col.color}">${col.status}</span>
        <span class="kanban-col-count" style="background:${col.color}">${colJobs.length}</span>
      </div>
      <div class="kanban-cards" id="kcol-${col.status.toLowerCase()}">
        ${colJobs.length === 0 ? '<div class="kanban-empty">No applications</div>' : ""}
      </div>
    `;
    const cardsEl = colEl.querySelector(".kanban-cards");
    colJobs.forEach((job) => cardsEl.appendChild(createKanbanCard(job)));
    board.appendChild(colEl);
  });
}

function createKanbanCard(job) {
  const card = document.createElement("div");
  card.className = "kanban-card";
  card.dataset.id     = job._id;
  card.dataset.status = job.status;
  const date = new Date(job.dateApplied).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const notesSnippet = job.notes ? `<div class="kcard-notes">"${escapeHTML(job.notes).substring(0, 50)}${job.notes.length > 50 ? "…" : ""}"</div>` : "";
  card.innerHTML = `
    <div class="kcard-top">
      <div class="kcard-titles">
        <div class="kcard-company">${escapeHTML(job.companyName)}</div>
        <div class="kcard-role">${escapeHTML(job.jobTitle)}</div>
      </div>
      <div class="kcard-actions">
        <button class="icon-btn" onclick="openJobModal('${job._id}')" aria-label="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn delete" onclick="openDeleteModal('${job._id}', '${escapeHTML(job.companyName)}')" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
    ${notesSnippet}
    <div class="kcard-date">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      ${date}
    </div>
  `;
  return card;
}


function guessDomain(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").split(/\s+/)[0] + ".com";
}

function createJobCard(job) {
  const card = document.createElement("div");
  card.className = `job-card status-${job.status.toLowerCase()}`;
  card.dataset.id     = job._id;
  card.dataset.status = job.status;

  const date     = new Date(job.dateApplied).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const notesText = job.notes ? escapeHTML(job.notes) : "";
  const domain    = guessDomain(job.companyName);
  const initial   = job.companyName.charAt(0).toUpperCase();

  card.innerHTML = `
    <div class="card-accent"></div>
    <div class="card-body">
      <div class="card-header">
        <div class="company-info">
          <div class="company-avatar">
            <span class="avatar-initial">${initial}</span>
            <img class="avatar-favicon"
                 src="https://logo.clearbit.com/${domain}"
                 alt="${escapeHTML(job.companyName)} logo"
                 onload="this.classList.add('loaded')"
                 onerror="this.src='https://www.google.com/s2/favicons?sz=64&domain=${domain}'">
          </div>
          <div class="card-titles">
            <div class="job-company">${escapeHTML(job.companyName)}</div>
            <div class="job-title">${escapeHTML(job.jobTitle)}</div>
          </div>
        </div>
        <div class="card-top-right">
          <button class="badge badge-${job.status.toLowerCase()} badge-clickable" onclick="cycleStatus(this,'${job._id}')" title="Click to change status">${job.status}</button>
          <div class="job-card-actions">
            <button class="icon-btn" onclick="openJobModal('${job._id}')" aria-label="Edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="icon-btn delete" onclick="openDeleteModal('${job._id}', '${escapeHTML(job.companyName)}')" aria-label="Delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div class="card-meta">
        <span class="job-date">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${date}
        </span>
        <button class="notes-toggle" aria-label="Toggle notes" aria-expanded="false">
          <svg class="notes-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Notes
          <svg class="notes-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
      ${buildPipeline(job.status)}
      <div class="card-notes-expanded" aria-hidden="true">
        <div class="card-notes-inner" title="Click to edit note">
          ${notesText
            ? `<p class="card-notes-text">${notesText}</p>`
            : `<p class="card-notes-empty">No notes yet — click to add one.</p>`
          }
        </div>
      </div>
    </div>
  `;

  card.querySelector(".notes-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    const expanded = card.classList.toggle("notes-open");
    card.querySelector(".card-notes-expanded").setAttribute("aria-hidden", String(!expanded));
    card.querySelector(".notes-toggle").setAttribute("aria-expanded", String(expanded));
  });

  // Inline note editing
  let liveNotes = job.notes || "";
  card.querySelector(".card-notes-inner").addEventListener("click", () => {
    startInlineNoteEdit(card.querySelector(".card-notes-inner"), job._id, liveNotes, (saved) => {
      liveNotes = saved;
    });
  });

  return card;
}

function startInlineNoteEdit(inner, id, currentNotes, onSave) {
  if (inner.querySelector("textarea")) return;
  inner.classList.add("notes-editing");

  const ta = document.createElement("textarea");
  ta.className     = "notes-inline-editor";
  ta.value         = currentNotes;
  ta.placeholder   = "Add your notes here…";
  ta.rows          = 3;
  inner.innerHTML  = "";
  inner.appendChild(ta);
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);

  async function commit() {
    const newNotes = ta.value.trim();
    inner.classList.remove("notes-editing");
    inner.innerHTML = newNotes
      ? `<p class="card-notes-text">${escapeHTML(newNotes)}</p>`
      : `<p class="card-notes-empty">No notes yet — click to add one.</p>`;

    if (newNotes !== currentNotes) {
      try {
        await Jobs.update(id, { notes: newNotes });
        onSave(newNotes);
        currentNotes = newNotes;
        showToast("Note saved ✓", "success");
      } catch {
        showToast("Failed to save note", "error");
        inner.innerHTML = currentNotes
          ? `<p class="card-notes-text">${escapeHTML(currentNotes)}</p>`
          : `<p class="card-notes-empty">No notes yet — click to add one.</p>`;
      }
    }

    inner.addEventListener("click", () =>
      startInlineNoteEdit(inner, id, currentNotes, onSave), { once: true });
  }

  ta.addEventListener("blur", commit);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { ta.value = currentNotes; ta.blur(); }
  });
}

// ── Search / filter / sort ──
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadJobs, 320);
});
document.getElementById("statusFilter").addEventListener("change", loadJobs);
document.getElementById("sortSelect").addEventListener("change", loadJobs);

// ════════════════════════════════════════
// JOB MODAL (add / edit)
// ════════════════════════════════════════
async function openJobModal(id = null) {
  clearJobForm();
  hideAlert("modalAlert");
  const title = document.getElementById("modalTitle");

  if (id) {
    title.textContent = "Edit Job Application";
    document.getElementById("modalSubtitle").textContent = "Update the details for this application";
    document.getElementById("jobSubmitBtn").querySelector(".btn-text").textContent = "Save Changes";
    try {
      const { jobs } = await Jobs.getAll(getFilters());
      const job = jobs.find((j) => j._id === id);
      if (!job) return showToast("Job not found.", "error");
      document.getElementById("jobId").value       = job._id;
      document.getElementById("companyName").value = job.companyName;
      document.getElementById("jobTitle").value    = job.jobTitle;
      syncStatusPills(job.status);
      document.getElementById("dateApplied").value = job.dateApplied.split("T")[0];
      document.getElementById("notes").value       = job.notes || "";
    } catch (err) {
      return showToast(err.message, "error");
    }
  } else {
    title.textContent = "Add Job Application";
    document.getElementById("modalSubtitle").textContent = "Track a new opportunity in your pipeline";
    document.getElementById("jobSubmitBtn").querySelector(".btn-text").textContent = "Save Application";
    document.getElementById("dateApplied").valueAsDate = new Date();
  }

  document.getElementById("jobModalOverlay").hidden = false;
  document.getElementById("companyName").focus();
}

function closeJobModal(event) {
  if (event && event.target !== document.getElementById("jobModalOverlay")) return;
  document.getElementById("jobModalOverlay").hidden = true;
  clearJobForm();
}

function syncStatusPills(value) {
  document.querySelectorAll("#statusPicker .status-pill").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });
  document.getElementById("jobStatus").value = value;
}

document.getElementById("statusPicker").addEventListener("click", (e) => {
  const pill = e.target.closest(".status-pill");
  if (pill) syncStatusPills(pill.dataset.value);
});

function clearJobForm() {
  document.getElementById("jobForm").reset();
  document.getElementById("jobId").value = "";
  syncStatusPills("Applied");
  document.querySelectorAll("#jobForm .field-error").forEach((el) => (el.textContent = ""));
  document.querySelectorAll("#jobForm .input-error").forEach((el) => el.classList.remove("input-error"));
}

document.getElementById("jobForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("modalAlert");

  const id          = document.getElementById("jobId").value;
  const companyName = document.getElementById("companyName").value.trim();
  const jobTitle    = document.getElementById("jobTitle").value.trim();
  const status      = document.getElementById("jobStatus").value;
  const dateApplied = document.getElementById("dateApplied").value;
  const notes       = document.getElementById("notes").value.trim();

  let valid = true;
  if (!companyName) { showModalFieldError("companyNameError", "Company name is required"); valid = false; }
  if (!jobTitle)    { showModalFieldError("jobTitleError",    "Job title is required"); valid = false; }
  if (!dateApplied) { showModalFieldError("dateAppliedError", "Date applied is required"); valid = false; }
  if (!valid) return;

  const payload = { companyName, jobTitle, status, dateApplied, notes };

  setModalLoading(true);
  try {
    if (id) {
      await Jobs.update(id, payload);
      showToast("Application updated!", "success");
    } else {
      await Jobs.create(payload);
      showToast(`${companyName} added!`, "success");
    }

    if (status === "Offer") launchConfetti();

    document.getElementById("jobModalOverlay").hidden = true;
    clearJobForm();
    await Promise.all([loadJobs(), loadStats(), loadHeatmap()]);
  } catch (err) {
    showAlert("modalAlert", err.message);
  } finally {
    setModalLoading(false);
  }
});

function showModalFieldError(errorId, message) {
  document.getElementById(errorId).textContent = message;
  document.getElementById(errorId.replace("Error", ""))?.classList.add("input-error");
}

function setModalLoading(loading) {
  const btn = document.getElementById("jobSubmitBtn");
  btn.disabled = loading;
  btn.querySelector(".btn-text").hidden    = loading;
  btn.querySelector(".btn-spinner").hidden = !loading;
}

// ════════════════════════════════════════
// DELETE MODAL
// ════════════════════════════════════════
function openDeleteModal(id, companyName) {
  jobToDeleteId = id;
  cardToDelete  = document.querySelector(`.job-card[data-id="${id}"], .kanban-card[data-id="${id}"]`);
  document.getElementById("deleteJobName").textContent = companyName;
  document.getElementById("deleteModalOverlay").hidden = false;
}

function closeDeleteModal(event) {
  if (event && event.target !== document.getElementById("deleteModalOverlay")) return;
  document.getElementById("deleteModalOverlay").hidden = true;
  jobToDeleteId = null;
}

function confirmDelete() {
  if (!jobToDeleteId) return;

  const id   = jobToDeleteId;
  const card = cardToDelete;
  jobToDeleteId = null;
  cardToDelete  = null;

  document.getElementById("deleteModalOverlay").hidden = true;

  // Animate card out immediately — no API call yet
  if (card) {
    card.style.maxHeight = card.offsetHeight + "px";
    card.style.overflow  = "hidden";
    requestAnimationFrame(() => card.classList.add("card-deleting"));
  }

  // Optimistically decrement counters right away
  const deletedStatus = card?.dataset.status;
  const s = { ...lastStats };
  s.total = Math.max(0, s.total - 1);
  if (deletedStatus && s[deletedStatus] !== undefined) s[deletedStatus] = Math.max(0, s[deletedStatus] - 1);
  lastStats = s;
  animateCounter(document.getElementById("statTotal"),     s.total);
  animateCounter(document.getElementById("statApplied"),   s.Applied);
  animateCounter(document.getElementById("statInterview"), s.Interview);
  animateCounter(document.getElementById("statOffer"),     s.Offer);
  animateCounter(document.getElementById("statRejected"),  s.Rejected);
  renderFunnel(s);
  checkMilestones(s);

  // Commit the delete after the undo window
  const deleteTimer = setTimeout(async () => {
    if (card) card.remove();
    try {
      await Jobs.delete(id);
      await Promise.all([loadJobs(), loadStats(), loadHeatmap()]);
    } catch {
      showToast("Couldn't delete — please try again.", "error");
      await loadJobs();
    }
  }, 5000);

  // Undo toast — cancels the timer and reverses the animation
  showUndoToast("Application deleted.", () => {
    clearTimeout(deleteTimer);
    if (card) {
      card.classList.remove("card-deleting");
      setTimeout(() => {
        card.style.maxHeight = "";
        card.style.overflow  = "";
      }, 600);
    }
  });
}

function showUndoToast(message, onUndo) {
  const DURATION  = 5000;
  const container = document.getElementById("toastContainer");
  const toast     = document.createElement("div");
  toast.className = "toast toast-success toast-undo show";
  toast.innerHTML = `
    <span class="toast-icon">✓</span>
    <span class="toast-undo-msg">${escapeHTML(message)}</span>
    <button class="toast-undo-btn">Undo</button>
    <div class="toast-undo-bar"></div>`;
  container.appendChild(toast);

  const bar = toast.querySelector(".toast-undo-bar");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bar.style.transitionDuration = `${DURATION}ms`;
    bar.style.transform = "scaleX(0)";
  }));

  function dismiss() {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }

  const autoTimer = setTimeout(dismiss, DURATION);

  toast.querySelector(".toast-undo-btn").addEventListener("click", () => {
    clearTimeout(autoTimer);
    dismiss();
    onUndo();
  });
}

// ════════════════════════════════════════
// ════════════════════════════════════════
// AI ADVISOR
// ════════════════════════════════════════

// ── Markdown renderer ──
function renderMarkdown(raw) {
  let text = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g,     "<em>$1</em>");

  const lines = text.split("\n");
  const out   = [];
  let inUl = false, inOl = false;

  for (const line of lines) {
    const ulMatch = line.match(/^[-•]\s+(.+)/);
    const olMatch = line.match(/^\d+\.\s+(.+)/);
    if (ulMatch) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${olMatch[1]}</li>`);
    } else {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      out.push(line.trim() === "" ? "<br>" : line + "<br>");
    }
  }
  if (inUl) out.push("</ul>");
  if (inOl) out.push("</ol>");
  return out.join("").replace(/(<br>\s*)+$/, "");
}

// ── Chat persistence ──
function saveChatHistory() {
  localStorage.setItem(getChatKey(), JSON.stringify(chatHistory));
}

// ── Context-aware suggestion chips ──
function updateSuggestionChips(stats) {
  const el = document.getElementById("aiSuggestions");
  if (!el) return;

  const pool = [];
  if (stats.total === 0) {
    pool.push("How do I start my job search?", "What makes a strong resume?", "Tips for cold outreach");
  } else {
    if (stats.Rejected > 3)                          pool.unshift("Why am I getting so many rejections?");
    if (stats.Applied > 4 && stats.Interview === 0)  pool.unshift("How do I get more interviews?");
    if (stats.Interview > 0)                         pool.push("How do I ace my next interview?");
    if (stats.Offer > 0)                             pool.push("How do I negotiate my salary?");
    pool.push("How's my progress?", "Write a follow-up email template", "Tips to stand out");
  }

  el.innerHTML = "";
  pool.slice(0, 4).forEach((label) => {
    const btn = document.createElement("button");
    btn.className = "suggestion-chip";
    btn.textContent = label;
    btn.addEventListener("click", () => sendSuggestion(btn));
    el.appendChild(btn);
  });
}

// ── Open / close ──
function openAI() {
  document.getElementById("aiModalOverlay").hidden = false;

  if (!chatRendered) {
    chatRendered = true;
    try {
      const saved = JSON.parse(localStorage.getItem(getChatKey()) || "[]");
      if (saved.length > 0) {
        chatHistory = saved;
        saved.forEach((msg) =>
          appendAIMessage(msg.content, msg.role === "assistant" ? "bot" : "user", false)
        );
      }
    } catch { /* ignore corrupt storage */ }
  }

  updateSuggestionChips(lastStats);
  const messagesEl = document.getElementById("aiMessages");
  messagesEl.scrollTop = messagesEl.scrollHeight;
  document.getElementById("aiInput").focus();
}

function closeAI(event) {
  if (event && event.target !== document.getElementById("aiModalOverlay")) return;
  document.getElementById("aiModalOverlay").hidden = true;
}

function clearChat() {
  chatHistory  = [];
  chatRendered = true;
  localStorage.removeItem(getChatKey());
  document.getElementById("aiMessages").innerHTML = `
    <div class="ai-message ai-message--bot">
      <div class="ai-bubble-wrap">
        <div class="ai-bubble">Hi! I'm your JobTrace AI advisor. I can see your application stats and give you personalized career advice. What would you like help with?</div>
      </div>
    </div>`;
}

// ── Send ──
function sendSuggestion(btn) {
  document.getElementById("aiInput").value = btn.textContent;
  sendAIMessage(new Event("submit"));
}

async function sendAIMessage(e) {
  e.preventDefault();
  const input   = document.getElementById("aiInput");
  const message = input.value.trim();
  if (!message) return;

  input.value = "";
  chatHistory.push({ role: "user", content: message });
  appendAIMessage(message, "user");
  const typingEl = appendTypingIndicator();

  const sendBtn = document.getElementById("aiSendBtn");
  sendBtn.disabled = true;
  sendBtn.querySelector(".btn-text").hidden    = true;
  sendBtn.querySelector(".btn-spinner").hidden = false;

  try {
    const { reply } = await Jobs.getAIAdvice(chatHistory);
    typingEl.remove();
    chatHistory.push({ role: "assistant", content: reply });
    saveChatHistory();
    appendAIMessage(reply, "bot");
  } catch {
    typingEl.remove();
    chatHistory.pop(); // remove the user message that failed
    appendAIMessage("Sorry, I couldn't get a response. Please try again.", "bot");
  } finally {
    sendBtn.disabled = false;
    sendBtn.querySelector(".btn-text").hidden    = false;
    sendBtn.querySelector(".btn-spinner").hidden = true;
    input.focus();
  }
}

// ── Render message ──
function appendAIMessage(text, role, animate = true) {
  const messagesEl = document.getElementById("aiMessages");
  const div = document.createElement("div");
  div.className = `ai-message ai-message--${role}${animate ? "" : " no-anim"}`;

  if (role === "bot") {
    div.innerHTML = `
      <div class="ai-bubble-wrap">
        <div class="ai-bubble">${renderMarkdown(text)}</div>
        <button class="ai-copy-btn" aria-label="Copy response" title="Copy response">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>`;
    div.querySelector(".ai-copy-btn").addEventListener("click", () => copyAIMessage(div.querySelector(".ai-copy-btn"), text));
  } else {
    div.innerHTML = `<div class="ai-bubble">${escapeHTML(text)}</div>`;
  }

  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

function appendTypingIndicator() {
  const messagesEl = document.getElementById("aiMessages");
  const div = document.createElement("div");
  div.className = "ai-message ai-message--bot";
  div.innerHTML = `<div class="ai-bubble-wrap"><div class="ai-bubble ai-typing-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>`;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// ── Copy ──
function copyAIMessage(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.classList.add("ai-copy-btn--done");
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("ai-copy-btn--done");
    }, 1500);
  });
}

// ════════════════════════════════════════
// STATUS QUICK-CHANGE
// ════════════════════════════════════════
const STATUS_CYCLE = ["Applied", "Interview", "Offer", "Rejected"];

async function cycleStatus(btn, id) {
  if (btn.disabled) return;
  const current = STATUS_CYCLE.find((s) => btn.classList.contains(`badge-${s.toLowerCase()}`));
  if (!current) return;
  const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
  const card = btn.closest(".job-card");

  btn.disabled = true;
  btn.textContent = "…";

  try {
    await Jobs.update(id, { status: next });
    btn.className   = `badge badge-${next.toLowerCase()} badge-clickable`;
    btn.textContent = next;
    STATUS_CYCLE.forEach((s) => card.classList.remove(`status-${s.toLowerCase()}`));
    card.classList.add(`status-${next.toLowerCase()}`);
    if (next === "Offer") launchConfetti();
    loadStats();
  } catch {
    btn.className   = `badge badge-${current.toLowerCase()} badge-clickable`;
    btn.textContent = current;
    showToast("Failed to update status", "error");
  } finally {
    btn.disabled = false;
  }
}

// ════════════════════════════════════════
// ACTIVITY HEATMAP
// ════════════════════════════════════════
async function loadHeatmap() {
  try {
    const { jobs } = await Jobs.getAll({ status: "All", search: "", sort: "newest" });
    renderHeatmap(jobs);
  } catch { /* silent */ }
}

function renderHeatmap(jobs) {
  const section = document.getElementById("heatmapSection");
  section.hidden = false;

  const counts = {};
  jobs.forEach((j) => {
    const raw = new Date(j.dateApplied);
    const d = `${raw.getFullYear()}-${String(raw.getMonth()+1).padStart(2,'0')}-${String(raw.getDate()).padStart(2,'0')}`;
    counts[d] = (counts[d] || 0) + 1;
  });

  const WEEKS = 16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Pin the last column to the CURRENT week so today is always visible.
  // Find this week's Monday, then go back (WEEKS-1) weeks for the grid start.
  const todayDow = today.getDay();
  const currentMonday = new Date(today);
  currentMonday.setDate(today.getDate() - (todayDow === 0 ? 6 : todayDow - 1));
  const start = new Date(currentMonday);
  start.setDate(currentMonday.getDate() - (WEEKS - 1) * 7);

  const grid     = document.getElementById("heatmapGrid");
  const monthsEl = document.getElementById("heatmapMonths");
  grid.innerHTML = monthsEl.innerHTML = "";

  let totalInRange = 0;
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 0; w < WEEKS; w++) {
    const col = document.createElement("div");
    col.className = "hm-col";

    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const cell = document.createElement("div");

      if (date > today) {
        cell.className = "hm-cell level-future";
        col.appendChild(cell);
        continue;
      }

      const ds    = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      const count = counts[ds] || 0;
      totalInRange += count;

      const level = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4;
      cell.className = `hm-cell level-${level}`;
      cell.title = count > 0
        ? `${count} application${count > 1 ? "s" : ""} — ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

      if (d === 0) {
        const m = date.getMonth();
        if (m !== lastMonth) {
          monthLabels.push({ col: w, name: date.toLocaleDateString("en-GB", { month: "short" }) });
          lastMonth = m;
        }
      }
      col.appendChild(cell);
    }
    grid.appendChild(col);
  }

  monthLabels.forEach(({ col, name }) => {
    const label = document.createElement("span");
    label.className = "hm-month-label";
    label.textContent = name;
    label.style.gridColumn = `${col + 1}`;
    monthsEl.appendChild(label);
  });

  const sub = document.getElementById("heatmapSub");
  if (sub) sub.textContent = `${totalInRange} application${totalInRange !== 1 ? "s" : ""} in the last ${WEEKS} weeks`;
}

// ════════════════════════════════════════
// ONBOARDING TOUR
// ════════════════════════════════════════
const TOUR_KEY = "jobtrace_onboarded";
const getTourKey = () => { const u = getUser(); const id = u?.id || u?._id; return id ? `${TOUR_KEY}_${id}` : TOUR_KEY; };
const TOUR_STEPS = [
  {
    target: "addJobBtn",
    title: "Track a New Job",
    text: "Click here to add an application — company, role, date, status and personal notes.",
  },
  {
    target: "statsGrid",
    title: "Your Progress at a Glance",
    text: "Stats update live as you add and update applications. Watch your pipeline fill up!",
  },
  {
    target: "aiAdvisorBtn",
    title: "AI Career Advisor",
    text: "Get personalised, data-driven tips from Claude AI based on your real application stats.",
  },
];

let tourStep = 0;

function maybeStartTour() {
  if (!localStorage.getItem(getTourKey())) setTimeout(startTour, 900);
}

function startTour() {
  tourStep = 0;
  document.getElementById("tourOverlay").hidden = false;
  showTourStep(0);
}

function showTourStep(n) {
  const step   = TOUR_STEPS[n];
  const target = document.getElementById(step.target);
  if (!target) { endTour(); return; }

  document.querySelectorAll(".tour-highlight").forEach((el) => el.classList.remove("tour-highlight"));
  target.classList.add("tour-highlight");
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  document.getElementById("tourTitle").textContent   = step.title;
  document.getElementById("tourText").textContent    = step.text;
  document.getElementById("tourStepNum").textContent = `${n + 1} / ${TOUR_STEPS.length}`;
  document.getElementById("tourPrevBtn").hidden      = n === 0;
  document.getElementById("tourNextBtn").textContent = n === TOUR_STEPS.length - 1 ? "Got it! 🎉" : "Next →";

  const tooltip = document.getElementById("tourTooltip");
  tooltip.hidden = false;

  requestAnimationFrame(() => {
    const rect   = target.getBoundingClientRect();
    const tw     = tooltip.offsetWidth  || 280;
    const th     = tooltip.offsetHeight || 160;
    const MARGIN = 14;
    let top  = rect.bottom + MARGIN;
    let left = rect.left;
    if (top + th > window.innerHeight - MARGIN) top = rect.top - th - MARGIN;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - tw - MARGIN));
    tooltip.style.top  = `${Math.max(MARGIN, top)}px`;
    tooltip.style.left = `${left}px`;
  });
}

function tourNext() {
  tourStep < TOUR_STEPS.length - 1 ? showTourStep(++tourStep) : endTour();
}

function tourPrev() {
  if (tourStep > 0) showTourStep(--tourStep);
}

function endTour() {
  localStorage.setItem(getTourKey(), "1");
  document.getElementById("tourOverlay").hidden  = true;
  document.getElementById("tourTooltip").hidden  = true;
  document.querySelectorAll(".tour-highlight").forEach((el) => el.classList.remove("tour-highlight"));
}

// ════════════════════════════════════════
// TOAST NOTIFICATIONS
// ════════════════════════════════════════
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icon = type === "success" ? "✓" : "✕";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3200);
}

// ════════════════════════════════════════
// CONFETTI  (fires when status = Offer)
// ════════════════════════════════════════
function launchConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors  = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899", "#14b8a6"];
  const pieces  = Array.from({ length: 140 }, () => ({
    x:     Math.random() * canvas.width,
    y:     -20 - Math.random() * 100,
    w:     Math.random() * 10 + 6,
    h:     Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: Math.random() * 3.5 + 1.5,
    angle: Math.random() * 360,
    spin:  Math.random() * 8 - 4,
    drift: Math.random() * 2 - 1,
  }));

  let frame;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach((p) => {
      p.y     += p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
      if (p.y < canvas.height) alive = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.angle * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive) {
      frame = requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };
  frame = requestAnimationFrame(animate);
  setTimeout(() => { cancelAnimationFrame(frame); canvas.remove(); }, 4500);
}

// ════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════
document.addEventListener("keydown", (e) => {
  const tag     = document.activeElement?.tagName;
  const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

  if (e.key === "Escape") {
    if (!document.getElementById("jobModalOverlay").hidden)    { closeJobModal();    return; }
    if (!document.getElementById("deleteModalOverlay").hidden) { closeDeleteModal(); return; }
    if (!document.getElementById("aiModalOverlay").hidden)     { closeAI();          return; }
    if (!document.getElementById("tourOverlay").hidden)        { endTour();          return; }
    return;
  }

  if (inInput) return;

  if      (e.key === "n" || e.key === "N") { e.preventDefault(); openJobModal(); }
  else if (e.key === "/")                  { e.preventDefault(); document.getElementById("searchInput").focus(); }
});

// ════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════
function logout() {
  clearAuth();
  navigateTo("index.html");
}

// ════════════════════════════════════════
// MOTIVATIONAL QUOTE
// ════════════════════════════════════════
function showQuote() {
  const q   = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  const el  = document.getElementById("quoteBanner");
  el.innerHTML = `
    <span class="quote-mark">"</span>
    <span class="quote-text">${q.text}</span>
    <span class="quote-author">— ${q.author}</span>
  `;
}

// ════════════════════════════════════════
// STREAK COUNTER
// ════════════════════════════════════════
function showStreak(jobs) {
  const now    = new Date();
  const day    = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const count = jobs.filter((j) => new Date(j.dateApplied) >= monday).length;
  const el    = document.getElementById("streakBadge");

  if (count === 0) { el.hidden = true; return; }

  const flames = count >= 10 ? "🔥🔥🔥" : count >= 5 ? "🔥🔥" : "🔥";
  el.textContent = `${count} application${count > 1 ? "s" : ""} this week ${flames}`;
  el.hidden = false;
}

// ════════════════════════════════════════
// PROGRESS PIPELINE
// ════════════════════════════════════════
function buildPipeline(status) {
  if (status === "Rejected") {
    return `<div class="job-pipeline"><span class="pipe-rejected">✕ Rejected</span></div>`;
  }

  const steps   = ["Applied", "Interview", "Offer"];
  const current = steps.indexOf(status);

  const html = steps.map((step, i) => {
    const done   = i < current;
    const active = i === current;
    const cls    = done ? "done" : active ? "active" : "";
    const line   = i < steps.length - 1
      ? `<div class="pipe-line ${done ? "done" : ""}"></div>`
      : "";
    return `
      <div class="pipe-step ${cls}">
        <div class="pipe-dot"></div>
        <span>${step}</span>
      </div>${line}`;
  }).join("");

  return `<div class="job-pipeline">${html}</div>`;
}

// ════════════════════════════════════════
// UTILS
// ════════════════════════════════════════
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAlert(id, message, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `alert show alert-${type}`;
}
function hideAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "alert";
  el.textContent = "";
}
