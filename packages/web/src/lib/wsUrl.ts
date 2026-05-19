type BrowserLocationLike = Pick<Location, 'protocol' | 'hostname' | 'host'>;

export type ApiWsBaseInput = {
  location: BrowserLocationLike;
  dev?: boolean;
  apiPort?: string;
  apiWsBase?: string;
};

function wsProtocolFor(protocol: string): 'ws' | 'wss' {
  return protocol === 'https:' ? 'wss' : 'ws';
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveApiWsBase(input: ApiWsBaseInput): string {
  const explicit = input.apiWsBase?.trim();
  if (explicit) return stripTrailingSlashes(explicit);

  const protocol = wsProtocolFor(input.location.protocol);
  if (input.dev) {
    const host = input.location.hostname || input.location.host.split(':')[0] || '127.0.0.1';
    const port = input.apiPort?.trim() || '8500';
    return `${protocol}://${host}:${port}`;
  }

  return `${protocol}://${input.location.host}`;
}

export function apiWsBase(): string {
  return resolveApiWsBase({
    location: window.location,
    dev: Boolean(import.meta.env.DEV),
    apiPort: import.meta.env.VITE_API_PORT,
    apiWsBase: import.meta.env.VITE_API_WS_BASE,
  });
}

export function apiWsUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${apiWsBase()}${suffix}`;
}

export function modelWsUrl(modelId: string, resumeFrom?: number | null): string {
  const resumeParam =
    resumeFrom !== null && resumeFrom !== undefined ? `?resumeFrom=${resumeFrom}` : '';
  return apiWsUrl(`/ws/${encodeURIComponent(modelId)}${resumeParam}`);
}
