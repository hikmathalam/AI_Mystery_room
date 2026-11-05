# Testing and Quality Checks

Run from the repository root after `npm install`:

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

`npm run lint` runs Biome on application and test source. `npm run typecheck` checks the shared, server, and client workspaces. `npm test` runs schema, AI-output validation, investigation scoring/progress, and authenticated API tests. The API tests mock Mongo models and do not need a running database or Gemini key.

The Playwright journey uses deterministic mock API responses and runs in desktop and mobile Chromium projects. If the local browser binary is missing, install the headless Chromium shell with:

```sh
npx playwright install chromium --only-shell
```

The browser journey covers registration, case generation status, evidence and suspect review, confidence ratings, evidence-board placement/connections, timeline filters, journal autosave, accusation, verdict, and returning to the archive. It does not call MongoDB or Gemini.

For a manual integration check, start the app with `npm run dev`, set the required values from `.env.example`, then verify the API health endpoint and create a case with a live Gemini key. Do not commit `.env` or test credentials.
