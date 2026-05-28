import axios from "axios";

export const studentApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  withCredentials: false,
});

// Attach student access token (stored separately from admin token)
studentApi.interceptors.request.use((config) => {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("cadb_student_access_token")
    : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401: refresh student token or redirect to student login
studentApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("cadb_student_refresh_token");
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/v1/student/auth/refresh`,
          { refreshToken }
        );
        const newToken = data.data.accessToken;
        localStorage.setItem("cadb_student_access_token", newToken);
        original.headers.Authorization = `Bearer ${newToken}`;
        return studentApi(original);
      } catch {
        localStorage.removeItem("cadb_student_access_token");
        localStorage.removeItem("cadb_student_refresh_token");
        if (typeof window !== "undefined") window.location.href = "/student/login";
      }
    }
    return Promise.reject(error);
  }
);
