export function shouldAttemptGatewayFallback(gatewayConfigured: boolean, remainingMs: number): boolean {
  return gatewayConfigured && Number.isFinite(remainingMs) && remainingMs > 1_000;
}
