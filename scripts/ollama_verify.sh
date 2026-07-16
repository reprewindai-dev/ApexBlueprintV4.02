#!/usr/bin/env bash
set -euo pipefail

# ollama_verify.sh — verify local Ollama instance and models
# Usage: run on the Hetzner host as root or a user with curl

BASE=${1:-http://localhost:11434}

echo "Checking Ollama at ${BASE}"

# 1) Get tags / models
echo "Models and tags:" 
curl -sS "${BASE}/api/tags" | jq . || true

# 2) Quick exec test
echo "Running a short exec test (expect JSON-like response)..."
RESP=$(curl -sS -X POST "${BASE}/v1/exec" -H "Content-Type: application/json" -d '{"prompt":"Respond with JSON: {\"ok\":true, \"message\": \"pong\"}","model":"llama3","use_memory":false,"max_tokens":50,"temperature":0.1}') || true

echo "Exec raw response (first 500 chars):"
echo "$RESP" | head -c 500 | sed 's/\n/ /g'

echo "\nIf the response shows model output, Ollama is healthy. If not, check ollama logs and service status."

echo "Service logs (last 200 lines):"
journalctl -u ollama --no-pager -n 200 || true

