# API Reference

Base URL: `/api/v1`. Authenticated routes use an HTTP-only JWT cookie and verify case ownership.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Start a session |
| POST | `/auth/logout` | Clear the session cookie |
| GET | `/auth/me` | Return the current user |
| POST | `/cases` | Create an asynchronous generation job |
| GET | `/cases?page=1&limit=12&q=` | List the current user's cases with search and pagination |
| GET | `/cases/:caseId` | Return public case information |
| GET | `/cases/:caseId/status` | Read persisted generation status |
| GET | `/cases/:caseId/generation-status` | Read generation status (compatibility route) |
| POST | `/cases/:caseId/generate` | Retry a failed generation job |
| DELETE | `/cases/:caseId` | Delete an owned case |
| GET | `/cases/:caseId/suspects` | List suspects without hidden facts |
| GET | `/cases/:caseId/suspects/:suspectId` | Read a public suspect profile |
| GET | `/cases/:caseId/evidence` | List fictional evidence |
| GET | `/cases/:caseId/evidence/:evidenceId` | Read one evidence item |
| POST | `/cases/:caseId/evidence/:evidenceId/bookmark` | Mark an exhibit important |
| DELETE | `/cases/:caseId/evidence/:evidenceId/bookmark` | Remove an exhibit bookmark |
| GET | `/cases/:caseId/investigation` | Load private notes and investigation progress |
| PATCH | `/cases/:caseId/investigation/notes` | Save the scratchpad notes |
| PATCH | `/cases/:caseId/investigation/journal` | Save categorized journal entries and references |
| PATCH | `/cases/:caseId/investigation/board` | Save evidence-board nodes and connections |
| PATCH | `/cases/:caseId/investigation/confidence` | Save confidence ratings for suspects |
| PATCH | `/cases/:caseId/investigation/progress` | Save reviewed exhibits, reviewed suspects, timeline state, and bookmarks |
| POST | `/cases/:caseId/accusation` | Submit the single final accusation |
| GET | `/cases/:caseId/result` | Reveal the solution after submission |
| GET | `/users/me/statistics` | Return dashboard totals |

The cases list accepts `page` (minimum 1), `limit` (1-50, default 12), and `q` (up to 80 characters). Search is escaped before it is used as a regular expression.

Generation status reflects persisted pipeline progress. Ground truth is stored separately and the accusation response is the first response allowed to include it. Journal, board, confidence, and progress writes are validated against the user's owned case and become read-only after submission.
