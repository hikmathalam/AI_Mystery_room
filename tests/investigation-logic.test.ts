import { describe, expect, it } from "vitest";
import { calculateAccusationScore, calculateInvestigationProgress } from "../server/src/utils/investigation.js";

describe("investigation scoring and progress", () => {
  const solution = {
    culpritSuspectId: "S-1",
    motiveTerms: ["inheritance", "conceal"],
    criticalEvidenceIds: ["EX-1", "EX-2"],
    actualTimeline: [{ time: "21:00", event: "entered the archive" }, { time: "21:15", event: "returned to the hall" }]
  };

  it("scores only against the server's locked culprit and clue set", () => {
    const correct = calculateAccusationScore({ suspectId: "S-1", explanation: "Inheritance conceal 21:00 entered archive 21:15 returned hall", supportingEvidenceIds: ["EX-1", "EX-2"] }, solution);
    const incorrect = calculateAccusationScore({ suspectId: "S-2", explanation: "Inheritance conceal 21:00 entered archive 21:15 returned hall", supportingEvidenceIds: ["EX-1", "EX-2"] }, solution);
    expect(correct.isCorrect).toBe(true);
    expect(correct.score).toBe(100);
    expect(incorrect.isCorrect).toBe(false);
    expect(incorrect.score).toBe(50);
    expect(correct.breakdown).toEqual({ culprit: 50, motive: 20, evidence: 20, timeline: 10 });
  });

  it("computes progress from actions the player recorded", () => {
    expect(calculateInvestigationProgress({ evidenceCount: 10, examinedEvidenceCount: 5, suspectCount: 4, investigatedSuspectCount: 2, markedEvidenceCount: 2, timelineReviewed: true })).toBe(57);
    expect(calculateInvestigationProgress({ evidenceCount: 0, examinedEvidenceCount: 0, suspectCount: 0, investigatedSuspectCount: 0, markedEvidenceCount: 0, timelineReviewed: false })).toBe(0);
  });
});
