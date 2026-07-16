# Coolify Environment Checklist for Apex Backend

Add these secrets/variables in the Coolify app settings (Environment Variables):

- `PORT` = `80`
- `NODE_ENV` = `production`

Provider-specific (choose one or multiple as required):
- `VEKLOM_API_KEY` = `byos_<key>` (keep secret)
- `VEKLOM_BASE_URL` = `https://api.veklom.com`
- `VEKLOM_MODEL` = `qwen2.5:3b`

Ollama local (only if using Ollama and reachable from backend container):
- `OLLAMA_BASE_URL` = `http://host.docker.internal:11434`  # try this first
- `OLLAMA_MODEL` = `llama3`
- `VEKLOM_AGENT_PROVIDER` = `ollama`  # optional, UI default

Traefik / proxy notes:
- Ensure Coolify is routing hostnames `api.veklom.com` → app container port `80`.
- If backend container uses internal port other than 80, set `PORT` accordingly.

Secrets:
- Add `HETZNER_SSH_KEY` to repository secrets if GitHub Actions will run remote commands.

Restart & Deploy:
- After updating env vars, redeploy the Coolify app or trigger a GitHub push to `main`.

Verification:
- After deploy, run `curl -sk https://localhost/health -H "Host: veklom.com"` on the server (or use the Deploy helper script).