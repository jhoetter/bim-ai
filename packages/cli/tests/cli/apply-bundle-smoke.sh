#!/usr/bin/env bash
# CMD-V3-01 smoke test: apply-bundle round-trip.
#
# Usage:
#   BIM_AI_BASE_URL=http://127.0.0.1:8500 bash packages/cli/tests/cli/apply-bundle-smoke.sh
#
# Requires a running bim-ai server and a project already seeded.
# Exit codes: 0 pass, 1 fail.

set -euo pipefail

BASE_URL="${BIM_AI_BASE_URL:-http://127.0.0.1:8500}"
CLI="node packages/cli/cli.mjs"

echo "=== CMD-V3-01 apply-bundle smoke test ==="
echo "Base URL: $BASE_URL"

# 1. Bootstrap — pick first project + model
BOOTSTRAP=$(curl -sf "$BASE_URL/api/bootstrap")
PROJECT_ID=$(echo "$BOOTSTRAP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['projects'][0]['id'])")
echo "Project: $PROJECT_ID"

# 2. Create a fresh model
MODEL_SLUG="smoke-apply-bundle-$(date +%s)"
INIT_OUT=$(BIM_AI_BASE_URL="$BASE_URL" $CLI init-model --project-id "$PROJECT_ID" --slug "$MODEL_SLUG")
MODEL_ID=$(echo "$INIT_OUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "Model: $MODEL_ID (slug: $MODEL_SLUG)"

export BIM_AI_MODEL_ID="$MODEL_ID"
export BIM_AI_BASE_URL="$BASE_URL"

# 3. Snapshot — must be revision 1
SNAP=$(BIM_AI_BASE_URL="$BASE_URL" $CLI snapshot)
REV=$(echo "$SNAP" | python3 -c "import sys,json; print(json.load(sys.stdin)['revision'])")
if [ "$REV" != "1" ]; then
  echo "FAIL: expected revision 1 after init, got $REV" >&2
  exit 1
fi
echo "Initial revision: $REV ✓"

# 4. Build a cmd-v3.0 bundle
BUNDLE=$(python3 - <<'EOF'
import json
print(json.dumps({
    "schemaVersion": "cmd-v3.0",
    "commands": [
        {"type": "createLevel", "id": "smoke-lvl-g", "name": "Ground", "elevationMm": 0}
    ],
    "assumptions": [
        {"key": "ground_level_mm", "value": 0, "confidence": 0.9, "source": "smoke-test"}
    ],
    "parentRevision": 1,
}))
EOF
)

BUNDLE_FILE=$(mktemp /tmp/smoke-bundle-XXXXXX.json)
echo "$BUNDLE" > "$BUNDLE_FILE"
trap 'rm -f "$BUNDLE_FILE"' EXIT

# 5. Dry-run — must return applied:false, checkpointSnapshotId present
DRY=$(BIM_AI_BASE_URL="$BASE_URL" $CLI apply-bundle "$BUNDLE_FILE" --base 1 --dry-run)
APPLIED=$(echo "$DRY" | python3 -c "import sys,json; print(json.load(sys.stdin)['applied'])")
CHECKPOINT=$(echo "$DRY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('checkpointSnapshotId',''))")
if [ "$APPLIED" != "False" ] && [ "$APPLIED" != "false" ]; then
  echo "FAIL: dry-run should return applied:false, got $APPLIED" >&2
  exit 1
fi
if [ -z "$CHECKPOINT" ] || [ "$CHECKPOINT" = "None" ]; then
  echo "FAIL: dry-run did not return checkpointSnapshotId" >&2
  exit 1
fi
echo "Dry-run: applied=false, checkpointSnapshotId=${CHECKPOINT:0:16}... ✓"

# 6. Verify revision unchanged after dry-run
SNAP2=$(BIM_AI_BASE_URL="$BASE_URL" $CLI snapshot)
REV2=$(echo "$SNAP2" | python3 -c "import sys,json; print(json.load(sys.stdin)['revision'])")
if [ "$REV2" != "1" ]; then
  echo "FAIL: dry-run mutated model (revision $REV2 != 1)" >&2
  exit 1
fi
echo "Revision after dry-run: $REV2 ✓"

# 7. Commit
COMMIT=$(BIM_AI_BASE_URL="$BASE_URL" $CLI apply-bundle "$BUNDLE_FILE" --base 1 --commit)
COMMIT_APPLIED=$(echo "$COMMIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['applied'])")
NEW_REV=$(echo "$COMMIT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('newRevision',''))")
if [ "$COMMIT_APPLIED" != "True" ] && [ "$COMMIT_APPLIED" != "true" ]; then
  echo "FAIL: commit should return applied:true, got $COMMIT_APPLIED" >&2
  exit 1
fi
if [ "$NEW_REV" != "2" ]; then
  echo "FAIL: expected newRevision=2, got $NEW_REV" >&2
  exit 1
fi
echo "Commit: applied=true, newRevision=$NEW_REV ✓"

# 8. Verify revision incremented via bim-ai snapshot
SNAP3=$(BIM_AI_BASE_URL="$BASE_URL" $CLI snapshot)
REV3=$(echo "$SNAP3" | python3 -c "import sys,json; print(json.load(sys.stdin)['revision'])")
if [ "$REV3" != "2" ]; then
  echo "FAIL: expected revision 2 after commit, got $REV3" >&2
  exit 1
fi
echo "Revision after commit: $REV3 ✓"

# 9. Replay same bundle (stale parentRevision=1) → must return revision_conflict (exit 2)
set +e
BIM_AI_BASE_URL="$BASE_URL" $CLI apply-bundle "$BUNDLE_FILE" --base 1 --commit > /dev/null 2>&1
REPLAY_EXIT=$?
set -e
if [ "$REPLAY_EXIT" != "2" ]; then
  echo "FAIL: expected exit code 2 (revision_conflict) on replay, got $REPLAY_EXIT" >&2
  exit 1
fi
echo "Idempotent replay: exit code 2 (revision_conflict) ✓"

echo ""
echo "=== CMD-V3-01 smoke test PASSED ==="
