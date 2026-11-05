import { describe, expect, it } from "vitest";
import type { MysteryBlueprint } from "../shared/src/index.js";
import { parseValidatedJson, verifyBlueprint, verifyEvidenceContent, verifyEvidencePlan } from "../server/src/ai/validation.js";

function blueprint(): MysteryBlueprint {
  return {
    title: "The Missing Observatory Key",
    description: "A key vanished during a private evening at the observatory.",
    location: "North observatory",
    incidentDate: "2026-10-14",
    incidentTime: "21:00",
    investigationObjective: "Find who took the key and why the records conflict.",
    incident: { subject: "Missing key", summary: "The brass key disappeared from a locked office.", happenedAt: "2026-10-14 21:00", location: "North observatory", background: "The observatory was closed to visitors." },
    suspects: ["S-1", "S-2", "S-3"].map((suspectId, index) => ({
      suspectId, fullName: `Person ${index + 1}`, age: 30 + index, occupation: "Archivist", relationship: "Colleague",
      background: "A long-serving member of the observatory staff.", motive: "A private dispute over the archive.", opportunity: "Had access to the office during the evening.",
      alibi: "Says they were in the main hall.", personality: "Careful and reserved.", hiddenInformation: "Their private notes may matter.", publicMotive: "A disagreement about the archive.", publicAlibi: "They were in the main hall."
    })),
    solution: {
      culpritSuspectId: "S-1", motive: "They wanted to conceal a record tied to an inheritance dispute.",
      actualTimeline: [{ time: "20:50", event: "The archivist entered the office" }, { time: "21:00", event: "The key was removed" }, { time: "21:15", event: "The archivist returned to the hall" }],
      completeExplanation: "The archivist removed the key to conceal the record and returned before the door was checked.",
      criticalClues: [{ clueId: "CL-1", description: "A sign-in record puts one suspect near the office.", inference: "Their stated route is incomplete." }, { clueId: "CL-2", description: "The maintenance log records a duplicate key check.", inference: "The key was handled during the relevant window." }],
      redHerringExplanations: [], suspectInnocenceExplanations: [], motiveTerms: ["inheritance", "conceal"]
    }
  };
}

function planFor(caseBlueprint: MysteryBlueprint) {
  return Array.from({ length: 8 }, (_, index) => ({
    evidenceId: `EX-${index + 1}`, title: `Exhibit ${index + 1}`, category: "DOCUMENT" as const,
    description: `A fictional document from the observatory archive, item ${index + 1}.`, source: "Archive clerk",
    timestamp: `2026-10-14 20:${String(40 + index).padStart(2, "0")}`,
    relatedSuspectIds: [caseBlueprint.suspects[index % caseBlueprint.suspects.length].suspectId],
    criticalClueIds: index === 0 ? ["CL-1"] : index === 1 ? ["CL-2"] : [],
    informationRevealed: `A documented detail from the office, record ${index + 1}.`, hiddenClue: "Compare this time with the written account.",
    isRedHerring: index > 4, reliability: "HIGH" as const
  }));
}

describe("AI output validation", () => {
  it("locks exactly the requested suspect set and one culprit inside it", () => {
    const input = blueprint();
    expect(verifyBlueprint(input, 3).solution.culpritSuspectId).toBe("S-1");
    expect(() => verifyBlueprint(input, 4)).toThrow(/suspect count/i);
    expect(() => verifyBlueprint({ ...input, solution: { ...input.solution, culpritSuspectId: "S-9" } }, 3)).toThrow(/culprit/i);
  });

  it("rejects duplicated suspect and clue identifiers", () => {
    const input = blueprint();
    const duplicateSuspect = { ...input, suspects: [input.suspects[0], { ...input.suspects[1], suspectId: input.suspects[0].suspectId }, input.suspects[2]] };
    expect(() => verifyBlueprint(duplicateSuspect, 3)).toThrow(/suspect IDs/i);
    const duplicateClue = { ...input, solution: { ...input.solution, criticalClues: [input.solution.criticalClues[0], { ...input.solution.criticalClues[1], clueId: input.solution.criticalClues[0].clueId }] } };
    expect(() => verifyBlueprint(duplicateClue, 3)).toThrow(/clue IDs/i);
  });

  it("requires evidence to reference known people and carry every critical clue more than once", () => {
    const input = blueprint();
    const plan = planFor(input);
    expect(verifyEvidencePlan(plan, input)).toHaveLength(8);
    expect(() => verifyEvidencePlan([{ ...plan[0], relatedSuspectIds: ["S-99"] }, ...plan.slice(1)], input)).toThrow(/unknown suspect/i);
    expect(() => verifyEvidencePlan(plan.map((item, index) => index === 1 ? { ...item, criticalClueIds: ["CL-99"] } : item), input)).toThrow(/unknown critical clue/i);
    expect(() => verifyEvidencePlan(plan.map((item, index) => index === 1 ? { ...item, criticalClueIds: [] } : item), input)).toThrow(/represent every critical clue/i);
  });

  it("requires the content response to match the approved evidence IDs exactly", () => {
    const plan = planFor(blueprint());
    const content = { evidence: plan.map((item) => ({ evidenceId: item.evidenceId, content: "The documented record shows the office was visited.", observations: ["The minute is visible."], clueText: "Compare the minute to the alibi." })) };
    expect(verifyEvidenceContent(content, plan).evidence).toHaveLength(8);
    expect(() => verifyEvidenceContent({ evidence: content.evidence.slice(1) }, plan)).toThrow();
    expect(() => verifyEvidenceContent({ evidence: [{ ...content.evidence[0], evidenceId: "UNKNOWN" }, ...content.evidence.slice(1)] }, plan)).toThrow(/approved evidence plan/i);
  });

  it("rejects malformed JSON and does not ask AI to reselect the locked culprit", () => {
    expect(() => parseValidatedJson("{broken", (value) => value)).toThrow();
    const input = blueprint();
    const verified = verifyBlueprint(input, 3);
    verifyEvidencePlan(planFor(verified), verified);
    expect(verified.solution.culpritSuspectId).toBe("S-1");
  });
});
