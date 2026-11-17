import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const serverModule = require("../dist/server.cjs");
const app = serverModule.default ?? serverModule;

/**
 * Vercel Node function adapter.
 * The build creates dist/server.cjs before function packaging so the
 * Express app and its JSON/config imports are loaded from the same artifact
 * used by the standalone Node server.
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
