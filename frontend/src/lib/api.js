import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("jansetu_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Builds an authenticated URL for <img>/<a> tags, which cannot set Authorization headers.
// Token is appended as ?t= query param; backend's flexible auth accepts either source.
export const fileUrl = (path) => {
  if (!path) return "";
  const token = localStorage.getItem("jansetu_token");
  return `${API}/files/${path}${token ? `?t=${encodeURIComponent(token)}` : ""}`;
};
