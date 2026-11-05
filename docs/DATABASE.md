# Database Design

The API uses MongoDB through Mongoose. Set `MONGODB_URI` in the root `.env` file; the server loads that file when it starts. Mongoose adds `_id`, `createdAt`, and `updatedAt` fields where the model enables timestamps. References are ObjectIds, while generated suspect and evidence records also have stable case-local string IDs for API and UI use.

## Collections

| Model | Stored data |
|---|---|
| `User` | `name`, normalized unique `email`, `passwordHash`, and `avatar`. The password hash is excluded from ordinary queries. |
| `Case` | Owner (`userId`), premise (`originalScenario`), genre, difficulty, status, title and description, setting and incident details, and generation progress/error metadata. Internal generation analysis, blueprint, and evidence plan fields are excluded from ordinary queries. |
| `Suspect` | A case-local `suspectId` and the public profile: name, age, occupation, relationship, background, public motive, public alibi, personality, and optional profile image. The model has no culprit or hidden-truth field. |
| `Evidence` | A case-local `evidenceId`, category, title, description, content, observations, clue text, source, timestamp, related suspect IDs, reliability, and optional media metadata. `isSimulatedMedia` identifies fallback media. |
| `CaseSolution` | Private answer key: culprit ID, motive and matching terms, actual timeline, full explanation, critical clues and evidence IDs, red-herring explanations, and innocence explanations. There is one solution per case. |
| `Investigation` | One owner's work on a case: notes, progress, bookmarked and reviewed items, journal entries, evidence-board nodes and edges, suspect confidence ratings, and (after submission) accusation, score, score breakdown, and verdict. |

Journal entries and board nodes/edges are embedded subdocuments without their own MongoDB `_id`; each has a client-generated stable string ID. Suspect/evidence links inside those structures use the case-local string IDs, not MongoDB ObjectIds.

## Indexes and uniqueness

Mongoose declares these indexes in the model schemas:

| Collection | Index | Purpose |
|---|---|---|
| `User` | Unique `email` | Prevent duplicate accounts after lowercasing and trimming. |
| `Case` | `userId`; `status`; compound `{ userId, createdAt: -1 }` | Find a user's cases, query generation states, and list newest cases first. |
| `Suspect` | `caseId`; unique compound `{ caseId, suspectId }` | Fetch a case's suspects and keep case-local IDs unique. |
| `Evidence` | `caseId`; unique compound `{ caseId, evidenceId }` | Fetch a case's exhibits and keep case-local IDs unique. |
| `CaseSolution` | Unique `caseId` | Enforce one answer key per case. |
| `Investigation` | `caseId`; `userId`; unique compound `{ caseId, userId }` | Query a case owner's investigation and enforce one record per owner/case. |

Mongoose schema declarations describe the indexes; deployments should ensure indexes are built in the target database before relying on uniqueness constraints.

## Privacy and access rules

- Routes first verify that the authenticated user owns the case before reading or changing case data.
- Public case, suspect, and evidence responses are built from allowlisted fields. Do not serialize raw Mongoose documents for these resources.
- `CaseSolution` is accessed by generation and verdict logic. Its fields must not be exposed before an accusation is submitted. The verdict is saved to the owner's `Investigation` record only as part of the submission flow and is returned through result routes.
- Notes, journal entries, board state, confidence ratings, and progress belong to the owner/case investigation record. An investigation becomes read-only after final submission.
- Never commit `.env` or log its contents. It contains the MongoDB connection string and other server credentials.

## Lifecycle and cleanup

Case generation writes the solution separately from public suspect and evidence records. Failed or interrupted generation is recorded on the `Case`; at server startup, cases left in `GENERATING` are marked `FAILED` so the owner can retry them.

Deleting a case explicitly deletes its solution, suspects, evidence, and investigation along with the case record. These deletes run as separate MongoDB operations in parallel, not as a multi-document transaction. There is no database-level foreign-key cascade, so any new case-owned collection must also be added to the delete handler.
