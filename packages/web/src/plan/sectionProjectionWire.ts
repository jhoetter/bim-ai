/** Fetch `GET /models/{modelId}/projection/section/{sectionCutId}` primitives. */

export async function fetchSectionProjectionWire(
  modelId: string,
  sectionCutId: string,
): Promise<Record<string, unknown>> {
  const url = `/api/models/${encodeURIComponent(modelId)}/projection/section/${encodeURIComponent(sectionCutId)}`;
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${txt}`);
  return JSON.parse(txt) as Record<string, unknown>;
}
