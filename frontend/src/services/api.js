const tokenKey = "skillswap_token";
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function headers() {
  const token = localStorage.getItem(tokenKey);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;

  const response = await fetch(url, {
    ...options,
    headers: { ...headers(), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function loadWorkspaceData() {
  return Promise.all([
    request("/api/skills"),
    request("/api/users"),
    request("/api/requests"),
  ]);
}

export function login(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export function register(user) {
  return request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
}

export function createRequest(skill, type) {
  return request("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill, type }),
  });
}

export function createSkill(name) {
  return request("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export function getAdminSummary() {
  return request("/api/admin/summary");
}

export function saveSession({ token, user }) {
  localStorage.setItem(tokenKey, token);
  localStorage.setItem("skillswap_user", JSON.stringify(user));
}

export function loadSession() {
  const token = localStorage.getItem(tokenKey);
  const user = localStorage.getItem("skillswap_user");
  return token && user ? JSON.parse(user) : null;
}

export function clearSession() {
  localStorage.removeItem(tokenKey);
  localStorage.removeItem("skillswap_user");
}
