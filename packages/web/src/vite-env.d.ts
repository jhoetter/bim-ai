/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_E2E_DISABLE_WS?: string;
  readonly VITE_API_PORT?: string;
  readonly VITE_API_WS_BASE?: string;
}
