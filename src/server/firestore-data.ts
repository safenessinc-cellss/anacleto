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

function collectionUrl(collection: string, pageToken?: string) {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const base = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents/${collection}?pageSize=1000`;
  return pageToken ? base + "&pageToken=" + encodeURIComponent(pageToken) : base;
}

/** Load authoritative rows from every collection exposed in the quote/catalog UI. */
export async function loadCatalogFromFirestore(request: any): Promise<any[]> {
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para consultar o catálogo oficial.");
  const collectionNames = ["catalog", "supplier_catalog", "registry_items", "price_table"];
  const collections: any[][] = [];
  // Read collections sequentially and retry transient Firestore throttling. A burst of
  // four parallel 1000-row reads can otherwise make quote approval fail with HTTP 429.
  for (const collectionName of collectionNames) {
    const rows: any[] = [];
    let pageToken: string | undefined;
    do {
      let response: Response | null = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        response = await fetch(collectionUrl(collectionName, pageToken), {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(12_000),
        });
        if (![429, 500, 503].includes(response.status)) break;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 300 * (2 ** attempt)));
      }
      if (!response || !response.ok) {
        throw new Error(`Não foi possível consultar o catálogo ${collectionName} (HTTP ${response?.status || 503}).`);
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
    collections.push(rows);
  }
  return collections.flat();
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
