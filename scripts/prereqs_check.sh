#!/usr/bin/env bash
set -euo pipefail

# Simple local prerequisites checker for deployment

echo "Checking prerequisites..."

# SSH key
if [ -f "$HOME/.ssh/veklom-deploy" ]; then
  echo "SSH key found: $HOME/.ssh/veklom-deploy"
else
  echo "WARNING: SSH key $HOME/.ssh/veklom-deploy not found"
fi

# bash
if command -v bash >/dev/null 2>&1; then
  echo "bash: OK"
else
  echo "ERROR: bash not found in PATH"
fi

# npx
if command -v npx >/dev/null 2>&1; then
  echo "npx: OK"
else
  echo "WARNING: npx not found"
fi

# node
if command -v node >/dev/null 2>&1; then
  echo "node: OK ($(node -v))"
else
  echo "WARNING: node not found"
fi

# tsx
if npx -y tsx --version >/dev/null 2>&1; then
  echo "tsx: OK"
else
  echo "WARNING: tsx (npx tsx) not available"
fi

# curl
if command -v curl >/dev/null 2>&1; then
  echo "curl: OK"
else
  echo "WARNING: curl not found"
fi

echo "Prereqs check done."