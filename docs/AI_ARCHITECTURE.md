# AI Generation Architecture

All Gemini requests originate in `server/src/ai/geminiProvider.ts`. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` on the server. The provider uses Google's `models.generateContent` JSON response mode with a server-side timeout and up to three attempts with exponential backoff for transient network, overload, and rate-limit errors. Versioned prompt modules live in `server/src/ai/prompts/`.

1. Validate the scenario and preferences, then analyze the premise.
2. Generate the blueprint: metadata, suspects, critical clue concepts, and a complete solution.
3. Validate required fields, the exact suspect count, unique identities, and one culprit in the suspect set.
4. Persist the ground truth in the protected `CaseSolution` collection.
5. Plan 8-12 evidence items from the locked solution and check suspect and clue references.
6. Generate evidence content in a separate call and validate every planned ID.
7. Check consistency against the locked truth and chronology. Regenerate evidence once if the review finds correctable issues.
8. Generate optional evidence images through the configured image-provider adapter. It accepts an endpoint, sends only from the server, and expects an HTTPS object-storage URL. If disabled or unavailable, the UI uses a clearly labeled simulated-media fallback.
9. Publish the case only after required evidence passes validation.

User premise text is data, never system instructions. If generation is unavailable, the case enters `FAILED` with a user-facing error; the application does not silently substitute a hardcoded mystery. An interrupted job is marked retryable at server startup and retains its locked blueprint when one already exists. The validators in `server/src/ai/validation.ts` are covered with deterministic unit tests; live provider behavior requires a configured API key.
