import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "/api/v1" : "http://localhost:4000/api/v1"),
  withCredentials: true,
  headers: { "content-type": "application/json" }
});

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data;
    if (status === 429) return "Too many attempts. Please wait a few minutes before trying again.";
    if (!error.response) return "The API could not be reached. Start the server and check VITE_API_URL if you configured a custom API address.";
    if (typeof body === "string") {
      if (/too many requests/i.test(body)) return "Too many attempts. Please wait a few minutes before trying again.";
      if (/^\s*</.test(body)) return "The API returned a web page instead of JSON. Check VITE_API_URL in the client configuration.";
      if (body.trim()) return body.trim().slice(0, 240);
    }
    return body?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
