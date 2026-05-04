#!/usr/bin/env bash
# WP-A04 optional post-deploy probe: curls evidence-package when base URL + model id are provided.
set -euo pipefail

if [[ -z "${BIM_AI_EVIDENCE_PROBE_BASE_URL:-}" || -z "${BIM_AI_EVIDENCE_PROBE_MODEL_ID:-}" ]]; then
  echo "Skipping evidence-package probe (set BIM_AI_EVIDENCE_PROBE_BASE_URL and BIM_AI_EVIDENCE_PROBE_MODEL_ID)." >&2
  exit 0
fi

base="${BIM_AI_EVIDENCE_PROBE_BASE_URL%/}"
mid="${BIM_AI_EVIDENCE_PROBE_MODEL_ID}"

tmp="$(mktemp)"
cleanup() {
  rm -f "$tmp"
}

trap cleanup EXIT

curl -sfS "${base}/api/models/${mid}/evidence-package" -o "$tmp"

read -r semantic_digest artifact_basename semantic_prefix < <(
  python3 -c "
import json, sys

with open(sys.argv[1], encoding='utf-8') as fh:
    d = json.load(fh)
dig = str(d.get('semanticDigestSha256') or '').strip()
base = str(d.get('suggestedEvidenceArtifactBasename') or '').strip()
pre = str(d.get('semanticDigestPrefix16') or '').strip()
print(dig, base, pre)
" "$tmp"
)

if [[ -z "${semantic_digest}" ]]; then
  echo "evidence-package response missing semanticDigestSha256" >&2
  exit 1
fi

if [[ -z "${artifact_basename}" ]]; then
  echo "evidence-package response missing suggestedEvidenceArtifactBasename" >&2
  exit 1
fi

if [[ -z "${semantic_prefix}" ]]; then
  echo "evidence-package response missing semanticDigestPrefix16" >&2
  exit 1
fi

echo "evidence-package probe OK for ${base}/api/models/…/evidence-package"
echo "semanticDigestSha256=${semantic_digest}"
echo "semanticDigestPrefix16=${semantic_prefix}"
echo "suggestedEvidenceArtifactBasename=${artifact_basename}"
