// Keep the legacy Vercel function path routed through the canonical Express API.
// The active /api/ai/budget-items handler lives in server.ts and shares Firebase
// auth, role checks, rate limits, model fallback, validation, and audit logging.
import app from "../../server.ts";

export default app;
