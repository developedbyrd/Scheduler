export const config = {
  apiUrl: import.meta.env.VITE_API_BASE_URL,
};

export const ENDPOINTS = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
    logout: "/api/v1/auth/logout",
    refresh: "/api/v1/auth/refresh",
  },
  accounts: {
    base: "/api/v1/accounts",
    oauthUrl: (platform: string) => `/api/v1/oauth/${platform}/url`,
    oauthSync: "/api/v1/oauth/sync",
    disconnect: (id: string) => `/api/v1/accounts/${id}`,
  },
  posts: {
    base: "/api/v1/posts",
    generate: "/api/v1/posts/generate",
    generations: "/api/v1/posts/generations",
  },
  activity: {
    base: "/api/v1/activity",
  },
};
