import { Router } from "express";
import mongoose, { type HydratedDocument } from "mongoose";
import { z } from "zod";
import { accusationSchema, boardSchema, caseCreationSchema, confidenceSchema, journalSchema, noteSchema, progressSchema, type CaseCreationInput } from "@mystery-room/shared";
import { Case, type CaseRecord } from "../models/Case.js";
import { CaseSolution } from "../models/CaseSolution.js";
import { Evidence } from "../models/Evidence.js";
import { Investigation, type InvestigationRecord } from "../models/Investigation.js";
import { Suspect } from "../models/Suspect.js";
import { authRequired } from "../middleware/auth.js";
import { HttpError } from "../utils/HttpError.js";
import { generateCase } from "../ai/generateCase.js";
import { calculateAccusationScore, calculateInvestigationProgress } from "../utils/investigation.js";

export const caseRouter = Router();
caseRouter.use(authRequired);

const caseListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().max(80).default("")
});

function requireId(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, "This case could not be found.", "CASE_NOT_FOUND");
}

async function ownedCase(caseId: string, userId: string) {
  requireId(caseId);
  const found = await Case.findOne({ _id: caseId, userId });
  if (!found) throw new HttpError(404, "This case could not be found.", "CASE_NOT_FOUND");
  return found;
}

function publicCase(caseDoc: HydratedDocument<CaseRecord>) {
  return {
    id: String(caseDoc._id), title: caseDoc.title, description: caseDoc.description,
    genre: caseDoc.genre, difficulty: caseDoc.difficulty, status: caseDoc.status,
    suspectCount: caseDoc.suspectCount, generationProgress: caseDoc.generationProgress,
    generationStage: caseDoc.generationStage, ...(caseDoc.generationError ? { generationError: caseDoc.generationError } : {}),
    location: caseDoc.location, incidentDate: caseDoc.incidentDate, incidentTime: caseDoc.incidentTime,
    investigationObjective: caseDoc.investigationObjective, incident: caseDoc.incident,
    createdAt: caseDoc.createdAt, updatedAt: caseDoc.updatedAt, completedAt: caseDoc.completedAt
  };
}

async function publicInvestigation(caseId: unknown, investigation: HydratedDocument<InvestigationRecord>) {
  const [evidenceCount, suspectCount] = await Promise.all([
    Evidence.countDocuments({ caseId }),
    Suspect.countDocuments({ caseId })
  ]);
  const examinedEvidenceIds = investigation.examinedEvidenceIds || [];
  const investigatedSuspectIds = investigation.investigatedSuspectIds || [];
  const markedEvidence = investigation.markedEvidence || [];
  return {
    notes: investigation.notes || "",
    progress: calculateInvestigationProgress({
      evidenceCount, examinedEvidenceCount: examinedEvidenceIds.length,
      suspectCount, investigatedSuspectCount: investigatedSuspectIds.length,
      markedEvidenceCount: markedEvidence.length, timelineReviewed: Boolean(investigation.timelineReviewed)
    }),
    markedEvidence,
    examinedEvidenceIds,
    investigatedSuspectIds,
    timelineReviewed: Boolean(investigation.timelineReviewed),
    journalEntries: investigation.journalEntries || [],
    board: investigation.board || { nodes: [], edges: [] },
    confidenceRatings: investigation.confidenceRatings || [],
    isSubmitted: investigation.isSubmitted,
    selectedSuspectId: investigation.selectedSuspectId,
    score: investigation.score
  };
}

caseRouter.post("/", async (req, res) => {
  const input: CaseCreationInput = caseCreationSchema.parse(req.body);
  const created = await Case.create({
    userId: req.userId!, originalScenario: input.scenario, genre: input.genre,
    difficulty: input.difficulty, suspectCount: input.suspectCount,
    theme: input.theme, duration: input.duration
  });
  void generateCase(String(created._id), input);
  res.status(202).json({ success: true, case: publicCase(created) });
});

caseRouter.get("/", async (req, res) => {
  const { page, limit, q } = caseListQuerySchema.parse(req.query);
  const safeQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = q
    ? { userId: req.userId, $or: [{ title: { $regex: safeQuery, $options: "i" } }, { description: { $regex: safeQuery, $options: "i" } }, { genre: { $regex: safeQuery, $options: "i" } }] }
    : { userId: req.userId };
  const [cases, total] = await Promise.all([
    Case.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Case.countDocuments(filter)
  ]);
  res.json({ success: true, cases: cases.map(publicCase), page, pageSize: limit, total, totalPages: Math.ceil(total / limit) });
});

