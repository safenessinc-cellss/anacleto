import firebaseConfig from "../../../firebase-applet-config.json" with { type: "json" };

type FirestoreValue = Record<string, any>;

const decode = (value: any): any => {
  if (!value || typeof value !== "object") return value;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(decode);
  if ("mapValue" in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, child]) => [key, decode(child)]));
  }
  return value;
};

async function readCollection(name: string, token: string, fieldPaths: string[]) {
  const databaseId = encodeURIComponent(firebaseConfig.firestoreDatabaseId || "(default)");
  const params = new URLSearchParams({ pageSize: "1000" });
  for (const fieldPath of fieldPaths) params.append("mask.fieldPaths", fieldPath);
  const url = "https://firestore.googleapis.com/v1/projects/" + firebaseConfig.projectId
    + "/databases/" + databaseId + "/documents/" + name + "?" + params.toString();

  const response = await fetch(url, {
    headers: { Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    let firestoreStatus = "";
    try {
      const body = await response.json() as any;
      firestoreStatus = String(body?.error?.status || body?.error?.message || "");
    } catch {
      // Keep the diagnostic limited to the HTTP status when Firestore returns no JSON.
    }
    throw new Error("Firestore " + name + " respondeu HTTP " + response.status
      + (firestoreStatus ? " (" + firestoreStatus + ")" : ""));
  }

  const data = await response.json() as any;
  return (data.documents || []).map((document: any) => ({
    id: String(document.name || "").split("/").pop(),
    ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])),
  })) as FirestoreValue[];
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Método não permitido." });

  let stage = "request_validation";
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return res.status(401).json({ error: "Autenticação obrigatória." });

    const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey;
    if (!apiKey || !firebaseConfig.projectId) {
      stage = "server_configuration";
      throw new Error("Configuração Firebase ausente no servidor.");
    }

    stage = "firebase_authentication";
    const auth = await fetch(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!auth.ok) return res.status(401).json({ error: "Sessão inválida." });

    stage = "firestore_read";
    const [profiles, rules] = await Promise.all([
      readCollection("aluminum_profiles", token, ["status", "manufacturer", "line", "finish"]),
      readCollection("cutting_rules", token, ["status", "manufacturer", "line", "typology", "configuration"]),
    ]);

    stage = "technical_options_mapping";
    const verified = (row: FirestoreValue) => row.status === "verified";
    const unique = (values: any[]) => [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))].sort();
    const systems = unique(rules.filter(verified).map(row => JSON.stringify({
      manufacturer: row.manufacturer,
      line: row.line,
      typology: row.typology,
      configuration: row.configuration || "",
    }))).map(value => JSON.parse(value));

    const available = systems.filter((system: any) => profiles.some(profile =>
      verified(profile)
      && String(profile.manufacturer || "").toLowerCase() === String(system.manufacturer || "").toLowerCase()
      && String(profile.line || "").toLowerCase() === String(system.line || "").toLowerCase()
    ));

    return res.status(200).json({
      systems: available,
      manufacturers: unique(available.map((row: any) => row.manufacturer)),
      lines: unique(available.map((row: any) => row.line)),
      typologies: unique(available.map((row: any) => row.typology)),
      configurations: unique(available.map((row: any) => row.configuration)),
      finishes: unique(profiles.filter(verified).map((row: any) => row.finish)),
      loadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const requestId = String(req.headers["x-vercel-id"] || req.headers["x-request-id"] || "");
    console.error("[supplier/technical-options] failed", {
      stage,
      requestId,
      message: String(error?.message || error),
      stack: error?.stack,
    });
    return res.status(502).json({
      error: "Falha ao carregar opções técnicas. Consulte o diagnóstico do servidor.",
      code: "TECHNICAL_OPTIONS_LOAD_FAILED",
      stage,
    });
  }
}
