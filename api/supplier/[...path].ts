import compareBomHandler from "../../src/server/supplier-api/compare-bom.js";
import generateBomHandler from "../../src/server/supplier-api/generate-bom.js";
import marketResearchHandler from "../../src/server/supplier-api/market-research.js";
import technicalOptionsHandler from "../../src/server/supplier-api/technical-options.js";

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

  try {
    await selected(req, res);
  } catch (error: any) {
    const requestId = String(req.headers["x-vercel-id"] || req.headers["x-request-id"] || "");
    console.error("[supplier-api] unhandled handler failure", {
      route,
      method: req.method,
      requestId,
      message: String(error?.message || error),
      stack: error?.stack,
    });
    if (!res.headersSent) {
      return res.status(500).json({
        error: "Falha interna na API de fornecedores.",
        code: "SUPPLIER_API_INTERNAL_ERROR",
        route,
      });
    }
  }
}
