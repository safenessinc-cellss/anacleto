/** Normalize an HTTP Authorization header without leaking malformed prefixes. */
export function stripBearerPrefix(value: unknown): string {
  const authorization = String(value ?? "").trim();
  return authorization.replace(/^Bearer\s+/i, "").trim();
}
