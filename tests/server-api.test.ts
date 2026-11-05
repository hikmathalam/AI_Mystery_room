import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  caseFindOne: vi.fn(), caseFindOneAndUpdate: vi.fn(), caseUpdateOne: vi.fn(),
  solutionFindOne: vi.fn(),
  evidenceFind: vi.fn(), evidenceFindOne: vi.fn(), evidenceExists: vi.fn(), evidenceCountDocuments: vi.fn(),
  investigationFindOne: vi.fn(), investigationFindOneAndUpdate: vi.fn(), investigationCreate: vi.fn(),
  suspectFind: vi.fn(), suspectExists: vi.fn(), suspectCountDocuments: vi.fn(),
  userFindOne: vi.fn(), userFindById: vi.fn(), userCreate: vi.fn()
}));

vi.mock("../server/src/models/Case.js", () => ({ Case: { findOne: mocks.caseFindOne, findOneAndUpdate: mocks.caseFindOneAndUpdate, updateOne: mocks.caseUpdateOne } }));
vi.mock("../server/src/models/CaseSolution.js", () => ({ CaseSolution: { findOne: mocks.solutionFindOne } }));
vi.mock("../server/src/models/Evidence.js", () => ({ Evidence: { find: mocks.evidenceFind, findOne: mocks.evidenceFindOne, exists: mocks.evidenceExists, countDocuments: mocks.evidenceCountDocuments } }));
vi.mock("../server/src/models/Investigation.js", () => ({ Investigation: { findOne: mocks.investigationFindOne, findOneAndUpdate: mocks.investigationFindOneAndUpdate, create: mocks.investigationCreate } }));
vi.mock("../server/src/models/Suspect.js", () => ({ Suspect: { find: mocks.suspectFind, exists: mocks.suspectExists, countDocuments: mocks.suspectCountDocuments } }));
vi.mock("../server/src/models/User.js", () => ({ User: { findOne: mocks.userFindOne, findById: mocks.userFindById, create: mocks.userCreate } }));

const testSecret = "mystery-room-api-test-secret-with-more-than-32-characters";
const userId = "65a111111111111111111111";
let app: import("express").Express;

beforeAll(async () => {
  vi.stubEnv("MONGODB_URI", "mongodb://127.0.0.1:27017/mystery-room-tests");
  vi.stubEnv("JWT_SECRET", testSecret);
  vi.stubEnv("CLIENT_URL", "http://localhost:5173");
  vi.stubEnv("COOKIE_SECURE", "false");
  vi.resetModules();
  app = (await import("../server/src/app.js")).app;
});

beforeEach(() => vi.clearAllMocks());

function session() {
  return `mystery_session=${jwt.sign({}, testSecret, { subject: userId, expiresIn: "1h" })}`;
}

function caseRecord(owner = userId) {
  return {
    _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(owner), title: "The Archive Key",
    description: "A fictional case at the old observatory.", genre: "Murder Mystery", difficulty: "Medium", status: "READY",
    suspectCount: 3, generationProgress: 100, generationStage: "Case ready", generationError: "",
    location: "North observatory", incidentDate: "2026-10-14", incidentTime: "21:00", investigationObjective: "Find the missing key.",
    incident: { subject: "Missing key", summary: "A key disappeared.", background: "The room was locked." },
    createdAt: new Date("2026-10-14T00:00:00Z"), updatedAt: new Date("2026-10-14T00:00:00Z"),
    generationBlueprint: { solution: { culpritSuspectId: "S-1", motive: "secret answer" } },
    generationEvidencePlan: [{ hiddenClue: "secret clue" }]
  };
}

