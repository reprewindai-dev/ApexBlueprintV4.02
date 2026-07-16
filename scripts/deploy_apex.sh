#!/usr/bin/env bash
set -euo pipefail

# deploy_apex.sh — safe deploy helper for Hetzner / Coolify app
# Usage: run locally (from your workstation) or on the Hetzner host.
# Run: ./scripts/deploy_apex.sh

APP_DIR=/data/coolify/applications/n13gp1nhrcdp0hvazvbnlxru
CONTAINER_NAME=n13gp1nhrcdp0hvazvbnlxru-213557155694
IMAGE_NAME=veklom-local:latest
GIT_REMOTE=origin
GIT_BRANCH=main
SSH_KEY="$HOME/.ssh/veklom-deploy"
HOST=root@5.78.135.11

echo "Deploy helper starting — target: ${HOST}:${APP_DIR}"

# 1) Sync code on remote and build image
ssh -i "${SSH_KEY}" "${HOST}" bash -s <<'REMOTE'
set -euo pipefail
APP_DIR=/data/coolify/applications/n13gp1nhrcdp0hvazvbnlxru
CONTAINER_NAME=n13gp1nhrcdp0hvazvbnlxru-213557155694
IMAGE_NAME=veklom-local:latest
cd "${APP_DIR}"

echo "Pulling latest code..."
git fetch --all --prune
git reset --hard origin/main

echo "Building Docker image: ${IMAGE_NAME}"
docker build -t ${IMAGE_NAME} . | tee /tmp/deploy_build.log

# 2) Stop and remove old container
echo "Stopping old container (if exists)..."
docker ps -a --format '{{.Names}}' | grep -q "${CONTAINER_NAME}" && docker stop ${CONTAINER_NAME} || true
docker ps -a --format '{{.Names}}' | grep -q "${CONTAINER_NAME}" && docker rm ${CONTAINER_NAME} || true

# 3) Run new container with Coolify network and env-file
if [ -f "${APP_DIR}/.env" ]; then
  ENV_ARG="--env-file ${APP_DIR}/.env"
else
  echo "Warning: ${APP_DIR}/.env not found — container will start without .env file"
  ENV_ARG=""
fi

docker run -d \
  --name ${CONTAINER_NAME} \
  --network coolify \
  ${ENV_ARG} \
  --restart unless-stopped \
  ${IMAGE_NAME}

# 4) Give container a moment, then show logs and health
sleep 4

echo "Container status:" 
if docker ps --format '{{.Names}}' | grep -q "${CONTAINER_NAME}"; then
  docker ps --filter "name=${CONTAINER_NAME}" --format 'Name: {{.Names}} Image: {{.Image}} Status: {{.Status}}'
  docker logs --tail 200 ${CONTAINER_NAME} || true
else
  echo "ERROR: container failed to start. Inspect /tmp/deploy_build.log and docker logs on server."
fi
REMOTE

# 5) Post-deploy verification (local curl against server loopback via SSH)
echo "Verifying service via SSH curl (server-side)..."
ssh -i "${SSH_KEY}" "${HOST}" "curl -sS http://localhost:80/health || curl -sk https://localhost/health -H 'Host: veklom.com' || true"

echo "Deploy helper finished. If you saw HTTP 200 healthy JSON, deployment succeeded."