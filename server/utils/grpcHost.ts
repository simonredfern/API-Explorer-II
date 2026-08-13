// OBP-API deployments conventionally expose gRPC on a `grpc.` subdomain of the
// REST host, so when VITE_OBP_GRPC_HOST is unset the default is
// grpc.<VITE_OBP_API_HOST hostname>:50051 — not localhost, which only works
// when the explorer and OBP-API share a host. localhost and IP literals get no
// `grpc.` prefix (there is no subdomain to resolve there).

export const DEFAULT_GRPC_PORT = 50051

/**
 * The gRPC host:port to connect to, resolved from an env-like record
 * (pass `process.env`): VITE_OBP_GRPC_HOST when set, otherwise derived
 * from VITE_OBP_API_HOST.
 */
export function resolveGrpcHost(env: Record<string, string | undefined>): string {
  return env.VITE_OBP_GRPC_HOST || defaultGrpcHost(env.VITE_OBP_API_HOST)
}

export function defaultGrpcHost(obpApiHost: string | undefined | null): string {
  if (obpApiHost) {
    try {
      const hostname = new URL(obpApiHost).hostname
      return `${grpcSubdomainApplies(hostname) ? 'grpc.' : ''}${hostname}:${DEFAULT_GRPC_PORT}`
    } catch {
      // unparseable base URL — fall through to localhost
    }
  }
  return `localhost:${DEFAULT_GRPC_PORT}`
}

function grpcSubdomainApplies(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return false
  }
  // IPv4 literal; IPv6 literals contain ':' (URL.hostname keeps their brackets)
  return !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':')
}
