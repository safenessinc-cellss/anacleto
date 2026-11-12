import { randomBytes, timingSafeEqual } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "../firebase-applet-config.json" with { type: "json" };

type Request = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, unknown>;
  body?: unknown;
};

const editableQuoteRoles = new Set(["super_admin", "super_usuario", "ceo", "admin", "supervisor", "colaborador", "financeiro"]);
const db = () => {
  const existing = getApps().find((app) => app.name === "anacleto-public-proposals");
  if (existing) return getFirestore(existing, process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)");

  const rawAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const serviceAccount = rawAccount ? JSON.parse(rawAccount) : clientEmail && privateKey ? {
    project_id: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
    client_email: clientEmail,
    private_key: privateKey,
  } : null;
  const app = serviceAccount
    ? initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || firebaseConfig.projectId }, "anacleto-public-proposals")
    : initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId }, "anacleto-public-proposals");
  return getFirestore(app, process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || "(default)");
};

function send(res: any, status: number, body: unknown) {
  res.setHeader?.("Cache-Control", "no-store, private");
  res.setHeader?.("Pragma", "no-cache");
  return res.status(status).json(body);
}

function requestValue(req: Request, key: string): string {
  const queryValue = req.query?.[key];
  if (typeof queryValue === "string") return queryValue;
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

function constantTimeTokenMatch(expected: unknown, supplied: string): boolean {
  if (typeof expected !== "string" || !expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function authenticatedRole(req: Request) {
  const authorization = req.headers?.authorization;
  const token = typeof authorization === "string" && authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
  if (!token || !apiKey) return null;

  const identity = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!identity.ok) return null;
  const result = await identity.json() as { users?: Array<{ localId?: string; email?: string }> };
  const user = result.users?.[0];
  if (!user?.localId || !user.email) return null;

  const email = user.email.toLowerCase();
  if (email === "safeness.c.a@gmail.com") return { uid: user.localId, role: "super_admin" };
  const admin = await db().collection("admins").doc(email).get();
  const role = admin.data()?.role;
  return typeof role === "string" ? { uid: user.localId, role } : null;
}

function publicProposal(quote: FirebaseFirestore.DocumentData) {
  const drawing = quote.technicalDrawing && typeof quote.technicalDrawing === "object" ? quote.technicalDrawing : null;
  return {
    clientName: String(quote.clientName || ""),
    items: Array.isArray(quote.items) ? quote.items.map((item: any) => ({
      description: String(item.description || ""),
      quantity: Number(item.quantity || 0),
      unitPrice: Number(item.unitPrice || 0),
      subtotal: Number(item.subtotal ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)),
    })) : [],
    design: drawing ? {
      title: String(drawing.title || ""),
      description: String(drawing.description || ""),
      category: String(drawing.category || ""),
      overallDimensions: drawing.overallDimensions || null,
      pieces: Array.isArray(drawing.pieces) ? drawing.pieces.map((piece: any) => ({
        name: String(piece.name || ""),
        quantity: Number(piece.quantity || 0),
        dimensions: piece.dimensions || null,
        material: String(piece.material || ""),
      })) : [],
    } : null,
    taxes: {
      taxRate: Number(quote.taxRate || 0),
      taxAmount: Number(quote.taxAmount || 0),
      discountRate: Number(quote.discountRate || 0),
      discountAmount: Number(quote.discountAmount || 0),
    },
    freight: Number(quote.freight ?? quote.frete ?? quote.deliveryFee ?? 0),
    total: Number(quote.total || 0),
  };
}

export default async function handler(req: Request, res: any) {
  try {
    const id = requestValue(req, "id").trim();
    if (!id || id.length > 180 || id.includes("/")) return send(res, 400, { error: "Proposta inválida." });

    if (req.method === "GET") {
      const token = requestValue(req, "token");
      const snapshot = await db().collection("quotes").doc(id).get();
      const quote = snapshot.data();
      if (!snapshot.exists || !quote?.publicProposalEnabled || !constantTimeTokenMatch(quote.publicProposalToken, token)) {
        return send(res, 404, { error: "Proposta não encontrada ou link inválido." });
      }
      return send(res, 200, { proposal: publicProposal(quote) });
    }

    if (req.method !== "POST") {
      res.setHeader?.("Allow", "GET, POST");
      return send(res, 405, { error: "Método não permitido." });
    }

    const action = requestValue(req, "action");
    if (action === "generate") {
      const user = await authenticatedRole(req);
      if (!user) return send(res, 401, { error: "Autenticação obrigatória." });
      if (!editableQuoteRoles.has(user.role)) return send(res, 403, { error: "Seu perfil não pode gerar links de propostas." });
      const quoteRef = db().collection("quotes").doc(id);
      const quote = await quoteRef.get();
      if (!quote.exists) return send(res, 404, { error: "Proposta não encontrada." });
      const token = randomBytes(32).toString("base64url");
      await quoteRef.update({
        publicProposalToken: token,
        publicProposalEnabled: true,
        publicProposalUpdatedAt: FieldValue.serverTimestamp(),
      });
      return send(res, 200, { token });
    }

    if (action === "approve") {
      const suppliedToken = requestValue(req, "token");
      const quoteRef = db().collection("quotes").doc(id);
      const quote = await quoteRef.get();
      const data = quote.data();
      if (!quote.exists || !data?.publicProposalEnabled || !constantTimeTokenMatch(data.publicProposalToken, suppliedToken)) {
        return send(res, 404, { error: "Proposta não encontrada ou link inválido." });
      }
      await quoteRef.update({ status: "approved", publicProposalApprovedAt: FieldValue.serverTimestamp() });
      return send(res, 200, { approved: true });
    }

    return send(res, 400, { error: "Ação inválida." });
  } catch (error) {
    console.error("[PUBLIC_PROPOSAL]", error);
    return send(res, 503, { error: "Não foi possível processar a proposta agora." });
  }
}
