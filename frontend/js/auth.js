// Redirect to dashboard if already logged in
if (getToken()) navigateTo("dashboard.html");

// ── Smooth navigation ──
function navigateTo(url) {
  document.body.classList.add("fade-out");
  setTimeout(() => { window.location.href = url; }, 250);
}

// ── Tab switching ──
function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("loginTab").classList.toggle("active", isLogin);
  document.getElementById("registerTab").classList.toggle("active", !isLogin);
  document.getElementById("loginForm").classList.toggle("hidden", !isLogin);
  document.getElementById("registerForm").classList.toggle("hidden", isLogin);
  document.getElementById("formHeading").textContent      = isLogin ? "Welcome back" : "Create your account";
  document.getElementById("formSubheading").textContent   = isLogin ? "Sign in to your account to continue" : "Start tracking your job applications today";
  hideAlert("authAlert");
  clearAllFieldErrors();
}

// ── Password visibility toggle ──
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.querySelector(".eye-icon").style.opacity = isHidden ? "0.4" : "1";
}

// ── Alert helpers ──
function showAlert(id, message, type = "error") {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `alert show alert-${type}`;
}
function hideAlert(id) {
  const el = document.getElementById(id);
  el.className = "alert";
  el.textContent = "";
}

// ── Field error helpers ──
function showFieldError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
  const input = document.getElementById(id.replace("Error", ""));
  if (input) input.classList.add("input-error");
}
function clearFieldError(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
  const input = document.getElementById(id.replace("Error", ""));
  if (input) input.classList.remove("input-error");
}
function clearAllFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
  document.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
}

// ── Button loading state ──
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.querySelector(".btn-text").hidden    = loading;
  btn.querySelector(".btn-spinner").hidden = !loading;
}

// ── Password strength ──
function updateStrength(password) {
  const bar   = document.getElementById("passwordStrength");
  const fill  = document.getElementById("strengthFill");
  const label = document.getElementById("strengthLabel");
  if (!password) { bar.hidden = true; return; }
  bar.hidden = false;
  let score = 0;
  if (password.length >= 8)          score++;
  if (/[A-Z]/.test(password))        score++;
  if (/[0-9]/.test(password))        score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const levels = [
    { pct: "25%", color: "#ef4444", text: "Weak" },
    { pct: "50%", color: "#f59e0b", text: "Fair" },
    { pct: "75%", color: "#3b82f6", text: "Good" },
    { pct: "100%",color: "#22c55e", text: "Strong" },
  ];
  const lvl = levels[Math.min(score, 3)];
  fill.style.width      = lvl.pct;
  fill.style.background = lvl.color;
  label.textContent     = lvl.text;
  label.style.color     = lvl.color;
}

// ── Blur validation ──
document.getElementById("loginEmail").addEventListener("blur", (e) => {
  const v = e.target.value.trim();
  if (!v) showFieldError("loginEmailError", "Email is required");
  else if (!/^\S+@\S+\.\S+$/.test(v)) showFieldError("loginEmailError", "Enter a valid email");
  else clearFieldError("loginEmailError");
});
document.getElementById("loginPassword").addEventListener("blur", (e) => {
  if (!e.target.value) showFieldError("loginPasswordError", "Password is required");
  else clearFieldError("loginPasswordError");
});
document.getElementById("registerName").addEventListener("blur", (e) => {
  if (!e.target.value.trim()) showFieldError("registerNameError", "Name is required");
  else clearFieldError("registerNameError");
});
document.getElementById("registerEmail").addEventListener("blur", (e) => {
  const v = e.target.value.trim();
  if (!v) showFieldError("registerEmailError", "Email is required");
  else if (!/^\S+@\S+\.\S+$/.test(v)) showFieldError("registerEmailError", "Enter a valid email");
  else clearFieldError("registerEmailError");
});
document.getElementById("registerPassword").addEventListener("input", (e) => {
  updateStrength(e.target.value);
});
document.getElementById("registerPassword").addEventListener("blur", (e) => {
  const v = e.target.value;
  if (!v) showFieldError("registerPasswordError", "Password is required");
  else if (v.length < 6) showFieldError("registerPasswordError", "Password must be at least 6 characters");
  else clearFieldError("registerPasswordError");
});
document.getElementById("registerConfirm").addEventListener("blur", (e) => {
  const pw = document.getElementById("registerPassword").value;
  if (!e.target.value) showFieldError("registerConfirmError", "Please confirm your password");
  else if (e.target.value !== pw) showFieldError("registerConfirmError", "Passwords do not match");
  else clearFieldError("registerConfirmError");
});

// ── Login ──
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAllFieldErrors();
  hideAlert("authAlert");

  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  let valid = true;
  if (!email)    { showFieldError("loginEmailError", "Email is required"); valid = false; }
  else if (!/^\S+@\S+\.\S+$/.test(email)) { showFieldError("loginEmailError", "Enter a valid email"); valid = false; }
  if (!password) { showFieldError("loginPasswordError", "Password is required"); valid = false; }
  if (!valid) return;

  setLoading("loginBtn", true);
  try {
    const data = await Auth.login(email, password);
    setToken(data.token);
    setUser(data.user);
    navigateTo("dashboard.html");
  } catch (err) {
    showAlert("authAlert", err.message);
  } finally {
    setLoading("loginBtn", false);
  }
});

// ── Register ──
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAllFieldErrors();
  hideAlert("authAlert");

  const name     = document.getElementById("registerName").value.trim();
  const email    = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirm  = document.getElementById("registerConfirm").value;

  let valid = true;
  if (!name)  { showFieldError("registerNameError", "Name is required"); valid = false; }
  if (!email) { showFieldError("registerEmailError", "Email is required"); valid = false; }
  else if (!/^\S+@\S+\.\S+$/.test(email)) { showFieldError("registerEmailError", "Enter a valid email"); valid = false; }
  if (!password)              { showFieldError("registerPasswordError", "Password is required"); valid = false; }
  else if (password.length < 6) { showFieldError("registerPasswordError", "Password must be at least 6 characters"); valid = false; }
  if (password !== confirm)   { showFieldError("registerConfirmError", "Passwords do not match"); valid = false; }
  if (!valid) return;

  setLoading("registerBtn", true);
  try {
    const data = await Auth.register(name, email, password);
    setToken(data.token);
    setUser(data.user);
    navigateTo("dashboard.html");
  } catch (err) {
    showAlert("authAlert", err.message);
  } finally {
    setLoading("registerBtn", false);
  }
});
