import { randomUUID } from "node:crypto";
import { createServiceAuthHeaders } from "./service-auth";

export interface DrawingServiceJob {
  status: "COMPLETED" | "JOB_PROCESSING";
  jobId: string;
  pollUrl?: string;
  result?: unknown;
}
function serviceBase(): string {
  const value = process.env.ANACLETO_DRAWING_SERVICE_URL;
  if (!value) throw new Error("ANACLETO_DRAWING_SERVICE_URL is not configured.");
  const url = new URL(value);
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("Drawing service URL must use HTTPS in production.");
  return url.toString().replace(/\/$/, "");
}
export async function requestDrawingService(payload: unknown, timeoutMs = 5000, authorization = ""): Promise<DrawingServiceJob> {
  const base = serviceBase();
  const jobId = randomUUID();
  const path = "/generate";
  const body = JSON.stringify({ ...((payload && typeof payload === "object") ? payload as object : {}), requestId: jobId });
  const headers = {
    "Content-Type": "application/json",
    "x-request-id": jobId,
    ...(authorization ? { Authorization: authorization } : {}),
    ...createServiceAuthHeaders("POST", path, body),
  };
  try {
    const response = await fetch(base + path, {
      method: "POST", headers, body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 202) {
      const result = await response.json() as { jobId?: string; pollUrl?: string };
      return { status: "JOB_PROCESSING", jobId: result.jobId || jobId, pollUrl: result.pollUrl || "/api/ai/technical-drawing/jobs/" + jobId };
    }
    if (!response.ok) throw new Error("Drawing service returned HTTP " + response.status);
    return { status: "COMPLETED", jobId, result: await response.json() };
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      // The service receives a stable request ID and must persist it before starting generation.
      return { status: "JOB_PROCESSING", jobId, pollUrl: "/api/ai/technical-drawing/jobs/" + jobId };
    }
    throw error;
  }
}
export async function getDrawingServiceJob(jobId: string): Promise<unknown> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error("Invalid drawing job ID.");
  const base = serviceBase();
  const path = "/jobs/" + encodeURIComponent(jobId);
  const headers = createServiceAuthHeaders("GET", path, "");
  const response = await fetch(base + path, { method: "GET", headers, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Drawing job lookup returned HTTP " + response.status);
  return response.json();
}