caseRouter.get("/:caseId/status", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  res.json({ success: true, case: publicCase(found) });
});
caseRouter.get("/:caseId/generation-status", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  res.json({ success: true, case: publicCase(found) });
});

caseRouter.post("/:caseId/generate", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  if (found.status === "READY" || found.status === "SOLVED" || found.status === "SUBMITTED") throw new HttpError(409, "This case has already been published.", "CASE_ALREADY_PUBLISHED");
  if (found.status === "GENERATING") throw new HttpError(409, "This case is already being generated.", "GENERATION_IN_PROGRESS");
  const input = caseCreationSchema.parse({ scenario: found.originalScenario, genre: found.genre, difficulty: found.difficulty, suspectCount: found.suspectCount, theme: found.theme, duration: found.duration });
  found.status = "GENERATING";
  found.generationProgress = 0;
  found.generationError = "";
  found.generationStage = "Queued";
  await found.save();
  void generateCase(String(found._id), input);
  res.status(202).json({ success: true, case: publicCase(found) });
});

caseRouter.get("/:caseId", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  res.json({ success: true, case: publicCase(found) });
});

caseRouter.delete("/:caseId", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  await Promise.all([
    Case.deleteOne({ _id: found._id }), CaseSolution.deleteOne({ caseId: found._id }),
    Suspect.deleteMany({ caseId: found._id }), Evidence.deleteMany({ caseId: found._id }),
    Investigation.deleteMany({ caseId: found._id })
  ]);
  res.json({ success: true });
});

caseRouter.get("/:caseId/suspects", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  if (!["READY", "INVESTIGATING", "SUBMITTED", "SOLVED"].includes(found.status)) throw new HttpError(409, "Suspects will be available when generation finishes.", "CASE_NOT_READY");
  const suspects = await Suspect.find({ caseId: found._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, suspects: suspects.map((s) => ({ id: String(s._id), suspectId: s.suspectId, fullName: s.fullName, age: s.age, occupation: s.occupation, relationship: s.relationship, background: s.background, publicMotive: s.publicMotive, publicAlibi: s.publicAlibi, personality: s.personality, profileImage: s.profileImage })) });
});

caseRouter.get("/:caseId/suspects/:suspectId", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const suspect = await Suspect.findOne({ caseId: found._id, suspectId: req.params.suspectId }).lean();
  if (!suspect) throw new HttpError(404, "This suspect could not be found.", "SUSPECT_NOT_FOUND");
  res.json({ success: true, suspect: { id: String(suspect._id), suspectId: suspect.suspectId, fullName: suspect.fullName, age: suspect.age, occupation: suspect.occupation, relationship: suspect.relationship, background: suspect.background, publicMotive: suspect.publicMotive, publicAlibi: suspect.publicAlibi, personality: suspect.personality, profileImage: suspect.profileImage } });
});

caseRouter.get("/:caseId/evidence", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const items = await Evidence.find({ caseId: found._id }).sort({ timestamp: 1, createdAt: 1 }).lean();
  res.json({ success: true, evidence: items.map((e) => ({ id: String(e._id), evidenceId: e.evidenceId, title: e.title, category: e.category, description: e.description, content: e.content, observations: e.observations, clueText: e.clueText, source: e.source, timestamp: e.timestamp, relatedSuspectIds: e.relatedSuspectIds, reliability: e.reliability, isSimulatedMedia: e.isSimulatedMedia, mediaUrl: e.mediaUrl })) });
});

caseRouter.get("/:caseId/evidence/:evidenceId", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const item = await Evidence.findOne({ caseId: found._id, evidenceId: req.params.evidenceId }).lean();
  if (!item) throw new HttpError(404, "This evidence could not be found.", "EVIDENCE_NOT_FOUND");
  res.json({ success: true, evidence: { id: String(item._id), evidenceId: item.evidenceId, title: item.title, category: item.category, description: item.description, content: item.content, observations: item.observations, clueText: item.clueText, source: item.source, timestamp: item.timestamp, relatedSuspectIds: item.relatedSuspectIds, reliability: item.reliability, isSimulatedMedia: item.isSimulatedMedia, mediaUrl: item.mediaUrl } });
});

caseRouter.post("/:caseId/evidence/:evidenceId/bookmark", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const item = await Evidence.findOne({ caseId: found._id, evidenceId: req.params.evidenceId });
  if (!item) throw new HttpError(404, "This evidence could not be found.", "EVIDENCE_NOT_FOUND");
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { $addToSet: { markedEvidence: req.params.evidenceId } }, { new: true })
    : await Investigation.create({ caseId: found._id, userId: req.userId!, markedEvidence: [req.params.evidenceId] });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, markedEvidence: investigation.markedEvidence });
});

