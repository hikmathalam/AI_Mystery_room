import { Schema, model } from "mongoose";
import { evidenceCategories } from "@mystery-room/shared";

const evidenceSchema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  evidenceId: { type: String, required: true },
  title: { type: String, required: true },
  category: { type: String, enum: evidenceCategories, required: true },
  description: { type: String, required: true },
  content: { type: String, required: true },
  observations: { type: [String], default: [] },
  clueText: { type: String, required: true },
  source: { type: String, required: true },
  timestamp: { type: String, required: true },
  relatedSuspectIds: { type: [String], default: [] },
  reliability: { type: String, enum: ["LOW", "MEDIUM", "HIGH"], required: true },
  isSimulatedMedia: { type: Boolean, default: false },
  mediaUrl: { type: String, default: "" }
}, { timestamps: true });

evidenceSchema.index({ caseId:  1, evidenceId: 1 }, { unique: true });
export const Evidence = model("Evidence", evidenceSchema);
