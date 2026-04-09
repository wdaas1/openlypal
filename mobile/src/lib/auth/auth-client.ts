import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "vibecode_auth_token";

// Platform-safe token storage
const tokenStorage = {
  get: (): string | null => {
    if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY);
    try {
      return SecureStore.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    if (Platform.OS === "web") localStorage.setItem(TOKEN_KEY, token);
    else SecureStore.setItem(TOKEN_KEY, token);
  },
  delete: () => {
    if (Platform.OS === "web") localStorage.removeItem(TOKEN_KEY);
    else SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

/** Returns the Authorization header value for use in raw fetch calls */
export const getAuthToken = (): string | null => tokenStorage.get();

// Custom plugin: reads set-auth-token from responses, sends it as Bearer on requests.
// This works on iOS where Set-Cookie headers are intercepted by the native layer.
const bearerTokenPlugin = () => ({
  id: "bearer-token-manager",
  fetchPlugins: [
    {
      id: "bearer-token-manager",
      name: "Bearer Token Manager",
      hooks: {
        async onSuccess(context: any) {
          // Persist the session token exposed by the server's bearer plugin
          const token = context.response.headers.get("set-auth-token");
          if (token) tokenStorage.set(token);
          // Clear token on sign-out
          if (context.request?.url?.toString().includes("/sign-out")) {
            tokenStorage.delete();
          }
        },
      },
      async init(url: string, options: any) {
        options = options ?? {};
        if (Platform.OS !== "web") {
          // Prevent iOS native cookie jar from interfering
          options.credentials = "omit";
          // Let server's expo() plugin trust native requests
          options.headers = {
            ...options.headers,
            "expo-origin": "openly://",
          };
        }
        // Attach stored Bearer token to every request
        const token = tokenStorage.get();
        if (token) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          };
        }
        return { url, options };
      },
    },
  ],
});

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_BACKEND_URL! as string,
  plugins: [bearerTokenPlugin()],
});

/** Stores an externally provided auth token (e.g. from email verification deep link) */
export const setAuthToken = (token: string) => tokenStorage.set(token);