caseRouter.delete("/:caseId/evidence/:evidenceId/bookmark", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const item = await Evidence.findOne({ caseId: found._id, evidenceId: req.params.evidenceId });
  if (!item) throw new HttpError(404, "This evidence could not be found.", "EVIDENCE_NOT_FOUND");
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { $pull: { markedEvidence: req.params.evidenceId } }, { new: true })
    : await Investigation.create({ caseId: found._id, userId: req.userId! });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, markedEvidence: investigation.markedEvidence });
});

caseRouter.get("/:caseId/investigation", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const investigation = await Investigation.findOneAndUpdate(
    { caseId: found._id, userId: req.userId }, { $setOnInsert: { caseId: found._id, userId: req.userId } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (found.status === "READY") await Case.updateOne({ _id: found._id }, { status: "INVESTIGATING" });
  res.json({ success: true, investigation: await publicInvestigation(found._id, investigation) });
});

caseRouter.patch("/:caseId/investigation/notes", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const { notes } = noteSchema.parse(req.body);
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { notes }, { new: true })
    : await Investigation.create({ caseId: found._id, userId: req.userId!, notes });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, notes: investigation.notes });
});

caseRouter.patch("/:caseId/investigation/journal", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const { entries } = journalSchema.parse(req.body);
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const evidenceIds = [...new Set(entries.flatMap((entry) => entry.evidenceIds))];
  const suspectIds = [...new Set(entries.flatMap((entry) => entry.suspectIds))];
  if (evidenceIds.some((id) => !existing?.examinedEvidenceIds.includes(id))) throw new HttpError(400, "Journal links must use exhibits you have examined.", "UNDISCOVERED_EVIDENCE");
  if (suspectIds.some((id) => !existing?.investigatedSuspectIds.includes(id))) throw new HttpError(400, "Journal links must use profiles you have reviewed.", "UNDISCOVERED_SUSPECT");
  const now = new Date();
  const journalEntries = entries.map((entry) => {
    const prior = existing?.journalEntries.find((item) => item.id === entry.id);
    return { ...entry, createdAt: prior?.createdAt || (entry.createdAt ? new Date(entry.createdAt) : now), updatedAt: now };
  });
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { journalEntries }, { new: true })
    : await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId }, { $set: { journalEntries }, $setOnInsert: { caseId: found._id, userId: req.userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, journalEntries: investigation.journalEntries });
});

caseRouter.patch("/:caseId/investigation/board", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const board = boardSchema.parse(req.body);
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const discoveredEvidence = new Set(existing?.examinedEvidenceIds || []);
  const reviewedSuspects = new Set(existing?.investigatedSuspectIds || []);
  if (board.nodes.some((node) => node.kind === "evidence" && !discoveredEvidence.has(node.entityId || ""))) throw new HttpError(400, "The board can only use exhibits you have examined.", "UNDISCOVERED_EVIDENCE");
  if (board.nodes.some((node) => node.kind === "suspect" && !reviewedSuspects.has(node.entityId || ""))) throw new HttpError(400, "The board can only use profiles you have reviewed.", "UNDISCOVERED_SUSPECT");
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { board }, { new: true })
    : await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId }, { $set: { board }, $setOnInsert: { caseId: found._id, userId: req.userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, board: investigation.board });
});

caseRouter.patch("/:caseId/investigation/confidence", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const { ratings } = confidenceSchema.parse(req.body);
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  const suspectIds = ratings.map((rating) => rating.suspectId);
  const validSuspectCount = await Suspect.countDocuments({ caseId: found._id, suspectId: { $in: suspectIds } });
  if (validSuspectCount !== suspectIds.length) throw new HttpError(400, "Every confidence rating must belong to a person in this case.", "INVALID_SUSPECT");
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, { confidenceRatings: ratings }, { new: true })
    : await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId }, { $set: { confidenceRatings: ratings }, $setOnInsert: { caseId: found._id, userId: req.userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, confidenceRatings: investigation.confidenceRatings });
});