describe("authenticated API", () => {
  it("rejects case reads without a valid session", async () => {
    const response = await request(app).get("/api/v1/cases");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UNAUTHENTICATED");
  });

  it("registers and signs in without returning password hashes", async () => {
    const user = { _id: new mongoose.Types.ObjectId(), name: "Case Tester", email: "case@example.com", avatar: "" };
    mocks.userFindOne.mockResolvedValueOnce(null);
    mocks.userCreate.mockResolvedValueOnce(user);
    const registered = await request(app).post("/api/v1/auth/register").send({ name: "Case Tester", email: "case@example.com", password: "long-enough-password" });
    expect(registered.status).toBe(201);
    expect(registered.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(registered.body.user).toEqual({ id: String(user._id), name: "Case Tester", email: "case@example.com", avatar: "" });
    expect(registered.body.user.passwordHash).toBeUndefined();

    const password = "long-enough-password";
    const existing = { ...user, passwordHash: await bcrypt.hash(password, 4) };
    mocks.userFindOne.mockReturnValueOnce({ select: vi.fn().mockResolvedValue(existing) });
    const loggedIn = await request(app).post("/api/v1/auth/login").send({ email: "case@example.com", password });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.body.user.email).toBe("case@example.com");
  });

  it("does not return ground truth in the public case response", async () => {
    const record = caseRecord();
    mocks.caseFindOne.mockResolvedValueOnce(record);
    const response = await request(app).get(`/api/v1/cases/${record._id}`).set("Cookie", session());
    expect(response.status).toBe(200);
    expect(response.body.case.title).toBe("The Archive Key");
    expect(JSON.stringify(response.body)).not.toContain("culpritSuspectId");
    expect(JSON.stringify(response.body)).not.toContain("secret answer");
    expect(JSON.stringify(response.body)).not.toContain("secret clue");
  });

  it("keeps a user's case private to its owner", async () => {
    const record = caseRecord("65a222222222222222222222");
    mocks.caseFindOne.mockResolvedValueOnce(null);
    const response = await request(app).get(`/api/v1/cases/${record._id}`).set("Cookie", session());
    expect(response.status).toBe(404);
    expect(response.body.code).toBe("CASE_NOT_FOUND");
  });

  it("blocks result access before accusation", async () => {
    const record = caseRecord();
    mocks.caseFindOne.mockResolvedValueOnce(record);
    mocks.investigationFindOne.mockResolvedValueOnce(null);
    const response = await request(app).get(`/api/v1/cases/${record._id}/result`).set("Cookie", session());
    expect(response.status).toBe(403);
    expect(response.body.code).toBe("RESULT_LOCKED");
    expect(mocks.solutionFindOne).not.toHaveBeenCalled();
  });

  it("evaluates an accusation against the locked culprit and scoring rules", async () => {
    const record = caseRecord();
    const suspects = [
      { suspectId: "S-1", fullName: "Person One" },
      { suspectId: "S-2", fullName: "Person Two" },
      { suspectId: "S-3", fullName: "Person Three" }
    ];
    const solution = { culpritSuspectId: "S-1", motive: "Inheritance and concealment.", motiveTerms: ["inheritance", "conceal"], criticalEvidenceIds: ["EX-1", "EX-2"], actualTimeline: [{ time: "21:00", event: "entered the archive" }, { time: "21:15", event: "returned to the hall" }], completeExplanation: "The archivist removed the key to conceal the record.", redHerringExplanations: [], suspectInnocenceExplanations: [] };
    mocks.caseFindOne.mockResolvedValueOnce(record);
    mocks.investigationFindOne.mockResolvedValueOnce(null);
    mocks.solutionFindOne.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(solution) });
    mocks.suspectFind.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(suspects) });
    mocks.evidenceFind.mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([{ evidenceId: "EX-1", title: "Log", clueText: "Time recorded" }, { evidenceId: "EX-2", title: "Receipt", clueText: "Duplicate key" }]) });
    mocks.investigationCreate.mockResolvedValueOnce({});
    mocks.caseUpdateOne.mockResolvedValueOnce({ acknowledged: true });
    const response = await request(app).post(`/api/v1/cases/${record._id}/accusation`).set("Cookie", session()).send({ suspectId: "S-1", explanation: "Inheritance conceal 21:00 entered archive 21:15 returned hall", supportingEvidenceIds: ["EX-1", "EX-2"] });
    expect(response.status).toBe(200);
    expect(response.body.verdict.isCorrect).toBe(true);
    expect(response.body.verdict.score).toBe(100);
    expect(response.body.verdict.culprit.suspectId).toBe("S-1");
  });

  it("does not let the evidence board add an exhibit the investigator has not opened", async () => {
    const record = caseRecord();
    mocks.caseFindOne.mockResolvedValueOnce(record);
    mocks.investigationFindOne.mockResolvedValueOnce({ isSubmitted: false, examinedEvidenceIds: [], investigatedSuspectIds: [] });
    const response = await request(app).patch(`/api/v1/cases/${record._id}/investigation/board`).set("Cookie", session()).send({ nodes: [{ id: "evidence:EX-1", kind: "evidence", entityId: "EX-1", label: "Hidden exhibit", x: 10, y: 20 }], edges: [] });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("UNDISCOVERED_EVIDENCE");
    expect(mocks.investigationFindOneAndUpdate).not.toHaveBeenCalled();
  });
});
