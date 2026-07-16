#!/usr/bin/env bash
set -euo pipefail

# remote_deploy_and_test.sh
# Runs the deploy helper on Hetzner, verifies Ollama on the host,
# and runs the local Veklom integration test if VEKLOM_API_KEY is set locally.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SSH_KEY="$HOME/.ssh/veklom-deploy"
HOST="root@5.78.135.11"
DEPLOY_SCRIPT="${ROOT_DIR}/scripts/deploy_apex.sh"
OLLAMA_SCRIPT="${ROOT_DIR}/scripts/ollama_verify.sh"
INTEGRATION_SCRIPT="${ROOT_DIR}/scripts/veklom_integration_test.ts"

if [ ! -x "${DEPLOY_SCRIPT}" ]; then
  echo "Making deploy script executable"
  chmod +x "${DEPLOY_SCRIPT}"
fi
if [ ! -x "${OLLAMA_SCRIPT}" ]; then
  chmod +x "${OLLAMA_SCRIPT}" || true
fi

echo "==> Step 1: Deploying to Hetzner (this will SSH using ${SSH_KEY})"
bash "${DEPLOY_SCRIPT}"

echo "\n==> Step 2: Verifying Ollama on the host via the remote script"
# Stream the ollama script to the remote host and run it there so it uses localhost on the host
ssh -i "${SSH_KEY}" "${HOST}" 'bash -s' < "${OLLAMA_SCRIPT}"

# Step 3: If VEKLOM_API_KEY present locally, run integration test locally
if [ -n "${VEKLOM_API_KEY-}" ]; then
  echo "\n==> Step 3: Running local Veklom integration test using local VEKLOM_API_KEY"
  echo "(This requires node and tsx installed locally.)"
  npx tsx "${INTEGRATION_SCRIPT}"
else
  echo "\n==> Step 3: Skipping local integration test — VEKLOM_API_KEY not set locally."
  echo "To run the integration test locally run:"
  echo "  VEKLOM_API_KEY=byos_xxx npx tsx ${INTEGRATION_SCRIPT}"
fi

echo "\nAll done. If anything failed above, inspect the output and rerun the failing step."