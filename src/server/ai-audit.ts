import { createHash, randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

export type AIAuditServiceName = "BUDGET" | "TECHNICAL_DRAWING";
export type BudgetLineState = "SUGGESTED_BY_AI" | "REVIEWED_BY_ENGINEER" | "APPROVED_FOR_MANUFACTURING";

export interface AIAuditRecord {
  id: string;
  timestamp: string;
  serviceName: AIAuditServiceName;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  inputHash: string;
  outputHash: string;
  actorUid?: string;
  requestId?: string;
  outcome: "SUCCESS" | "FAILURE";
  durationMs?: number;
  errorCode?: string;
}
export interface BudgetLineAuditTransition {
  id: string;
  timestamp: string;
  quoteId: string;
  lineId: string;
  fromState: BudgetLineState | null;
  toState: BudgetLineState;
  actorUid: string;
  actorRole: string;
  reason?: string;
  snapshotId?: string;
}
export interface AIAuditContext {
  serviceName: AIAuditServiceName;
  modelUsed: string;
  input: unknown;
  output?: unknown;
  usage?: { inputTokens?: number; outputTokens?: number; promptTokens?: number; completionTokens?: number };
  actorUid?: string;
  requestId?: string;
  startedAt?: number;
  error?: unknown;
  authorizationToken?: string;
}
const sha256 = (value: unknown): string => createHash("sha256").update(stableJson(value)).digest("hex");
function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + stableJson(object[key])).join(",") + "}";
}
function firestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(firestoreValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, firestoreValue(item)])) } };
}
async function appendFirestore(collection: string, record: Record<string, unknown>, token?: string): Promise<void> {
  if (!token) {
    const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    const serviceAccount = rawAccount ? JSON.parse(rawAccount) : (clientEmail && privateKey ? {
      project_id: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
      client_email: clientEmail,
      private_key: privateKey,
    } : null);
    if (!serviceAccount) throw new Error("AI audit persistence requires a Firebase service account when no user token is available.");
    const app = getApps().find(candidate => candidate.name === "anacleto-audit") ||
      initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || firebaseConfig.projectId }, "anacleto-audit");
    await getFirestore(app).collection(collection).doc(String(record.id)).create(record);
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not configured for audit persistence.");
  const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)";
  const fields = Object.fromEntries(Object.entries(record).map(([key, value]) => [key, firestoreValue(value)]));
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${encodeURIComponent(databaseId)}/documents/${collection}?documentId=${encodeURIComponent(String(record.id))}`, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Audit persistence failed: HTTP ${response.status}`);
}
export async function recordAIAudit(context: AIAuditContext): Promise<AIAuditRecord> {
  const record: AIAuditRecord = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    serviceName: context.serviceName,
    modelUsed: context.modelUsed,
    promptTokens: Number(context.usage?.promptTokens ?? context.usage?.inputTokens ?? 0),
    completionTokens: Number(context.usage?.completionTokens ?? context.usage?.outputTokens ?? 0),
    inputHash: sha256(context.input),
    outputHash: sha256(context.error ? { error: String(context.error) } : context.output ?? null),
    actorUid: context.actorUid,
    requestId: context.requestId,
    outcome: context.error ? "FAILURE" : "SUCCESS",
    durationMs: context.startedAt ? Math.max(0, Date.now() - context.startedAt) : undefined,
    errorCode: context.error instanceof Error ? context.error.name : undefined,
  };
  try { await appendFirestore("ai_audit_logs", record as unknown as Record<string, unknown>, context.authorizationToken); }
  catch (error) {
    console.error("[AI_AUDIT_PERSISTENCE_ERROR]", error);
    if (process.env.NODE_ENV === "production") throw error;
  }
  return record;
}
export async function recordBudgetLineTransition(entry: Omit<BudgetLineAuditTransition, "id" | "timestamp">, authorizationToken?: string): Promise<BudgetLineAuditTransition> {
  const record: BudgetLineAuditTransition = { ...entry, id: randomUUID(), timestamp: new Date().toISOString() };
  try { await appendFirestore("budget_line_audit", record as unknown as Record<string, unknown>, authorizationToken); }
  catch (error) { console.error("[BUDGET_AUDIT_PERSISTENCE_ERROR]", error); }
  return record;
}
export { sha256 as sha256AuditHash };
