import { Schema, model, type InferSchemaType } from "mongoose";

const journalEntrySchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ["NOTE", "THEORY", "MOTIVE", "CONTRADICTION", "DISCOVERY", "OBSERVATION"], required: true },
  title: { type: String, default: "", maxlength: 120 },
  content: { type: String, required: true, maxlength: 4000 },
  evidenceIds: { type: [String], default: [] },
  suspectIds: { type: [String], default: [] },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });
const boardNodeSchema = new Schema({
  id: { type: String, required: true }, kind: { type: String, enum: ["evidence", "suspect", "annotation"], required: true },
  entityId: { type: String }, label: { type: String, required: true }, text: { type: String }, x: { type: Number, required: true }, y: { type: Number, required: true }
}, { _id: false });
const boardEdgeSchema = new Schema({
  id: { type: String, required: true }, source: { type: String, required: true }, target: { type: String, required: true }, label: { type: String, default: "" }
}, { _id: false });

const investigationSchema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  notes: { type: String, default: "", maxlength: 12000 },
  progress: { type: Number, default: 0 },
  markedEvidence: { type: [String], default: [] },
  examinedEvidenceIds: { type: [String], default: [] },
  investigatedSuspectIds: { type: [String], default: [] },
  timelineReviewed: { type: Boolean, default: false },
  journalEntries: { type: [journalEntrySchema], default: [] },
  board: { nodes: { type: [boardNodeSchema], default: [] }, edges: { type: [boardEdgeSchema], default: [] } },
  confidenceRatings: { type: [{ suspectId: { type: String, required: true }, confidence: { type: Number, required: true, min: 0, max: 100 } }], default: [] },
  selectedSuspectId: { type: String },
  accusationExplanation: { type: String, default: "" },
  supportingEvidenceIds: { type: [String], default: [] },
  submittedAt: { type: Date },
  isSubmitted: { type: Boolean, default: false },
  score: { type: Number },
  scoreBreakdown: {
    culprit: { type: Number, default: 0 },
    motive: { type: Number, default: 0 },
    evidence: { type: Number, default: 0 },
    timeline: { type: Number, default: 0 }
  },
  verdict: { type: Schema.Types.Mixed }
}, { timestamps: true });

investigationSchema.index({ caseId: 1, userId: 1 }, { unique: true });
export type InvestigationRecord = InferSchemaType<typeof investigationSchema>;
export const Investigation = model("Investigation", investigationSchema);
