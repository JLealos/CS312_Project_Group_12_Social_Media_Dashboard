const API_URL = "http://localhost:3000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}

export function login(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

export function register(name, email, password) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  });
}

export function logout() {
  return request("/auth/logout", {
    method: "POST"
  });
}

export function getCurrentUser() {
  return request("/auth/me");
}