import axios from "axios";
import { useAuthStore } from "@/store/auth";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("cadb_access_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("cadb_refresh_token");
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
          { refreshToken }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem("cadb_access_token", newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        // Sync any changed fields (e.g. role) into the auth store
        if (data.data.employee) {
          useAuthStore.getState().updateUser(data.data.employee);
        }
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);
