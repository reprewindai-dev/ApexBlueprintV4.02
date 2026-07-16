# Deploy README — ApexBlueprintV4

Purpose: step-by-step instructions to deploy Apex to Hetzner/Coolify using the provided helper scripts.

Prerequisites (on your workstation):
- SSH key at `~/.ssh/veklom-deploy` with access to `root@5.78.135.11`
- `bash` available (Git Bash or WSL on Windows)
- `docker` installed on the remote Hetzner host (Coolify manages containers)
- `npx` and Node installed locally (for running the integration test)
- `tsx` available via `npx tsx` (no global install required)

Files:
- `scripts/deploy_apex.sh` — SSH -> pull -> build -> run container -> show logs
- `scripts/ollama_verify.sh` — runs on the server to validate Ollama service and logs
- `scripts/remote_deploy_and_test.sh` — wrapper that runs deploy and remote Ollama verify; optionally runs local integration test if `VEKLOM_API_KEY` present locally

Recommended flow (copy-paste):

1) Make scripts executable once:

```bash
cd C:\Users\antho\.windsurf\ApexBlueprintV4
chmod +x scripts/deploy_apex.sh scripts/ollama_verify.sh scripts/remote_deploy_and_test.sh
```

2) Run the full wrapper (this will SSH to the host):

```bash
./scripts/remote_deploy_and_test.sh
```

3) If the wrapper fails, inspect the server logs shown by the deploy script.

Running the local Veklom integration test (optional):

```bash
# safer: pass the key on the command line (do not paste it into chat)
VEKLOM_API_KEY=byos_xxx npx tsx scripts/veklom_integration_test.ts
```

If you want, run the wrapper and paste the terminal output here and I'll analyze failures and next steps.