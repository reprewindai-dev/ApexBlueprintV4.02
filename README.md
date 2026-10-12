# Apex

Turns messy notes into a plan you can build: features with acceptance criteria, user flows,
architecture, data model, API, build milestones, risks, and the questions the owner still
needs to answer. Plans can be copied, downloaded as Markdown, printed to PDF, or handed to a
coding agent (Claude Code, Cursor, Codex) as a build brief.

Live site: https://apex.veklom.com (Cloudflare Pages, deployed automatically from `main`).

## Using it

1. Paste your notes and press **Write my plan**.
2. The first time, choose which AI writes your plans: Claude, OpenAI, Gemini, DeepSeek,
   Ollama on your computer, or any OpenAI-compatible server. Bring your own key.
3. Read the plan. Start with **Decide these first**: the decisions your notes leave open.

Plans are saved in your browser only. API keys are kept for the browser session unless you
tick "Remember on this device".

**Plan quality follows the model.** Large models (Claude, GPT-4o class) write the most complete
plans. Small local models work but leave gaps; Apex lists any section the model left out.

## Run locally

Requires Node.js 22.

```bash
npm install
npm run dev        # http://localhost:3000
```

### Docker

```bash
docker build -t apex .
docker run -p 3000:3000 --add-host=host.docker.internal:host-gateway apex   # http://localhost:3000
```

The image reaches an Ollama running on the same machine through `host.docker.internal`.

### Ollama

1. Install Ollama from https://ollama.com and pull a model: `ollama pull qwen2.5:14b`
   (7B and up recommended; 14B writes noticeably better plans).
2. In Apex, choose **Ollama (on your computer)**. The address defaults to `http://localhost:11434/v1`.
3. Plans are long. Give Ollama room: set `OLLAMA_CONTEXT_LENGTH=16384`.
4. **Using the hosted site (apex.veklom.com) with your own Ollama:** your browser talks to Ollama
   directly, so Ollama must allow the site once. Apex shows these steps when it is needed.
   - Windows: quit Ollama from the tray, run
     `setx OLLAMA_ORIGINS "https://apex.veklom.com,https://*.apexblueprintv4-02.pages.dev"`
     in PowerShell, start Ollama again.
   - Mac: `launchctl setenv OLLAMA_ORIGINS "https://apex.veklom.com,https://*.apexblueprintv4-02.pages.dev"`, restart Ollama.
   - Linux: start it with `OLLAMA_ORIGINS="https://apex.veklom.com,https://*.apexblueprintv4-02.pages.dev" ollama serve`.
   - Docker: add `-e OLLAMA_ORIGINS="https://apex.veklom.com,https://*.apexblueprintv4-02.pages.dev"` to the Ollama container.

   Running Apex locally (above) needs none of this.

### Settings

See `.env.example`. All settings are optional.

## How it works

| Path | What |
| --- | --- |
| `src/plan/plan.ts` | The plan format, the prompt, and parsing (missing sections are reported, never filled in) |
| `src/plan/generate.ts`, `src/plan/http.ts` | One generation path shared by the server, Cloudflare and the browser |
| `src/plan/export.ts` | Markdown and coding-agent brief |
| `src/plan/repo.ts` | Reads a public GitHub repo's file list as context |
| `src/server/blueprint-core.ts` | Provider routing; streams replies so slow models are not cut off |
| `src/App.tsx`, `src/ui/`, `src/app/` | The app |
| `functions/api/` | Cloudflare Pages Functions: `POST /api/generate`, `POST /api/check-model` |
| `server.ts` | Local server with the same two endpoints, plus `GET /healthz` |
| `src/app/ollama.ts`, `src/ui/OllamaHelp.tsx` | Diagnoses a hosted-site-to-Ollama connection and shows the one-time fix |

## Checks

- `npm run lint`: TypeScript check
- `npm test`: unit tests
- `npm run build`: production build (`dist/`)
