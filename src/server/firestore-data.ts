import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

function decodeValue(value: any): any {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("referenceValue" in value) return value.referenceValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields || {});
  return value;
}

function decodeFields(fields: Record<string, any> = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function getToken(request: any): string {
  const authorization = String(request?.headers?.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

type CatalogCache = { key: string; expiresAt: number; rows: any[] };
let catalogCache: CatalogCache | null = null;

function collectionUrl(collection: string, pageToken?: string) {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/${collection}?pageSize=1000`;
  return pageToken ? base + "&pageToken=" + encodeURIComponent(pageToken) : base;
}

/** Load authoritative rows from every collection exposed in the quote/catalog UI. */
export async function loadCatalogFromFirestore(
  request: any,
  options: { cacheTtlMs?: number; cacheKey?: string } = {},
): Promise<any[]> {
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para consultar o catálogo oficial.");
  const cacheTtlMs = Math.max(0, Math.min(60_000, Number(options.cacheTtlMs || 0)));
  const cacheKey = String(options.cacheKey || "");
  if (cacheTtlMs > 0 && cacheKey && catalogCache?.key === cacheKey && catalogCache.expiresAt > Date.now()) {
    return catalogCache.rows.map((row) => ({ ...row }));
  }
  const collectionNames = ["catalog", "supplier_catalog", "registry_items", "price_table"];
  const collections = await Promise.all(collectionNames.map(async (collectionName) => {
    const rows: any[] = [];
    let pageToken: string | undefined;
    do {
      const response = await fetch(collectionUrl(collectionName, pageToken), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        throw new Error(`Não foi possível consultar o catálogo ${collectionName} (HTTP ${response.status}).`);
      }
      const payload = await response.json() as { documents?: any[]; nextPageToken?: string };
      for (const document of payload.documents || []) {
        const id = String(document.name || "").split("/").pop() || "";
        const data = decodeFields(document.fields || {});
        const name = String(data.name || data.description || "").trim();
        if (!name) continue;
        rows.push({
          ...data,
          id,
          name,
          sku: String(data.sku || data.code || "").trim(),
          source: collectionName,
        });
      }
      pageToken = payload.nextPageToken || undefined;
      if (rows.length > 5000) throw new Error(`O catálogo ${collectionName} excede o limite seguro de leitura.`);
    } while (pageToken);
    return rows;
  }));
  const rows = collections.flat();
  if (cacheTtlMs > 0 && cacheKey) catalogCache = { key: cacheKey, expiresAt: Date.now() + cacheTtlMs, rows };
  return rows;
}

export async function refreshCatalogMatchesFromFirestore(
  request: any,
  catalog: any[],
  generatedItems: any[],
): Promise<any[]> {
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para confirmar os preços do catálogo.");
  const allowed = new Set(["catalog", "supplier_catalog", "registry_items", "price_table"]);
  const references = new Map<string, { source: string; id: string }>();
  for (const item of Array.isArray(generatedItems) ? generatedItems.slice(0, 150) : []) {
    const id = String(item?.catalogItemId || item?.itemId || "").trim();
    const description = String(item?.description || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const candidate = catalog.find((row) =>
      (id && String(row.id || "") === id) ||
      (item?.sku && String(row.sku || row.code || "") === String(item.sku)) ||
      (description && String(row.name || row.description || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === description)
    );
    const source = String(item?.catalogSource || candidate?.source || "").trim();
    const resolvedId = id || String(candidate?.id || "");
    if (!resolvedId || resolvedId.includes("/") || !allowed.has(source)) continue;
    references.set(`${source}/${resolvedId}`, { source, id: resolvedId });
  }
  if (!references.size) return catalog;

  const database = firebaseConfig.firestoreDatabaseId || "(default)";
  const databaseId = encodeURIComponent(database);
  const endpoint = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents:batchGet`;
  const documents = Array.from(references.values()).map(({ source, id }) =>
    `projects/${firebaseConfig.projectId}/databases/${database}/documents/${source}/${id}`
  );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ documents }),
    signal: AbortSignal.timeout(7_000),
  });
  if (!response.ok) throw new Error(`Não foi possível confirmar os preços atuais do catálogo (HTTP ${response.status}).`);
  const raw = await response.text();
  const fresh = new Map<string, any>();
  for (const line of raw.split(/\r?\n/).filter(Boolean)) {
    let payload: any;
    try { payload = JSON.parse(line); } catch { continue; }
    const document = payload?.found;
    if (!document?.name) continue;
    const parts = String(document.name).split("/documents/").pop()?.split("/") || [];
    const source = parts[0] || "";
    const id = parts[1] || "";
    if (!source || !id) continue;
    const data = decodeFields(document.fields || {});
    fresh.set(`${source}/${id}`, {
      ...data,
      id,
      name: String(data.name || data.description || "").trim(),
      sku: String(data.sku || data.code || "").trim(),
      source,
    });
  }
  return catalog.map((row) => {
    const key = `${String(row.source || "")}/${String(row.id || "")}`;
    if (!references.has(key)) return row;
    const current = fresh.get(key);
    return current || { ...row, price: 0, reviewStatus: "rejected", status: "rejected", verified: false };
  });
}

export async function loadQuoteFromFirestore(request: any, quoteId: unknown): Promise<any | null> {
  const id = String(quoteId || "").trim();
  if (!id || id.length > 180 || id.includes("/")) return null;
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para consultar o orçamento salvo.");
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const documentId = encodeURIComponent(id);
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/quotes/${documentId}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Não foi possível validar o orçamento salvo (HTTP ${response.status}).`);
  const document = await response.json() as { fields?: Record<string, any> };
  return decodeFields(document.fields || {});
}

const ALLOWED_FINANCIAL_COLLECTIONS = new Set([
  "quotes", "invoices", "inventory_items", "inventory_movements",
  "ledger_entries", "payables", "receivables", "purchase_orders",
]);

/** Read a bounded, authenticated Firestore collection for server-side financial analysis. */
export async function loadCollectionFromFirestore(request: any, collectionName: string, maxDocuments = 250): Promise<any[]> {
  if (!ALLOWED_FINANCIAL_COLLECTIONS.has(collectionName)) throw new Error("Coleção não autorizada para análise financeira.");
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para consultar dados financeiros.");
  const pageSize = Math.min(500, Math.max(1, Math.floor(maxDocuments)));
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const response = await fetch(collectionUrl(collectionName, pageToken).replace("pageSize=1000", "pageSize=" + pageSize), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Não foi possível consultar ${collectionName} (HTTP ${response.status}).`);
    const payload = await response.json() as { documents?: any[]; nextPageToken?: string };
    for (const document of payload.documents || []) {
      const id = String(document.name || "").split("/").pop() || "";
      rows.push({ id, ...decodeFields(document.fields || {}) });
      if (rows.length >= maxDocuments) break;
    }
    pageToken = rows.length >= maxDocuments ? undefined : payload.nextPageToken || undefined;
  } while (pageToken);
  return rows;
}
