import { Schema, model, type InferSchemaType } from "mongoose";
import { caseStatuses, difficulties, genres } from "@mystery-room/shared";

const caseSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, default: "New investigation" },
  description: { type: String, default: "" },
  originalScenario: { type: String, required: true, maxlength: 3000 },
  genre: { type: String, enum: genres, required: true },
  difficulty: { type: String, enum: difficulties, required: true },
  status: { type: String, enum: caseStatuses, default: "GENERATING", index: true },
  suspectCount: { type: Number, required: true },
  theme: { type: String, default: "" },
  duration: { type: String, default: "Standard investigation" },
  generationProgress: { type: Number, default: 0 },
  generationStage: { type: String, default: "Queued" },
  generationError: { type: String, default: "" },
  promptVersion: { type: String, default: "" },
  generationAnalysis: { type: Schema.Types.Mixed, select: false },
  generationBlueprint: { type: Schema.Types.Mixed, select: false },
  generationEvidencePlan: { type: Schema.Types.Mixed, select: false },
  location: { type: String, default: "" },
  incidentDate: { type: String, default: "" },
  incidentTime: { type: String, default: "" },
  investigationObjective: { type: String, default: "" },
  incident: {
    subject: { type: String, default: "" },
    summary: { type: String, default: "" },
    background: { type: String, default: "" }
  },
  completedAt: { type: Date }
}, { timestamps: true });

caseSchema.index({ userId: 1, createdAt: -1 });
export type CaseRecord = InferSchemaType<typeof caseSchema>;
export const Case = model("Case", caseSchema);
