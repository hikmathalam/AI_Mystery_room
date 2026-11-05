import { expect, test, type Page } from "@playwright/test";
import type { PublicInvestigation } from "../../shared/src/index.js";

const caseId = "case-e2e-0001";
const suspects = [
  { id: "db-s1", suspectId: "S-1", fullName: "Ari Vale", age: 38, occupation: "Archivist", relationship: "Museum curator's assistant", background: "A careful archivist who catalogues every item in the observatory.", publicMotive: "A dispute over an old document.", publicAlibi: "Says they stayed in the reading room.", personality: "Measured and exacting.", profileImage: "" },
  { id: "db-s2", suspectId: "S-2", fullName: "Mina Sol", age: 42, occupation: "Security lead", relationship: "Responsible for the building's night shift", background: "A veteran security lead who knows the building's alarm system.", publicMotive: "A recent disagreement with the curator.", publicAlibi: "Says they made a perimeter check.", personality: "Direct and observant.", profileImage: "" },
  { id: "db-s3", suspectId: "S-3", fullName: "Jon Bell", age: 35, occupation: "Astronomer", relationship: "Visiting researcher", background: "A visiting researcher with an interest in the observatory's records.", publicMotive: "Wanted access to a restricted chart.", publicAlibi: "Says they left before closing.", personality: "Curious and impatient.", profileImage: "" }
];
const evidence = Array.from({ length: 8 }, (_, index) => ({
  id: `db-ex-${index + 1}`, evidenceId: `EX-${index + 1}`, title: index === 0 ? "Observatory shift log" : `Archive exhibit ${index + 1}`,
  category: index === 1 ? "CHAT" : index === 2 ? "CCTV" : "DOCUMENT", description: `A fictional case record for the observatory, exhibit ${index + 1}.`,
  content: "The record shows a timed visit to the archive shortly before the key disappeared.", observations: ["The recorded minute is legible."], clueText: "Compare the time to each person's account.",
  source: "Observatory archive", timestamp: `2026-10-14 20:${String(40 + index).padStart(2, "0")}`, relatedSuspectIds: [index % 2 ? "S-2" : "S-1"],
  reliability: "HIGH", isSimulatedMedia: index === 2, mediaUrl: ""
}));

function initialInvestigation(): PublicInvestigation {
  return {
    notes: "", progress: 0, markedEvidence: [], examinedEvidenceIds: [], investigatedSuspectIds: [], timelineReviewed: false,
    journalEntries: [], board: { nodes: [], edges: [] }, confidenceRatings: [], isSubmitted: false
  };
}

