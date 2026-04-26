const API_BASE = "https://jobtrace-fj3z.onrender.com/api";

// ── Token helpers ──
const getToken  = ()        => localStorage.getItem("jt_token");
const setToken  = (token)   => localStorage.setItem("jt_token", token);
const setUser   = (user)    => localStorage.setItem("jt_user", JSON.stringify(user));
const getUser   = ()        => JSON.parse(localStorage.getItem("jt_user") || "null");
const clearAuth = ()        => { localStorage.removeItem("jt_token"); localStorage.removeItem("jt_user"); };

// ── Core fetch wrapper ──
const request = async (endpoint, options = {}) => {
  const token = getToken();

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await res.json();

  if (!res.ok) {
    // Session expired — force logout
    if (res.status === 401 && window.location.pathname.includes("dashboard")) {
      clearAuth();
      window.location.href = "index.html";
      return;
    }
    throw new Error(data.message || "Something went wrong");
  }

  return data;
};

// ════════════════════════════════════════
// Auth API
// ════════════════════════════════════════
const Auth = {
  register: (name, email, password) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),

  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request("/auth/me"),
};

// ════════════════════════════════════════
// Jobs API
// ════════════════════════════════════════
const Jobs = {
  getAll: ({ status = "All", search = "", sort = "newest" } = {}) => {
    const params = new URLSearchParams();
    if (status !== "All") params.set("status", status);
    if (search)           params.set("search", search);
    if (sort)             params.set("sort", sort);
    const qs = params.toString();
    return request(`/jobs${qs ? "?" + qs : ""}`);
  },

  create: (jobData) =>
    request("/jobs", {
      method: "POST",
      body: JSON.stringify(jobData),
    }),

  update: (id, jobData) =>
    request(`/jobs/${id}`, {
      method: "PUT",
      body: JSON.stringify(jobData),
    }),

  delete: (id) =>
    request(`/jobs/${id}`, { method: "DELETE" }),

  getStats: () => request("/jobs/stats"),

  getAIAdvice: (message) =>
    request("/jobs/ai-advice", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
