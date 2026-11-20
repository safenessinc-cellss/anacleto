import compareBomHandler from "./compare-bom.js";
import generateBomHandler from "./generate-bom.js";
import marketResearchHandler from "./market-research.js";
import technicalOptionsHandler from "./technical-options.js";

/**
 * Consolidated supplier API routes.
 * Keeps the public HTTP paths stable while using one Vercel Serverless Function
 * for the technical BOM, market research and supplier comparison endpoints.
 */
const handlers: Record<string, (req: any, res: any) => unknown> = {
  "compare-bom": compareBomHandler,
  "generate-bom": generateBomHandler,
  "market-research": marketResearchHandler,
  "technical-options": technicalOptionsHandler,
};

export default async function handler(req: any, res: any) {
  const rawPath = req.query?.path;
  const segments = Array.isArray(rawPath)
    ? rawPath.map(String)
    : String(rawPath || "").split("/").filter(Boolean);
  const route = segments[segments.length - 1] || "";
  const selected = handlers[route];

  if (!selected) {
    res.setHeader("Allow", "GET, POST");
    return res.status(404).json({ error: "Rota de fornecedor não encontrada." });
  }

  return selected(req, res);
}
