const tokenKey = "skillswap_token";
const API_BASE_URL = (import.meta.env.VITE_API_URL || "")
  .replace(/\/api\/?$/, "")
  .replace(/\/$/, "");

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
    request("/api/requests"),
  ]);
}

export function getDashboard() {
  return request("/api/dashboard");
}

export function getMatches() {
  return request("/api/matches");
}

export function discoverSkills(params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && value !== false),
  );
  return request(`/api/discover${search.toString() ? `?${search}` : ""}`).catch((error) => {
    // Older running deployments may not have the dedicated discovery route yet.
    if (error.status !== 404) throw error;
    return request("/api/skills");
  });
}

export function toggleBookmark(userId) {
  return request(`/api/bookmarks/${userId}`, { method: "PATCH" });
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

/**
 * Send a skill exchange request to the skill's owner.
 * @param {string} skill - Skill name
 * @param {string} skillId - Skill document id
 * @param {string} toUserId - The owner's user id
 * @param {string} type - "Learn" or "Exchange"
 * @param {string} message - Optional message
 */
export function createRequest(skill, skillId, toUserId, type = "Learn", message = "") {
  return request("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill, skillId, toUserId, type, message }),
  });
}

export function updateRequestStatus(requestId, status, counterProposal) {
  return request(`/api/requests/${requestId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, counterProposal }),
  });
}

export function getConnections() {
  return request("/api/connections");
}

export function getNotifications() {
  return request("/api/notifications");
}

export function getMessages(userId) {
  return request(`/api/messages/${userId}`);
}

export function uploadResource(file) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/resources/upload", {
    method: "POST",
    body: formData,
  });
}

export function sendMessage(userId, text, resource) {
  return request(`/api/messages/${userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, resource }),
  });
}

export function getSessions() {
  return request("/api/sessions");
}

export function createSession(session) {
  return request("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(session),
  });
}

export function updateSessionStatus(sessionId, status) {
  return request(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export function getReviews(userId) {
  return request(`/api/reviews/user/${userId}`);
}

export function createReview(sessionId, rating, comment) {
  return request("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, rating, comment }),
  });
}

export function createSkill(name, category, level, details = {}) {
  return request("/api/skills", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, category, level, ...details }),
  });
}

export function updateSkill(skillId, updates) {
  return request(`/api/skills/${skillId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
}

export function deleteSkill(skillId) {
  return request(`/api/skills/${skillId}`, { method: "DELETE" });
}

export function updateMyProfile(updates) {
  return request("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
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
