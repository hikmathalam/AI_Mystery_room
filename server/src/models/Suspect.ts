import { Schema, model } from "mongoose";

const suspectSchema = new Schema({
  caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
  suspectId: { type: String, required: true },
  fullName: { type: String, required: true },
  age: { type: Number, required: true },
  occupation: { type: String, required: true },
  relationship: { type: String, required: true },
  background: { type: String, required: true },
  publicMotive: { type: String, required: true },
  publicAlibi: { type: String, required: true },
  personality: { type: String, required: true },
  profileImage: { type: String, default: "" }
}, { timestamps: true });

suspectSchema.index({ caseId: 1, suspectId: 1 }, { unique: true });
export const Suspect = model("Suspect", suspectSchema);
