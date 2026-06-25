import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("jansetu_token");
  if (token) {
    if (cfg.headers && typeof cfg.headers.set === "function") {
      cfg.headers.set("Authorization", `Bearer ${token}`);
    } else {
      cfg.headers = cfg.headers || {};
      cfg.headers.Authorization = `Bearer ${token}`;
    }
  }
  // For FormData, let axios/browser set Content-Type (with the multipart boundary).
  // Strip any caller-provided "multipart/form-data" header so the boundary isn't lost.
  if (cfg.data && typeof FormData !== "undefined" && cfg.data instanceof FormData) {
    try {
      if (cfg.headers && typeof cfg.headers.delete === "function") {
        const ct = cfg.headers.get && cfg.headers.get("Content-Type");
        if (ct && String(ct).toLowerCase().startsWith("multipart/form-data")) {
          cfg.headers.delete("Content-Type");
        }
      } else if (cfg.headers && cfg.headers["Content-Type"]) {
        const ct = String(cfg.headers["Content-Type"]).toLowerCase();
        if (ct.startsWith("multipart/form-data")) {
          delete cfg.headers["Content-Type"];
        }
      }
    } catch (_) { /* noop */ }
  }
  return cfg;
});

// On 401 from a stale/expired token, clear it and bounce to home so the user
// can sign in cleanly instead of being stuck in a half-authenticated UI.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail || "";
    if (status === 401 && /missing token|invalid token|user not found/i.test(detail)) {
      if (localStorage.getItem("jansetu_token")) {
        localStorage.removeItem("jansetu_token");
        // Avoid redirect loops on public pages.
        const onPublic = /^\/(citizen\/(login|register)|staff\/login|portal|)$/.test(window.location.pathname);
        if (!onPublic) {
          window.location.assign("/staff/login");
        }
      }
    }
    return Promise.reject(err);
  },
);

// Builds an authenticated URL for <img>/<a> tags, which cannot set Authorization headers.
// Token is appended as ?t= query param; backend's flexible auth accepts either source.
export const fileUrl = (path) => {
  if (!path) return "";
  const token = localStorage.getItem("jansetu_token");
  return `${API}/files/${path}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
};
