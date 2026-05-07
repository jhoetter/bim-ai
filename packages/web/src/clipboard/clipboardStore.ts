/**
 * FAM-10 — clipboard persistence layer.
 *
 * Two writes happen on every copy:
 *   - localStorage under `bim-ai:clipboard` — primary in-browser path
 *   - navigator.clipboard.writeText — best-effort cross-tab fallback
 *
 * Reads prefer localStorage; if that's empty (e.g. user pasted from a
 * different browser tab) we attempt navigator.clipboard.readText. Both
 * paths defensively handle missing APIs and storage quota errors so
 * the rest of the app never sees a clipboard exception.
 */
import { CLIPBOARD_STORAGE_KEY, parseClipboardPayload, type ClipboardPayload } from './payload';

export function writeClipboard(payload: ClipboardPayload): void {
  const json = JSON.stringify(payload);
  try {
    localStorage.setItem(CLIPBOARD_STORAGE_KEY, json);
  } catch {
    // Quota exhausted, private mode, etc. — fall back to nav clipboard.
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(json).catch(() => {});
  }
}

export function readClipboardSync(): ClipboardPayload | null {
  try {
    return parseClipboardPayload(localStorage.getItem(CLIPBOARD_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Async path used by the paste handler — falls back to
 * `navigator.clipboard.readText` when localStorage is empty so a user
 * who copied in tab A can paste in tab B.
 */
export async function readClipboard(): Promise<ClipboardPayload | null> {
  const sync = readClipboardSync();
  if (sync) return sync;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
    try {
      const text = await navigator.clipboard.readText();
      return parseClipboardPayload(text);
    } catch {
      return null;
    }
  }
  return null;
}

export function clearClipboard(): void {
  try {
    localStorage.removeItem(CLIPBOARD_STORAGE_KEY);
  } catch {
    // ignore
  }
}
