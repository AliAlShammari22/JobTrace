// ── Auth guard ──
if (!getToken()) navigateTo("index.html");

// ── Smooth navigation ──
function navigateTo(url) {
  document.body.classList.add("fade-out");
  setTimeout(() => { window.location.href = url; }, 250);
}

// ── State ──
let jobToDeleteId = null;
let debounceTimer = null;
let currentView   = localStorage.getItem("jobtrace_view") || "list";

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
  document.getElementById("dateApplied").valueAsDate = new Date();
});

// ════════════════════════════════════════
// STATS  (with animated counters)
// ════════════════════════════════════════
async function loadStats() {
  try {
    const { stats } = await Jobs.getStats();
    animateCounter(document.getElementById("statTotal"),     stats.total);
    animateCounter(document.getElementById("statApplied"),   stats.Applied);
    animateCounter(document.getElementById("statInterview"), stats.Interview);
    animateCounter(document.getElementById("statOffer"),     stats.Offer);
    animateCounter(document.getElementById("statRejected"),  stats.Rejected);
  } catch {
    // silent
  }
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

  list.hidden  = false;
  board.hidden = true;
  loading.hidden = false;
  empty.hidden   = true;
  list.querySelectorAll(".job-card").forEach((el) => el.remove());

  try {
    const { jobs } = await Jobs.getAll(getFilters());
    loading.hidden = true;

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
    loading.hidden = true;
    showToast(err.message, "error");
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

const AVATAR_COLORS = [
  "#6366f1","#3b82f6","#0ea5e9","#14b8a6",
  "#22c55e","#f59e0b","#ef4444","#ec4899","#8b5cf6","#f97316",
];
function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function createJobCard(job) {
  const card = document.createElement("div");
  card.className = `job-card status-${job.status.toLowerCase()}`;
  card.dataset.id = job._id;

  const date = new Date(job.dateApplied).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
  const notesText = job.notes ? escapeHTML(job.notes) : "";

  card.innerHTML = `
    <div class="card-accent"></div>
    <div class="card-body">
      <div class="card-header">
        <div class="company-info">
          <div class="card-titles">
            <div class="job-company">${escapeHTML(job.companyName)}</div>
            <div class="job-title">${escapeHTML(job.jobTitle)}</div>
          </div>
        </div>
        <div class="card-top-right">
          <span class="badge badge-${job.status.toLowerCase()}">${job.status}</span>
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
        <div class="card-notes-inner">
          ${notesText
            ? `<p class="card-notes-text">${notesText}</p>`
            : `<p class="card-notes-empty">No notes added yet. Click edit to add some.</p>`
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

  return card;
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
    await Promise.all([loadJobs(), loadStats()]);
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
  document.getElementById("deleteJobName").textContent = companyName;
  document.getElementById("deleteModalOverlay").hidden = false;
}

function closeDeleteModal(event) {
  if (event && event.target !== document.getElementById("deleteModalOverlay")) return;
  document.getElementById("deleteModalOverlay").hidden = true;
  jobToDeleteId = null;
}

async function confirmDelete() {
  if (!jobToDeleteId) return;
  const btn     = document.getElementById("confirmDeleteBtn");
  const text    = btn.querySelector(".btn-text");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled  = true;
  text.hidden   = true;
  spinner.hidden = false;

  try {
    await Jobs.delete(jobToDeleteId);
    document.getElementById("deleteModalOverlay").hidden = true;
    showToast("Application deleted.", "success");
    jobToDeleteId = null;
    await Promise.all([loadJobs(), loadStats()]);
  } catch (err) {
    showToast(err.message, "error");
    document.getElementById("deleteModalOverlay").hidden = true;
  } finally {
    btn.disabled   = false;
    text.hidden    = false;
    spinner.hidden = true;
  }
}

// ════════════════════════════════════════
// AI ADVISOR
// ════════════════════════════════════════
function openAI() {
  document.getElementById("aiModalOverlay").hidden = false;
  document.getElementById("aiInput").focus();
}

function closeAI(event) {
  if (event && event.target !== document.getElementById("aiModalOverlay")) return;
  document.getElementById("aiModalOverlay").hidden = true;
}

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
  appendAIMessage(message, "user");
  const typingEl = appendTypingIndicator();

  const sendBtn = document.getElementById("aiSendBtn");
  sendBtn.disabled = true;
  sendBtn.querySelector(".btn-text").hidden    = true;
  sendBtn.querySelector(".btn-spinner").hidden = false;

  try {
    const { reply } = await Jobs.getAIAdvice(message);
    typingEl.remove();
    appendAIMessage(reply, "bot");
  } catch {
    typingEl.remove();
    appendAIMessage("Sorry, I couldn't get a response. Please try again.", "bot");
  } finally {
    sendBtn.disabled = false;
    sendBtn.querySelector(".btn-text").hidden    = false;
    sendBtn.querySelector(".btn-spinner").hidden = true;
    input.focus();
  }
}

function appendAIMessage(text, role) {
  const messages = document.getElementById("aiMessages");
  const div = document.createElement("div");
  div.className = `ai-message ai-message--${role}`;
  div.innerHTML = `<div class="ai-bubble">${escapeHTML(text)}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function appendTypingIndicator() {
  const messages = document.getElementById("aiMessages");
  const div = document.createElement("div");
  div.className = "ai-message ai-message--bot ai-typing";
  div.innerHTML = `<div class="ai-bubble">Thinking…</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
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
