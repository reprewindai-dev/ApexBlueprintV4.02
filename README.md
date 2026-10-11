# Apex Blueprint

Turns messy notes into a structured software blueprint and business plan using the AI model you choose.
Output is AI-generated and should be reviewed before you rely on it.

Live site: https://apex.veklom.com (Cloudflare Pages, deployed automatically from `main`).

## Run locally (all features)

Requires Node.js 22.

1. Install dependencies: `npm install`
2. Optional: copy `.env.example` to `.env` and fill in what you use (see below).
3. Start the app: `npm run dev`
4. Open http://localhost:3000

In the app, click **LLM Engine**, pick a provider (Gemini, OpenAI, Anthropic, DeepSeek, Llama/Ollama or a custom
OpenAI-compatible URL), paste your API key, then paste your notes and click **Compile Production Payload**.

### Useful `.env` settings

| Variable | What it does |
| --- | --- |
| `GEMINI_API_KEY` | Used for Gemini when no key is entered in LLM Engine |
| `ABIDE_DEFAULT_PROVIDER` | Provider used when the request does not name one |
| `SEMANTIC_SCHOLAR_API_KEY`, `OPENALEX_API_KEY` | Avoid rate limits in citation checks (both sources work without a key but are often rate-limited) |
| `CITATION_CONTACT_EMAIL` | Contact email sent to CrossRef/OpenAlex (polite-pool access) |
| `GITHUB_TOKEN` | Lets repository analysis read private repos and avoid GitHub rate limits |
| `SEKED_HMAC_SECRET`, `CONSTITUTION_SIGNING_KEY`, `APPROVAL_TOKEN_SECRET` | Required (16+ characters each) only when running with `NODE_ENV=production` |

## Hosted site vs. local

The hosted site runs the frontend plus these Cloudflare Pages Functions (`functions/api/`), which share code with `server.ts`:

- `POST /api/generate`: blueprint compile
- `POST /api/test-connection`: check the LLM Engine settings
- `POST /api/test-harness/generate`: generate a test file for the compiled blueprint
- `POST /api/academic/search`: live arXiv + CrossRef search (keyword-ranked)
- `POST /api/academic/verify`: check a citation against arXiv, CrossRef, OpenAlex and Semantic Scholar
- `POST /api/github/analyze`: read a GitHub repo's file tree and compare it with your notes

Every other `/api/*` feature (IDE projects, covenant/approval flows, VNP auth, escrow, etc.) needs the full Node
server and returns a 501 on the hosted site. Run locally to use them. Several of those panels are simulations and are
labelled as such in the UI.

## Checks

- `npm run lint`: TypeScript check
- `npm test`: unit tests
- `npm run build`: production build (`dist/`)
