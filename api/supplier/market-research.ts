import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

const OWNER_EMAIL = "safeness.c.a@gmail.com";
const windows = new Map<string, { startedAt: number; count: number }>();
const decode = (value: string) => value
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ").trim();
const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
};
const domainOf = (value: string) => {
  try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return ""; }
};

/** Parses only explicit BRL values in search-result text; it does not infer prices from unrelated numbers. */
function extractBrlPrices(value: string): number[] {
  const matches = value.match(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s?\d+(?:,\d{2})?/gi) || [];
  return matches.map(match => Number(match.replace(/R\$\s?/i, "").replace(/\./g, "").replace(",", ".")))
    .filter(price => Number.isFinite(price) && price > 0);
}

async function search(query: string) {
  const response = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; AnacletoMarketResearch/1.0)", "Accept": "text/html" },
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error("Busca externa indisponível.");
  const html = await response.text();
  return html.split(/<div class="result[^"]*"[^>]*>/i).slice(1, 7).flatMap(block => {
    const link = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!link) return [];
    let url = decode(link[1]);
    if (url.startsWith("//")) url = "https:" + url;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("duckduckgo.com") && parsed.searchParams.has("uddg")) {
        url = decodeURIComponent(parsed.searchParams.get("uddg") || url);
      }
    } catch { return []; }
    url = safeUrl(url);
    if (!url) return [];
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|td|div)>/i);
    const title = decode(link[2]).slice(0, 180);
    const snippet = snippetMatch ? decode(snippetMatch[1]).slice(0, 500) : "";
    const priceTexts = [title, snippet].join(" ");
    const prices = extractBrlPrices(priceTexts);
    return [{
      title, url, domain: domainOf(url), snippet, prices,
      priceStatus: prices.length ? "candidate_from_search_snippet" : "not_found",
      verification: "unverified",
      observedAt: new Date().toISOString()
    }];
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });
    if (!apiKey) return res.status(503).json({ error: "Configuração Firebase ausente no servidor." });
    const authResponse = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + apiKey, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(10000)
    });
    if (!authResponse.ok) return res.status(401).json({ error: "Sessão inválida ou expirada." });
    const identity: any = await authResponse.json();
    const user = identity.users?.[0];
    if (!user?.localId || !user?.email) return res.status(401).json({ error: "Usuário não autenticado." });
    if (String(user.email).toLowerCase() !== OWNER_EMAIL) {
      const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
      const roleUrl = "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId +
        "/databases/" + databaseId + "/documents/admins/" + encodeURIComponent(String(user.email).toLowerCase());
      const roleResponse = await fetch(roleUrl, { headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(10000) });
      if (!roleResponse.ok) return res.status(403).json({ error: "Acesso pendente de aprovação ou perfil não autorizado." });
      const roleDoc: any = await roleResponse.json();
      const role = String(roleDoc.fields?.role?.stringValue || "");
      if (!["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador"].includes(role)) {
        return res.status(403).json({ error: "Seu perfil não tem autorização para pesquisar preços." });
      }
    }

    const now = Date.now();
    const entry = windows.get(user.localId);
    if (!entry || now - entry.startedAt >= 60000) windows.set(user.localId, { startedAt: now, count: 1 });
    else if (entry.count >= 5) return res.status(429).json({ error: "Limite de pesquisas atingido. Aguarde um minuto." });
    else entry.count++;

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const items = Array.isArray(body?.items) ? body.items.slice(0, 12) : [];
    const location = String(body?.location || "Sapucaia do Sul, Rio Grande do Sul").slice(0, 100);
    if (!items.length) return res.status(400).json({ error: "Informe os componentes do despiece para pesquisar." });

    const results = await Promise.all(items.map(async (raw: any) => {
      const item = {
        id: String(raw?.id || "").slice(0, 100),
        code: String(raw?.code || "").slice(0, 100),
        description: String(raw?.description || "").slice(0, 180),
        manufacturer: String(raw?.manufacturer || "").slice(0, 100),
        line: String(raw?.line || "").slice(0, 80),
        finish: String(raw?.finish || "").slice(0, 50),
        unit: String(raw?.unit || "").slice(0, 20)
      };
      if (!item.description && !item.code) return { item, offers: [], error: "Componente sem código ou descrição." };
      const searchTerm = [item.manufacturer, item.line, item.code, item.description, item.finish, location, "preço comprar"].filter(Boolean).join(" ");
      try {
        const offers = await search(searchTerm);
        return { item, searchTerm, offers: offers.slice(0, 5) };
      } catch (error: any) {
        return { item, searchTerm, offers: [], error: String(error?.message || "Falha na pesquisa.") };
      }
    }));

    return res.status(200).json({
      provider: "DuckDuckGo",
      location,
      results,
      searchedAt: new Date().toISOString(),
      reviewRequired: true,
      notice: "Preços extraídos de snippets são candidatos não verificados. Abra a fonte, confirme código, acabamento, unidade, estoque, frete e validade antes de aprovar. Resultados sem preço exigem cotação direta."
    });
  } catch (error: any) {
    console.error("ANACLETO market research failed", error);
    return res.status(502).json({ error: "Não foi possível concluir a pesquisa de mercado." });
  }
}
