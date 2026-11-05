import { Schema, model } from "mongoose";

const solutionSchema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, unique: true, index: true },
  culpritSuspectId: { type: String, required: true },
  motive: { type: String, required: true },
  motiveTerms: { type: [String], default: [] },
  actualTimeline: { type: [{ time: String, event: String }], default: [] },
  completeExplanation: { type: String, required: true },
  criticalClues: { type: [{ clueId: String, description: String, inference: String }], default: [] },
  criticalEvidenceIds: { type: [String], default: [] },
  redHerringExplanations: { type: [String], default: [] },
  suspectInnocenceExplanations: { type: [{ suspectId: String, explanation: String }], default: [] }
}, { timestamps: true });

export const CaseSolution = model("CaseSolution", solutionSchema);
