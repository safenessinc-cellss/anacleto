import app from "../server.ts";

export default app;

// The AI budget route shares this Express function and needs room for provider fallback.
export const config = { maxDuration: 60 };
