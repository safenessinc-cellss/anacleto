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

export async function loadCatalogFromFirestore(request: any): Promise<any[]> {
  const token = getToken(request);
  if (!token) throw new Error("Autenticação necessária para consultar o catálogo oficial.");
  const rows: any[] = [];
  let pageToken: string | undefined;
  do {
    const response = await fetch(collectionUrl("catalog", pageToken), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Não foi possível consultar o catálogo oficial (HTTP ${response.status}).`);
    const payload = await response.json() as { documents?: any[]; nextPageToken?: string };
    for (const document of payload.documents || []) {
      const id = String(document.name || "").split("/").pop() || "";
      rows.push({ id, ...decodeFields(document.fields || {}) });
    }
    pageToken = payload.nextPageToken || undefined;
    if (rows.length > 5000) throw new Error("Catálogo excede o limite seguro de leitura.");
  } while (pageToken);
  return rows;
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
