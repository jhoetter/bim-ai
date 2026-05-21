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

export type ModelWsUrlOptions = {
  resumeFrom?: number | null;
  initialSnapshot?: boolean;
  snapshotRevision?: number | null;
};

export function modelWsUrl(
  modelId: string,
  resumeFromOrOptions?: number | null | ModelWsUrlOptions,
): string {
  const options =
    typeof resumeFromOrOptions === 'object' && resumeFromOrOptions !== null
      ? resumeFromOrOptions
      : { resumeFrom: resumeFromOrOptions };
  const params = new URLSearchParams();
  if (options.resumeFrom !== null && options.resumeFrom !== undefined) {
    params.set('resumeFrom', String(options.resumeFrom));
  }
  if (options.initialSnapshot !== undefined) {
    params.set('initialSnapshot', options.initialSnapshot ? 'true' : 'false');
  }
  if (options.snapshotRevision !== null && options.snapshotRevision !== undefined) {
    params.set('snapshotRevision', String(options.snapshotRevision));
  }
  const query = params.toString();
  return apiWsUrl(`/ws/${encodeURIComponent(modelId)}${query ? `?${query}` : ''}`);
}
