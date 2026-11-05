import mongoose from "mongoose";
import { env } from "./env.js";
import { Case } from "../models/Case.js";

export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Case.updateMany({ status: "GENERATING" }, {
    status: "FAILED",
    generationStage: "Generation interrupted",
    generationError: "Generation was interrupted when the server restarted. You can safely retry this case."
  });
  console.info("MongoDB connected");
}
