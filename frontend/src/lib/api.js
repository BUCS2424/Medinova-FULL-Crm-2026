import axios from "axios";

const BASE_URL = process.env.REACT_APP_BACKEND_URL || "";

export const api = axios.create({
    baseURL: `${BASE_URL}/api/v2`,
    headers: { "Content-Type": "application/json" },
});

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("dme_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export function formatApiError(detail) {
    if (!detail) return null;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
        return detail.map((e) => (e?.msg ? `${e.loc?.slice(-1)[0] || "field"}: ${e.msg}` : JSON.stringify(e))).join("; ");
    }
    if (typeof detail === "object") return detail.message || JSON.stringify(detail);
    return String(detail);
}
