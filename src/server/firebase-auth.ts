import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };
import { stripBearerPrefix } from "./auth-token.js";

export interface FirebaseServerUser {
  uid: string;
  email: string;
  role: string;
}

const OWNER_EMAIL = "safeness.c.a@gmail.com";

function authError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/** Verify a Firebase ID token and resolve its current server-side admin role. */
export async function authenticateFirebaseRequest(req: any): Promise<FirebaseServerUser | null> {
  const token = stripBearerPrefix(req?.headers?.authorization);
  if (!token) return null;

  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
  if (!apiKey) throw authError("A verificação de autenticação não está configurada no servidor.", 503);

  const identityResponse = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!identityResponse.ok) return null;

  const identity = await identityResponse.json() as { users?: Array<{ localId?: string; email?: string }> };
  const identityUser = identity.users?.[0];
  if (!identityUser?.localId || !identityUser.email) return null;

  const email = identityUser.email.trim().toLowerCase();
  if (email === OWNER_EMAIL) return { uid: identityUser.localId, email, role: "super_admin" };

  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const roleUrl = "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId
    + "/databases/" + databaseId + "/documents/admins/" + encodeURIComponent(email);
  const roleResponse = await fetch(roleUrl, {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(8_000),
  });
  if (!roleResponse.ok) return null;

  const roleDocument = await roleResponse.json() as { fields?: { role?: { stringValue?: string } } };
  const role = String(roleDocument.fields?.role?.stringValue || "").trim();
  if (!role) return null;
  return { uid: identityUser.localId, email, role };
}