caseRouter.patch("/:caseId/investigation/progress", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const { markedEvidence, examinedEvidenceId, investigatedSuspectId, timelineReviewed } = progressSchema.parse(req.body);
  const existing = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (existing?.isSubmitted) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  if (examinedEvidenceId && !(await Evidence.exists({ caseId: found._id, evidenceId: examinedEvidenceId }))) throw new HttpError(400, "This exhibit does not belong to the case.", "INVALID_EVIDENCE");
  if (investigatedSuspectId && !(await Suspect.exists({ caseId: found._id, suspectId: investigatedSuspectId }))) throw new HttpError(400, "This person does not belong to the case.", "INVALID_SUSPECT");
  const addToSet = {
    ...(markedEvidence ? { markedEvidence: { $each: markedEvidence } } : {}),
    ...(examinedEvidenceId ? { examinedEvidenceIds: examinedEvidenceId } : {}),
    ...(investigatedSuspectId ? { investigatedSuspectIds: investigatedSuspectId } : {})
  };
  const update = {
    ...(Object.keys(addToSet).length ? { $addToSet: addToSet } : {}),
    ...(timelineReviewed !== undefined ? { $set: { timelineReviewed } } : {})
  };
  const investigation = existing
    ? await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, update, { new: true })
    : await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId }, { ...update, $setOnInsert: { caseId: found._id, userId: req.userId } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  if (!investigation) throw new HttpError(409, "This completed investigation is read-only.", "CASE_READ_ONLY");
  res.json({ success: true, investigation: await publicInvestigation(found._id, investigation) });
});

caseRouter.post("/:caseId/accusation", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const input = accusationSchema.parse(req.body);
  const investigation = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (investigation?.isSubmitted) throw new HttpError(409, "A final accusation has already been submitted for this case.", "DUPLICATE_ACCUSATION");
  if (found.status === "GENERATING" || found.status === "FAILED") throw new HttpError(409, "This case is not ready for an accusation.", "CASE_NOT_READY");
  const [solution, suspects, evidence] = await Promise.all([
    CaseSolution.findOne({ caseId: found._id }).lean(),
    Suspect.find({ caseId: found._id }).lean(),
    Evidence.find({ caseId: found._id }).lean()
  ]);
  if (!solution || !suspects.some((suspect) => suspect.suspectId === input.suspectId)) throw new HttpError(400, "Select one of the suspects in this case.", "INVALID_SUSPECT");
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
  if (input.supportingEvidenceIds.some((id) => !evidenceIds.has(id))) throw new HttpError(400, "One or more selected evidence items do not belong to this case.", "INVALID_EVIDENCE");
  const { isCorrect: correct, score, breakdown } = calculateAccusationScore(input, solution);
  const culprit = suspects.find((suspect) => suspect.suspectId === solution.culpritSuspectId)!;
  const selectedSuspect = suspects.find((suspect) => suspect.suspectId === input.suspectId)!;
  const importantClues = evidence.filter((item) => solution.criticalEvidenceIds.includes(item.evidenceId)).map((item) => ({ evidenceId: item.evidenceId, title: item.title, clue: item.clueText }));
  const verdict = { isCorrect: correct, score, scoreBreakdown: breakdown, explanation: solution.completeExplanation, motive: solution.motive, selectedSuspect: { suspectId: selectedSuspect.suspectId, name: selectedSuspect.fullName }, culprit: { suspectId: culprit.suspectId, name: culprit.fullName }, importantClues, actualTimeline: solution.actualTimeline, redHerringExplanations: solution.redHerringExplanations, suspectInnocenceExplanations: solution.suspectInnocenceExplanations };
  const accusationUpdate = {
    selectedSuspectId: input.suspectId, accusationExplanation: input.explanation,
    supportingEvidenceIds: input.supportingEvidenceIds, submittedAt: new Date(), isSubmitted: true,
    score, scoreBreakdown: breakdown, verdict
  };
  if (investigation) {
    const committed = await Investigation.findOneAndUpdate({ caseId: found._id, userId: req.userId, isSubmitted: false }, accusationUpdate, { new: true });
    if (!committed) throw new HttpError(409, "A final accusation has already been submitted for this case.", "DUPLICATE_ACCUSATION");
  } else {
    try {
      await Investigation.create({ caseId: found._id, userId: req.userId!, ...accusationUpdate });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) throw new HttpError(409, "A final accusation has already been submitted for this case.", "DUPLICATE_ACCUSATION");
      throw error;
    }
  }
  await Case.updateOne({ _id: found._id }, { status: correct ? "SOLVED" : "SUBMITTED", completedAt: new Date() });
  res.json({ success: true, verdict });
});

caseRouter.get("/:caseId/result", async (req, res) => {
  const found = await ownedCase(req.params.caseId, req.userId!);
  const investigation = await Investigation.findOne({ caseId: found._id, userId: req.userId });
  if (!investigation?.isSubmitted || !investigation.verdict) throw new HttpError(403, "Submit your final accusation to reveal the case solution.", "RESULT_LOCKED");
  res.json({ success: true, result: investigation.verdict });
});
