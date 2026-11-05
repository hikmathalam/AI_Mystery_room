import { Router } from "express";
import { Case } from "../models/Case.js";
import { Investigation } from "../models/Investigation.js";
import { authRequired } from "../middleware/auth.js";

export const userRouter = Router();
userRouter.use(authRequired);
userRouter.get("/me/statistics", async (req, res) => {
  const [totalCases, solvedCases, activeCases, recentCases] = await Promise.all([
    Case.countDocuments({ userId: req.userId }),
    Case.countDocuments({ userId: req.userId, status: "SOLVED" }),
    Case.countDocuments({ userId: req.userId, status: { $in: ["GENERATING", "READY", "INVESTIGATING"] } }),
    Case.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(5).lean()
  ]);
  const completed = await Investigation.find({ userId: req.userId, isSubmitted: true }).select("score").lean();
  const averageScore = completed.length ? Math.round(completed.reduce((total, item) => total + (item.score || 0), 0) / completed.length) : 0;
  res.json({ success: true, statistics: { totalCases, solvedCases, activeCases, averageScore }, recentCases: recentCases.map((c) => ({ id: String(c._id), title: c.title, description: c.description, genre: c.genre, difficulty: c.difficulty, status: c.status, suspectCount: c.suspectCount, generationProgress: c.generationProgress, generationStage: c.generationStage, createdAt: c.createdAt, completedAt: c.completedAt })) });
});
