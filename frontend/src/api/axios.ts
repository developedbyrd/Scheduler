import axios from "axios";
import { config as apiConfig, ENDPOINTS } from "./config";

const api = axios.create({
  baseURL: apiConfig.apiUrl,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes(ENDPOINTS.auth.login) ||
        originalRequest.url?.includes(ENDPOINTS.auth.refresh) ||
        originalRequest.url?.includes(ENDPOINTS.auth.logout)
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(
          ENDPOINTS.auth.refresh,
          {},
          {
            baseURL: apiConfig.apiUrl,
            withCredentials: true,
          },
        );

        isRefreshing = false;
        processQueue(null);

        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        window.dispatchEvent(new Event("auth-expired"));
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
