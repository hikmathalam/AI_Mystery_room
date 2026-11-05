# AI Mystery Room

An AI-powered detective investigation game built from `spec.md`. Players provide a fictional premise, inspect a generated case file, and submit one final accusation.

## Stack

- React, Vite, TypeScript, Tailwind CSS, React Router, Zustand, Axios, Framer Motion, React Hook Form, Zod, and Lucide React
- Node.js, Express, TypeScript, MongoDB, Mongoose, JWT cookies, and bcrypt
- Google Gemini through a server-only REST integration

## Run locally

1. Install Node.js 22+ and MongoDB.
2. Copy `.env.example` to `.env` and set `JWT_SECRET`, `MONGODB_URI`, and `GEMINI_API_KEY`.
3. Install dependencies with `npm install`.
4. Start both apps with `npm run dev`.
5. Open `http://localhost:5173`.

The API listens at `http://localhost:4000/api/v1`; during local development, Vite proxies `/api/v1` requests to it so the browser uses one origin. Keep the frontend on the URL printed by Vite. The server requires a database URI and a sufficiently long JWT secret. Case generation reports a clear error if Gemini is unavailable. Photo and video evidence can use an optional image-provider endpoint that accepts `{ "prompt", "caseId", "evidenceId" }` and returns an object-storage URL. Without it, the app labels media as simulated and does not store large binaries in MongoDB.

## Project map

- `client/` - responsive investigation UI and API client
- `server/` - auth, ownership-checked case APIs, generation jobs, models, and verdict scoring
- `shared/` - shared request schemas and case types
- `docs/` - API, database, AI pipeline, and testing notes
- `DEVELOPMENT_STATUS.md` - implementation and verification status

## Quality checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

See [docs/TESTING.md](docs/TESTING.md) for what each check covers and how to prepare the browser runner.

## Security model

Authentication uses an HTTP-only JWT cookie. Every case operation checks ownership. Ground truth lives in the separate `CaseSolution` collection and is excluded from case, suspect, evidence, and investigation responses. The result endpoint can return it only after the accusation has been submitted. All scenarios and evidence are fictional.
