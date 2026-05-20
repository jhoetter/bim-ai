export const base = (
  process.env.BIM_AI_BASE_URL ??
  process.env.BIM_AI_API_ROOT ??
  'http://127.0.0.1:8500'
).replace(/\/$/, '');

export function wsUrl(modelId) {
  const u = new URL(base);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = `/ws/${encodeURIComponent(modelId)}`;
  u.search = '';
  return u.href;
}

export async function fetchJson(method, url, bodyObj) {
  const res = await fetch(url, {
    method,
    headers: bodyObj ? { 'content-type': 'application/json' } : undefined,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, body: json }, null, 2));
    process.exit(1);
  }
  return json;
}

export async function fetchJsonResponse(method, url, bodyObj) {
  const res = await fetch(url, {
    method,
    headers: bodyObj ? { 'content-type': 'application/json' } : undefined,
    body: bodyObj ? JSON.stringify(bodyObj) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, body: json };
}

export async function fetchJsonResponseNoThrow(method, url, bodyObj) {
  try {
    return await fetchJsonResponse(method, url, bodyObj);
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: { error: error?.message ?? String(error) },
    };
  }
}

export async function fetchOkText(method, url) {
  const res = await fetch(url, {
    method,
    headers: { accept: 'model/gltf+json,application/json,text/plain;q=0.9,*/*;q=0.1' },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, sample: text.slice(0, 2000) }, null, 2));
    process.exit(1);
  }
  return text;
}

export async function fetchOkBytes(method, url) {
  const res = await fetch(url, {
    method,
    headers: {
      accept: 'application/octet-stream,model/gltf-binary,*/*;q=0.8',
    },
  });
  const buf = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    console.error(JSON.stringify({ status: res.status, bytes: buf.length }, null, 2));
    process.exit(1);
  }
  return buf;
}

export async function snapshot(modelId) {
  const json = await fetchJson('GET', `${base}/api/models/${encodeURIComponent(modelId)}/snapshot`);
  console.log(JSON.stringify(json, null, 2));
}
