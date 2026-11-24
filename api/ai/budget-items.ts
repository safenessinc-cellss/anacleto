// Keep this legacy Vercel function path on the canonical Express API.
// Budget generation is implemented once in server.ts and shares Firebase auth,
// role policies, rate limits, provider fallback, JSON validation and AI auditing.
export { default } from "../index.ts";
