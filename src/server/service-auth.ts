import { createHmac, timingSafeEqual } from "node:crypto";

const HEADER = "x-service-signature";
const TIMESTAMP_HEADER = "x-service-timestamp";
const MAX_CLOCK_SKEW_MS = 60_000;

function secret(): string {
  const value = process.env.ANACLETO_SERVICE_API_KEY;
  if (!value || value.length < 32) throw new Error("ANACLETO_SERVICE_API_KEY must contain at least 32 characters.");
  return value;
}
export function signServiceRequest(method: string, path: string, timestamp: string, body: string): string {
  const canonical = [method.toUpperCase(), path, timestamp, body].join("\n");
  return createHmac("sha256", secret()).update(canonical).digest("hex");
}
export function createServiceAuthHeaders(method: string, path: string, body: string): Record<string, string> {
  const timestamp = String(Date.now());
  return { [TIMESTAMP_HEADER]: timestamp, [HEADER]: signServiceRequest(method, path, timestamp, body) };
}
export function verifyServiceRequest(input: { method: string; path: string; timestamp: string; signature: string; body: string }): boolean {
  if (!/^\d{13}$/.test(input.timestamp)) return false;
  const age = Math.abs(Date.now() - Number(input.timestamp));
  if (age > MAX_CLOCK_SKEW_MS) return false;
  let expected: string;
  try { expected = signServiceRequest(input.method, input.path, input.timestamp, input.body); }
  catch { return false; }
  const actualBuffer = Buffer.from(input.signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}
export const SERVICE_SIGNATURE_HEADER = HEADER;
export const SERVICE_TIMESTAMP_HEADER = TIMESTAMP_HEADER;