async function mockApi(page: Page) {
  let created = false;
  let caseStatus = "GENERATING";
  const investigation = initialInvestigation();
  let result: Record<string, unknown> | null = null;
  let savedJournal = false;
  let savedBoard = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname.replace("/api/v1", "");
    const reply = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const currentCase = { id: caseId, title: "The Observatory Key", description: "A brass key vanished from a locked archive during a private evening.", genre: "Murder Mystery", difficulty: "Medium", status: caseStatus, suspectCount: suspects.length, generationProgress: caseStatus === "GENERATING" ? 60 : 100, generationStage: caseStatus === "GENERATING" ? "Writing fictional evidence" : "Case ready", location: "North observatory", incidentDate: "2026-10-14", incidentTime: "21:00", investigationObjective: "Find whose account does not fit the exhibits.", incident: { subject: "Missing observatory key", summary: "A brass key disappeared during a private evening.", background: "The archive was locked after closing." }, createdAt: "2026-10-14T00:00:00.000Z" };

    if (path === "/auth/me" && method === "GET") return reply({ success: false, message: "Please sign in to continue.", code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" && method === "POST") return reply({ success: true, user: { id: "user-e2e", name: "Test Detective", email: "detective@example.com", avatar: "" } }, 201);
    if (path === "/auth/login" && method === "POST") return reply({ success: true, user: { id: "user-e2e", name: "Test Detective", email: "detective@example.com", avatar: "" } });
    if (path === "/auth/logout" && method === "POST") return reply({ success: true });
    if (path === "/users/me/statistics" && method === "GET") return reply({ success: true, statistics: { totalCases: created ? 1 : 0, solvedCases: result ? 1 : 0, activeCases: created && !result ? 1 : 0, averageScore: result ? 100 : 0 } });
    if (path === "/cases" && method === "GET") return reply({ success: true, cases: created ? [{ ...currentCase, status: caseStatus === "GENERATING" ? "READY" : caseStatus }] : [], page: 1, pageSize: 12, total: created ? 1 : 0, totalPages: 1 });
    if (path === "/cases" && method === "POST") { created = true; caseStatus = "GENERATING"; return reply({ success: true, case: currentCase }, 202); }
    if (path === `/cases/${caseId}/status` && method === "GET") { await new Promise((resolve) => setTimeout(resolve, 700)); caseStatus = "READY"; return reply({ success: true, case: { ...currentCase, status: "READY", generationProgress: 100, generationStage: "Case ready" } }); }
    if (path === `/cases/${caseId}` && method === "GET") return reply({ success: true, case: { ...currentCase, status: caseStatus } });
    if (path === `/cases/${caseId}/suspects` && method === "GET") return reply({ success: true, suspects });
    if (path === `/cases/${caseId}/evidence` && method === "GET") return reply({ success: true, evidence });
    if (path === `/cases/${caseId}/investigation` && method === "GET") return reply({ success: true, investigation });
    if (path === `/cases/${caseId}/investigation/progress` && method === "PATCH") {
      const body = route.request().postDataJSON();
      if (body.examinedEvidenceId && !investigation.examinedEvidenceIds.includes(body.examinedEvidenceId)) investigation.examinedEvidenceIds.push(body.examinedEvidenceId);
      if (body.investigatedSuspectId && !investigation.investigatedSuspectIds.includes(body.investigatedSuspectId)) investigation.investigatedSuspectIds.push(body.investigatedSuspectId);
      if (body.timelineReviewed !== undefined) investigation.timelineReviewed = body.timelineReviewed;
      return reply({ success: true, investigation });
    }
    if (path === `/cases/${caseId}/investigation/notes` && method === "PATCH") { investigation.notes = route.request().postDataJSON().notes; return reply({ success: true, notes: investigation.notes }); }
    if (path === `/cases/${caseId}/investigation/journal` && method === "PATCH") { investigation.journalEntries = route.request().postDataJSON().entries; savedJournal = true; return reply({ success: true, journalEntries: investigation.journalEntries }); }
    if (path === `/cases/${caseId}/investigation/board` && method === "PATCH") { investigation.board = route.request().postDataJSON(); savedBoard = true; return reply({ success: true, board: investigation.board }); }
    if (path === `/cases/${caseId}/investigation/confidence` && method === "PATCH") { investigation.confidenceRatings = route.request().postDataJSON().ratings; return reply({ success: true, confidenceRatings: investigation.confidenceRatings }); }
    if (path.startsWith(`/cases/${caseId}/evidence/`) && path.endsWith("/bookmark") && method === "POST") { const id = path.split("/").at(-2)!; if (!investigation.markedEvidence.includes(id)) investigation.markedEvidence.push(id); return reply({ success: true, markedEvidence: investigation.markedEvidence }); }
    if (path.startsWith(`/cases/${caseId}/evidence/`) && path.endsWith("/bookmark") && method === "DELETE") { const id = path.split("/").at(-2)!; investigation.markedEvidence = investigation.markedEvidence.filter((item) => item !== id); return reply({ success: true, markedEvidence: investigation.markedEvidence }); }
    if (path === `/cases/${caseId}/accusation` && method === "POST") {
      investigation.isSubmitted = true;
      caseStatus = "SOLVED";
      result = { isCorrect: true, score: 100, scoreBreakdown: { culprit: 50, motive: 20, evidence: 20, timeline: 10 }, explanation: "Ari Vale took the key to conceal an old record.", motive: "The archive contained a record Ari wanted to hide.", selectedSuspect: { suspectId: "S-1", name: "Ari Vale" }, culprit: { suspectId: "S-1", name: "Ari Vale" }, importantClues: [{ evidenceId: "EX-1", title: evidence[0].title, clue: "The log conflicts with the alibi." }], actualTimeline: [{ time: "20:50", event: "Ari entered the archive." }], redHerringExplanations: [], suspectInnocenceExplanations: [] };
      return reply({ success: true, verdict: result });
    }
    if (path === `/cases/${caseId}/result` && method === "GET") return result ? reply({ success: true, result }) : reply({ success: false, message: "Submit your final accusation first." }, 403);
    return reply({ success: false, message: `Unexpected E2E request: ${method} ${path}` }, 404);
  });
  return { get savedJournal() { return savedJournal; }, get savedBoard() { return savedBoard; } };
}

