<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/12adbbc2-9ab0-4f1e-8b65-57b75c9b40d0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the required environment variables in [.env.local](.env.local)
   - `GEMINI_API_KEY` for Gemini calls
   - `SEKED_HMAC_SECRET`, `CONSTITUTION_SIGNING_KEY`, and `APPROVAL_TOKEN_SECRET` for signed workflows
   - `VITE_VEKLOM_API_URL`, `VITE_CAPPO_URL`, `VITE_GNOMELEDGER_URL`, `VITE_VNP_URL` for browser-visible backend URLs
3. Run the app:
   `npm run dev`

## Tests
- Run `npm test` for the deterministic suite.
- Set `RUN_LIVE_VEKLOM_TESTS=true` only when you want the optional external integration checks to execute.
