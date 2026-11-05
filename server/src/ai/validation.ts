import { evidenceContentSchema, evidencePlanSchema, mysteryBlueprintSchema, type EvidencePlan, type MysteryBlueprint } from "@mystery-room/shared";

export function parseValidatedJson<T>(text: string, validate: (value: unknown) => T): T {
  return validate(JSON.parse(text));
}

export function verifyBlueprint(value: unknown, expectedSuspects: number): MysteryBlueprint {
  const blueprint = mysteryBlueprintSchema.parse(value);
  const ids = new Set(blueprint.suspects.map((suspect) => suspect.suspectId));
  if (blueprint.suspects.length !== expectedSuspects) throw new Error("The generated suspect count did not match the requested count.");
  if (!ids.has(blueprint.solution.culpritSuspectId)) throw new Error("The culprit must be one of the generated suspects.");
  if (ids.size !== blueprint.suspects.length) throw new Error("Suspect IDs must be unique.");
  const clueIds = new Set(blueprint.solution.criticalClues.map((clue) => clue.clueId));
  if (clueIds.size !== blueprint.solution.criticalClues.length) throw new Error("Critical clue IDs must be unique.");
  return blueprint;
}

export function verifyEvidencePlan(value: unknown, blueprint: MysteryBlueprint): EvidencePlan {
  const plan = evidencePlanSchema.parse({ evidencePlan: value }).evidencePlan;
  const suspectIds = new Set(blueprint.suspects.map((suspect) => suspect.suspectId));
  const clueIds = new Set(blueprint.solution.criticalClues.map((clue) => clue.clueId));
  const evidenceIds = new Set(plan.map((item) => item.evidenceId));
  if (evidenceIds.size !== plan.length) throw new Error("Evidence IDs must be unique.");
  if (plan.some((item) => item.relatedSuspectIds.some((id) => !suspectIds.has(id)))) throw new Error("Evidence referenced an unknown suspect.");
  if (plan.some((item) => item.criticalClueIds.some((id) => !clueIds.has(id)))) throw new Error("Evidence referenced an unknown critical clue.");
  const representedClues = new Set(plan.flatMap((item) => item.criticalClueIds));
  if ([...clueIds].some((id) => !representedClues.has(id))) throw new Error("The evidence plan did not represent every critical clue.");
  if (plan.filter((item) => item.criticalClueIds.length > 0).length < 2) throw new Error("The case must include at least two evidence items supporting the solution.");
  return plan;
}

export function verifyEvidenceContent(value: unknown, plan: EvidencePlan) {
  const content = evidenceContentSchema.parse(value);
  const contentIds = new Set(content.evidence.map((item) => item.evidenceId));
  if (content.evidence.length !== plan.length || contentIds.size !== plan.length || plan.some((item) => !contentIds.has(item.evidenceId))) {
    throw new Error("Generated evidence did not match the approved evidence plan.");
  }
  return content;
}