test("a detective registers, opens a case, investigates, builds a theory, and reads the verdict", async ({ page }) => {
  const api = await mockApi(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /every mystery/i })).toBeVisible();
  await page.getByRole("link", { name: /get started/i }).click();
  await page.getByPlaceholder("How should we address you?").fill("Test Detective");
  await page.getByPlaceholder("you@example.com").fill("detective@example.com");
  await page.getByPlaceholder("At least 10 characters").fill("correct-horse-battery");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByRole("heading", { name: /good to see you/i })).toBeVisible();

  await page.getByRole("link", { name: /open a new case/i }).click();
  await page.getByPlaceholder(/the night the museum/i).fill("A brass key vanished from a locked observatory archive during a private evening. Three people had access, and the shift log does not match one of their accounts.");
  await page.getByRole("button", { name: /generate mystery/i }).click();
  await expect(page).toHaveURL(new RegExp(`/cases/${caseId}/generating`));
  await expect(page.getByRole("heading", { name: "The Observatory Key" })).toBeVisible();

  await page.getByRole("button", { name: "Exhibit archive" }).click();
  const exhibitReviewed = page.waitForResponse((response) => response.url().includes("/investigation/progress") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: /Observatory shift log/ }).click();
  await exhibitReviewed;
  await expect(page.getByRole("dialog", { name: /Observatory shift log/ })).toBeVisible();
  await page.locator(".modal-backdrop-dismiss").click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Case dossier" }).click();
  const suspectReviewed = page.waitForResponse((response) => response.url().includes("/investigation/progress") && response.request().method() === "PATCH");
  await page.getByRole("button", { name: /Ari Vale/ }).first().click();
  await suspectReviewed;
  await expect(page.getByRole("dialog", { name: /Ari Vale/ })).toBeVisible();
  await page.getByRole("button", { name: "Close profile" }).click();

  const confidence = page.getByRole("slider", { name: "Your confidence in Ari Vale" });
  await confidence.fill("80");
  await page.getByRole("button", { name: "Evidence board" }).click();
  await page.getByLabel("Add a discovered item").selectOption("evidence:EX-1");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByLabel("Add a discovered item").selectOption("suspect:S-1");
  await page.getByRole("button", { name: "Add card" }).click();
  await page.getByRole("button", { name: "Add annotation" }).click();
  await page.getByRole("textbox", { name: "Board annotation" }).fill("The log time contradicts the account.");
  const source = page.locator(".react-flow__node-case").nth(0).locator(".react-flow__handle-right");
  const target = page.locator(".react-flow__node-case").nth(1).locator(".react-flow__handle-left");
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(sourceBox!.x + sourceBox!.width / 2, sourceBox!.y + sourceBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + targetBox!.width / 2, targetBox!.y + targetBox!.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
  await expect.poll(() => api.savedBoard).toBe(true);
  if (page.viewportSize()?.width && page.viewportSize()!.width < 600) {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByRole("button", { name: "Timeline" }).click();
  await page.getByLabel("EXHIBIT CATEGORY").selectOption("DOCUMENT");
  await page.getByLabel("PEOPLE OF INTEREST").selectOption("S-1");
  await page.getByRole("button", { name: "Detective journal" }).click();
  await page.getByRole("button", { name: "New entry" }).click();
  await page.getByLabel("ENTRY TITLE").fill("The time discrepancy");
  await page.getByLabel("YOUR NOTES").fill("Ari's account does not match the shift log.");
  await page.locator(".journal-reference-grid fieldset").first().locator("input").check();
  await expect.poll(() => api.savedJournal).toBe(true);
  await expect(page.getByText("AUTOSAVED")).toBeVisible();

  await page.getByRole("button", { name: "Make an accusation" }).click();
  await page.locator(".accusation-suspect").first().click();
  await page.locator(".accusation-textarea").fill("Ari took the key to conceal the record; the shift log conflicts with the stated alibi.");
  await page.locator(".support-evidence").first().locator("input").check();
  await page.getByLabel(/i understand this is my final accusation/i).check();
  await page.getByRole("button", { name: /submit accusation/i }).click();
  await expect(page.getByRole("heading", { name: /case solved/i })).toBeVisible();
  await expect(page.getByText("Ari Vale").first()).toBeVisible();
  expect(pageErrors).toEqual([]);

  await page.getByRole("link", { name: /return to case archive/i }).click();
  await expect(page.getByRole("heading", { name: /case archive/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /The Observatory Key/ })).toBeVisible();
});
