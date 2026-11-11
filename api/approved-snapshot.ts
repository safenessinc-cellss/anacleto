import { createHash, randomUUID } from "node:crypto";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };
import { AI_CONFIG } from "../src/server/ai-config";
import { loadCatalogFromFirestore } from "../src/server/firestore-data";
import { createBudgetSnapshot } from "../src/server/snapshot-ledger";
import { buildDrawingVectorPayload } from "../src/server/drawing-vector";

type AuthUser = { uid: string; email: string; role: string };
const OWNER_EMAIL = "safeness.c.a@gmail.com";
const requestWindows = new Map<string, { startedAt: number; count: number }>();
function withinRateLimit(uid: string) {
  const now = Date.now();
  const current = requestWindows.get(uid);
  if (!current || now - current.startedAt >= 60000) { requestWindows.set(uid, { startedAt: now, count: 1 }); return true; }
  if (current.count >= 6) return false;
  current.count += 1;
  return true;
}
const base = () => {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  return "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId + "/databases/" + databaseId + "/documents";
};
function send(res: any, status: number, body: unknown) {
  res.setHeader?.("Cache-Control", "no-store");
  return res.status(status).json(body);
}
function tokenOf(req: any) {
  const value = String(req.headers?.authorization || "");
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
async function authenticate(req: any): Promise<AuthUser | null> {
  const token = tokenOf(req);
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
  if (!token || !apiKey) return null;
  const identity = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + apiKey, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10000),
  });
  if (!identity.ok) return null;
  const data = await identity.json() as { users?: Array<{ localId?: string; email?: string }> };
  const account = data.users?.[0];
  if (!account?.localId || !account.email) return null;
  const email = account.email.toLowerCase();
  if (email === OWNER_EMAIL) return { uid: account.localId, email, role: "owner" };
  const roleResponse = await fetch(base() + "/admins/" + encodeURIComponent(email), {
    headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(10000),
  });
  if (!roleResponse.ok) return null;
  const roleDoc = await roleResponse.json() as any;
  const role = roleDoc.fields?.role?.stringValue;
  return role ? { uid: account.localId, email, role } : null;
}
function decodeValue(value: any): any {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("nullValue" in value) return null;
  if ("timestampValue" in value) return value.timestampValue;
  if ("arrayValue" in value) return (value.arrayValue?.values || []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue?.fields || {});
  return value;
}
function decodeFields(fields: Record<string, any> = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}
function encodeValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") return { mapValue: { fields: encodeFields(value) } };
  return { stringValue: String(value) };
}
function encodeFields(value: Record<string, any>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)]));
}
async function readDocument(req: any, collection: string, id: string) {
  const result = await fetch(base() + "/" + collection + "/" + encodeURIComponent(id), {
    headers: { Authorization: "Bearer " + tokenOf(req) }, signal: AbortSignal.timeout(12000),
  });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error("Falha ao ler " + collection + " (HTTP " + result.status + ").");
  const raw = await result.json() as any;
  return { data: decodeFields(raw.fields || {}), updateTime: raw.updateTime, name: raw.name };
}
function stable(value: any): string {
  if (value === undefined || value === null) return "null";
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
function digest(value: any) {
  return createHash("sha256").update(stable(value)).digest("hex");
}
function catalogMatch(item: any, catalog: any[]) {
  const id = String(item?.catalogItemId || item?.itemId || "").trim();
  const sku = String(item?.sku || item?.code || "").trim().toLowerCase();
  if (!id && !sku) return null;
  return catalog.find((row: any) => {
    const idMatch = !!id && String(row.id || "") === id;
    const skuMatch = !!sku && String(row.sku || row.code || "").trim().toLowerCase() === sku;
    return id && sku ? idMatch && skuMatch : id ? idMatch : skuMatch;
  }) || null;
}

function canApproveManualPrice(user: AuthUser) {
  return user.role === "owner" || ["super_admin", "super_usuario", "ceo", "admin", "financeiro"].includes(user.role);
}
function canApprove(user: AuthUser, type: "quote" | "drawing") {
  if (user.role === "owner") return true;
  const quoteRoles = ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"];
  const drawingRoles = ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "qualidade", "producao"];
  return (type === "quote" ? quoteRoles : drawingRoles).includes(user.role);
}
function canReadSnapshot(user: AuthUser, type: "quote" | "drawing") {
  if (user.role === "owner") return true;
  const quoteRoles = ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"];
  const drawingRoles = ["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "qualidade", "producao"];
  return (type === "quote" ? quoteRoles : drawingRoles).includes(user.role);
}

async function commitSnapshot(req: any, collection: string, documentId: string, updateTime: string, snapshot: any) {
  const snapshotId = (collection === "quotes" ? "quote_" : "drawing_") + documentId + "_" + randomUUID();
  const snapshotName = base() + "/approved_snapshots/" + snapshotId;
  const sourceName = base() + "/" + collection + "/" + encodeURIComponent(documentId);
  const now = new Date().toISOString();
  const sourceUpdate = collection === "quotes"
    ? {
        status: "approved", approvedSnapshotId: snapshotId, approvedAt: now, approvedBy: snapshot.approvedBy, updatedAt: now,
        items: snapshot.document.items, subtotal: snapshot.document.subtotal, discountAmount: snapshot.document.discountAmount,
        taxAmount: snapshot.document.taxAmount, total: snapshot.document.total, senderSnapshot: snapshot.senderSnapshot,
      }
    : {
        isDraft: false, status: "APPROVED_FOR_MANUFACTURING", draftStatus: "approved", approvedSnapshotId: snapshotId,
        approvedAt: now, approvedBy: snapshot.approvedBy, updatedAt: now,
        budget: snapshot.document.budget, senderSnapshot: snapshot.senderSnapshot,
      };
  const lines = collection === "quotes"
    ? (Array.isArray(snapshot.document.items) ? snapshot.document.items : [])
    : (Array.isArray(snapshot.document.budget?.items) ? snapshot.document.budget.items : []);
  const auditWrites = lines.flatMap((line: any) => {
    const lineId = String(line.id || line.pieceId || line.sku || "");
    if (!lineId) return [];
    const common = {
      quoteId: documentId,
      documentId,
      documentType: collection === "quotes" ? "quote" : "drawing",
      lineId,
      actorUid: snapshot.approvedBy.uid,
      actorRole: snapshot.approvedBy.role,
      snapshotId,
    };
    const first = { ...common, id: randomUUID(), timestamp: now, fromState: "SUGGESTED_BY_AI", toState: "REVIEWED_BY_ENGINEER", reason: "Revisão e validação confirmadas no fluxo de aprovação do documento." };
    const second = { ...common, id: randomUUID(), timestamp: now, fromState: "REVIEWED_BY_ENGINEER", toState: "APPROVED_FOR_MANUFACTURING", reason: "Linha incluída na instantânea imutável aprovada." };
    return [
      { update: { name: base() + "/budget_line_audit/" + first.id, fields: encodeFields(first) }, currentDocument: { exists: false } },
      { update: { name: base() + "/budget_line_audit/" + second.id, fields: encodeFields(second) }, currentDocument: { exists: false } },
    ];
  });
  const writes = [
    { update: { name: snapshotName, fields: encodeFields(snapshot) }, currentDocument: { exists: false } },
    { update: { name: sourceName, fields: encodeFields(sourceUpdate) }, updateMask: { fieldPaths: Object.keys(sourceUpdate) }, currentDocument: { updateTime } },
    ...auditWrites,
  ];
  const result = await fetch(base() + ":commit", {
    method: "POST", headers: { Authorization: "Bearer " + tokenOf(req), "Content-Type": "application/json" },
    body: JSON.stringify({ writes }), signal: AbortSignal.timeout(15000),
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error("Não foi possível congelar a aprovação (HTTP " + result.status + "): " + detail.slice(0, 400));
  }
  return snapshotId;
}

export default async function handler(req: any, res: any) {
  try {
    const user = await authenticate(req);
    if (!user) return send(res, 401, { error: "Autenticação obrigatória ou sessão expirada." });
    if (!withinRateLimit(user.uid)) return send(res, 429, { error: "Limite de aprovações e consultas atingido. Aguarde um minuto." });
    if (req.method === "GET") {
      const snapshotId = String(req.query?.snapshotId || "").trim();
      if (!snapshotId || snapshotId.length > 300 || snapshotId.includes("/")) return send(res, 400, { error: "snapshotId inválido." });
      const found = await readDocument(req, "approved_snapshots", snapshotId);
      if (!found) return send(res, 404, { error: "Instantânea aprovada não encontrada." });
      if (!["quote", "drawing"].includes(found.data.type) || !canReadSnapshot(user, found.data.type)) {
        return send(res, 403, { error: "Seu perfil não tem acesso a esta instantânea." });
      }
      const integrityPayload: any = { ...found.data, document: { ...found.data.document } };
      const expectedHash = String(integrityPayload.contentHash || "");
      delete integrityPayload.contentHash;
      delete integrityPayload.document.snapshotContentHash;
      if (!expectedHash || digest(integrityPayload) !== expectedHash) {
        return send(res, 409, { error: "Falha de integridade: a instantânea não corresponde ao hash de aprovação.", code: "SNAPSHOT_INTEGRITY_FAILED" });
      }
      if (found.data.budgetSnapshot?.contentHash) {
        const budgetPayload = { ...found.data.budgetSnapshot };
        const budgetHash = String(budgetPayload.contentHash);
        delete budgetPayload.contentHash;
        if (digest(budgetPayload) !== budgetHash) {
          return send(res, 409, { error: "Falha de integridade no ledger financeiro.", code: "BUDGET_SNAPSHOT_INTEGRITY_FAILED" });
        }
      }
      return send(res, 200, found.data);
    }
    if (req.method !== "POST") {
      res.setHeader?.("Allow", "GET, POST");
      return send(res, 405, { error: "Método não permitido." });
    }
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some(key => !["type","documentId","senderSnapshot"].includes(key))) {
      return send(res, 400, { error: "A solicitação contém campos não permitidos." });
    }
    if (typeof body.type !== "string" || typeof body.documentId !== "string") {
      return send(res, 400, { error: "type e documentId devem ser textos válidos." });
    }
    if (body.senderSnapshot !== undefined && (!body.senderSnapshot || typeof body.senderSnapshot !== "object" || Array.isArray(body.senderSnapshot))) {
      return send(res, 400, { error: "senderSnapshot deve ser um objeto." });
    }
    if (body.senderSnapshot && JSON.stringify(body.senderSnapshot).length > 500000) {
      return send(res, 413, { error: "Os metadados do emissor excedem o limite permitido." });
    }
    const type = body.type;
    const documentId = body.documentId.trim();
    if (!["quote", "drawing"].includes(type) || !documentId || documentId.length > 180 || documentId.includes("/")) {
      return send(res, 400, { error: "Dados de aprovação inválidos." });
    }
    if (!canApprove(user, type)) return send(res, 403, { error: "Seu perfil não pode aprovar este documento." });
    const senderInput = body?.senderSnapshot && typeof body.senderSnapshot === "object" ? body.senderSnapshot : {};
    const senderSnapshot: any = {};
    for (const key of ["name","nif","address","postalCode","city","country","currency","logoUrl","watermarkLogoUrl","website","phone","email"]) {
      const value = String(senderInput[key] || "").slice(0, key.endsWith("Url") ? 220000 : 500);
      if (value && (!(key.endsWith("Url")) || value.length <= 220000)) senderSnapshot[key] = value;
    }
    const collection = type === "quote" ? "quotes" : "technical_drawings";
    const found = await readDocument(req, collection, documentId);
    if (!found) return send(res, 404, { error: "Documento não encontrado." });
    const source = found.data;
    if (source.approvedSnapshotId) return send(res, 409, { error: "Documento já congelado e bloqueado.", snapshotId: source.approvedSnapshotId });

    let snapshot: any;
    if (type === "quote") {
      if (!["draft","pending","pendente","borrador","accepted","approved","aprovado"].includes(String(source.status || "").toLowerCase())) {
        return send(res, 409, { error: "Somente orçamentos em rascunho ou pendentes podem ser aprovados." });
      }
      if (!Array.isArray(source.items) || source.items.length === 0 || source.items.length > 150) return send(res, 422, { error: "O orçamento deve possuir entre 1 e 150 itens." });
      const catalog = await loadCatalogFromFirestore(req);
      const reviewedItems = source.items.map((item: any) => {
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Quantidade inválida no orçamento: use um inteiro positivo.");
        const price = Number(item.unitPrice);
        if (!Number.isFinite(price) || price < 0 || price > 1000000000) throw new Error("Preço inválido no orçamento.");
        const match = catalogMatch(item, catalog);
        if (item.catalogItemId || item.sku || item.itemId) {
          if (!match) throw new Error("SKU/ID sem correspondência no catálogo: " + (item.sku || item.catalogItemId || item.itemId));
          const catalogPrice = Number(match.price);
          if (match.price === undefined || match.price === null || String(match.price).trim() === "" || !Number.isFinite(catalogPrice) || catalogPrice < 0 || catalogPrice !== price) {
            throw new Error("Preço não corresponde ao catálogo atual para " + (item.sku || match.id) + ".");
          }
          return { ...item, quantity, unitPrice: catalogPrice, priceValidation: "CATALOG_VERIFIED", catalogPriceAtApproval: catalogPrice, catalogItemId: match.id, sku: String(match.sku || match.code || item.sku || "") };
        }
        if (["pending","pendente"].includes(String(item.priceSource || "").toLowerCase())) throw new Error("O item " + item.description + " tem preço pendente.");
        return { ...item, quantity, priceValidation: "MANUALLY_APPROVED_BY_AUTHORIZED_USER" };
      });
      const subtotal = Number(reviewedItems.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0).toFixed(2));
      const discountRate = Number(source.discountRate || 0);
      const taxRate = Number(source.taxRate || 0);
      if (![discountRate, taxRate].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) return send(res, 422, { error: "Impostos ou descontos inválidos." });
      const discountAmount = Number((subtotal * discountRate / 100).toFixed(2));
      const taxAmount = Number((Math.max(0, subtotal - discountAmount) * taxRate / 100).toFixed(2));
      const total = Number((subtotal - discountAmount + taxAmount).toFixed(2));
      const { pdfDataUri: _pdfDataUri, pdfFileName: _pdfFileName, pdfGeneratedAt: _pdfGeneratedAt, pdfFileSizeKb: _pdfFileSizeKb, ...sourceWithoutPdf } = source;
      const approvedAt = new Date().toISOString();
      snapshot = {
        schemaVersion: 1, type: "quote", documentId, documentNumber: source.number || "", status: "approved",
        approvedAt, approvedBy: { uid: user.uid, email: user.email, role: user.role },
        document: { ...sourceWithoutPdf, items: reviewedItems, subtotal, discountAmount, taxAmount, total, status: "approved", approvedAt, senderSnapshot },
        senderSnapshot,
        modelSignatures: {
          provider: "Vercel AI Gateway", model: AI_CONFIG.quote.model, capability: "quote",
          temperature: AI_CONFIG.quote.temperature, maxOutputTokens: AI_CONFIG.quote.maxOutputTokens, timeoutMs: AI_CONFIG.quote.timeoutMs,
          signature: digest({ provider: "Vercel AI Gateway", model: AI_CONFIG.quote.model, capability: "quote" }),
          capturedAt: new Date().toISOString(),
        },
      };
      snapshot.budgetSnapshot = createBudgetSnapshot({
        documentId, documentNumber: String(source.number || ""), approvedAt,
        approvedBy: snapshot.approvedBy, currency: String(source.currency || "BRL"),
        lines: reviewedItems, subtotal, discountAmount, taxAmount, total,
        technicalDrawing: source.technicalDrawing || null,
        modelSignature: snapshot.modelSignatures,
      });
    } else {
      if (!Array.isArray(source.pieces) || source.pieces.length === 0) return send(res, 422, { error: "O desenho não possui componentes." });
      if (source.isDraft === false || source.status === "APPROVED_FOR_MANUFACTURING") return send(res, 409, { error: "O desenho já foi aprovado e não pode ser reaprovado." });
      const catalog = await loadCatalogFromFirestore(req);
      const budgetItems = Array.isArray(source.budget?.items) ? source.budget.items : [];
      if (budgetItems.length > 150) return send(res, 422, { error: "O orçamento técnico excede 150 linhas." });
      const reviewedBudgetItems = budgetItems.map((item: any) => {
        const quantity = Number(item.quantity);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Quantidade inválida no orçamento técnico.");
        if (["pending","pendente"].includes(String(item.priceSource || "").toLowerCase())) throw new Error("O desenho contém preços pendentes; revise antes de aprovar.");
        const match = catalogMatch(item, catalog);
        if (item.catalogItemId || item.sku) {
          if (!match) throw new Error("SKU/ID do orçamento técnico não existe no catálogo.");
          const catalogPrice = Number(match.price);
          if (match.price === undefined || match.price === null || !Number.isFinite(catalogPrice) || catalogPrice < 0 || catalogPrice !== Number(item.unitPrice)) {
            throw new Error("Preço do orçamento técnico não corresponde ao catálogo.");
          }
          return { ...item, quantity, unitPrice: catalogPrice, priceValidation: "CATALOG_VERIFIED", catalogPriceAtApproval: catalogPrice };
        }
        const manualPrice = Number(item.unitPrice);
        if (!Number.isFinite(manualPrice) || manualPrice < 0 || manualPrice > 1000000000) throw new Error("Preço manual inválido no orçamento técnico.");
        if (!canApproveManualPrice(user)) throw new Error("Somente direção/Financeiro pode aprovar manualmente preços sem SKU cadastrado.");
        return { ...item, quantity, unitPrice: manualPrice, priceValidation: "MANUALLY_APPROVED_BY_AUTHORIZED_USER" };
      });
      const approvedAt = new Date().toISOString();
      const cleanVisualElements = (Array.isArray(source.visualElements) ? source.visualElements : []).filter((element: any) => element?.id !== "anacleto-draft-watermark");
      const approvedVectorPayload = buildDrawingVectorPayload(cleanVisualElements, false);
      const { pdfDataUri: _pdfDataUri, pdfUrl: _pdfUrl, pdfStoragePath: _pdfStoragePath, pdfGeneratedAt: _pdfGeneratedAt, pdfFileName: _pdfFileName, pdfFileSizeKb: _pdfFileSizeKb, ...sourceWithoutPdf } = source;
      snapshot = {
        schemaVersion: 1, type: "drawing", documentId, documentNumber: source.title || "", status: "APPROVED_FOR_MANUFACTURING",
        approvedAt, approvedBy: { uid: user.uid, email: user.email, role: user.role },
        document: { ...sourceWithoutPdf, visualElements: cleanVisualElements, vectorPayload: approvedVectorPayload, budget: source.budget ? { ...source.budget, items: reviewedBudgetItems } : source.budget, isDraft: false, status: "APPROVED_FOR_MANUFACTURING", draftStatus: "approved", approvedAt, senderSnapshot },
        senderSnapshot,
        modelSignatures: {
          provider: "Vercel AI Gateway", model: AI_CONFIG.technicalDrawing.model, capability: "technicalDrawing",
          temperature: AI_CONFIG.technicalDrawing.temperature, maxOutputTokens: AI_CONFIG.technicalDrawing.maxOutputTokens, timeoutMs: AI_CONFIG.technicalDrawing.timeoutMs,
          signature: digest({ provider: "Vercel AI Gateway", model: AI_CONFIG.technicalDrawing.model, capability: "technicalDrawing" }),
          capturedAt: new Date().toISOString(),
        },
        drawingMetadata: { dimensions: source.overallDimensions, pieces: source.pieces, visualElements: cleanVisualElements, vectorPayload: approvedVectorPayload, cuttingPlan: source.cuttingPlan || [], measurementPlan: source.measurementPlan || [], assumptions: source.assumptions || [], budget: reviewedBudgetItems },
      };
      const drawingSubtotal = Number(reviewedBudgetItems.reduce((sum: number, item: any) => sum + Number(item.quantity) * Number(item.unitPrice), 0).toFixed(2));
      snapshot.budgetSnapshot = createBudgetSnapshot({
        documentId, documentNumber: String(source.title || ""), approvedAt,
        approvedBy: snapshot.approvedBy, currency: String(source.budget?.currency || "BRL"),
        lines: reviewedBudgetItems, subtotal: drawingSubtotal, discountAmount: 0, taxAmount: 0, total: drawingSubtotal,
        technicalDrawing: snapshot.document,
        modelSignature: snapshot.modelSignatures,
      });
    }
    snapshot.contentHash = digest(snapshot);
    snapshot.document.snapshotContentHash = snapshot.contentHash;
    const snapshotId = await commitSnapshot(req, collection, documentId, found.updateTime, snapshot);
    return send(res, 201, { snapshotId, snapshot, immutable: true });
  } catch (error: any) {
    console.error("Approved snapshot operation failed:", error?.message || error);
    return send(res, 422, { error: error?.message || "Não foi possível aprovar e congelar o documento." });
  }
}
