import { z } from "zod";

export const genres = ["Murder Mystery", "Missing Person", "Theft", "Corporate Espionage", "Cybercrime", "Secret Identity", "Unexplained Incident", "Custom Mystery"] as const;
export const difficulties = ["Easy", "Medium", "Hard", "Expert"] as const;
export const evidenceCategories = ["CHAT", "IMAGE", "CCTV", "WITNESS", "DOCUMENT", "DIGITAL", "OTHER"] as const;
export const caseStatuses = ["GENERATING", "READY", "INVESTIGATING", "SUBMITTED", "SOLVED", "FAILED"] as const;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(10).max(128)
});
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export const caseCreationSchema = z.object({
  scenario: z.string().trim().min(40, "Give the investigation a little more context (at least 40 characters). ").max(3000),
  genre: z.enum(genres).default("Murder Mystery"),
  difficulty: z.enum(difficulties).default("Medium"),
  suspectCount: z.number().int().min(3).max(8).default(4),
  theme: z.string().trim().max(80).optional().default(""),
  duration: z.enum(["Quick case", "Standard investigation", "Long investigation"]).default("Standard investigation")
});
export const noteSchema = z.object({ notes: z.string().max(12000) });
export const journalEntryTypes = ["NOTE", "THEORY", "MOTIVE", "CONTRADICTION", "DISCOVERY", "OBSERVATION"] as const;
export const journalEntrySchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(journalEntryTypes),
  title: z.string().trim().max(120).default(""),
  content: z.string().trim().min(1).max(4000),
  evidenceIds: z.array(z.string().min(1).max(100)).max(30).default([]),
  suspectIds: z.array(z.string().min(1).max(100)).max(8).default([]),
  createdAt: z.iso.datetime().optional()
});
export const journalSchema = z.object({ entries: z.array(journalEntrySchema).max(50) }).superRefine(({ entries }, ctx) => {
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) ctx.addIssue({ code: "custom", message: "Journal entry IDs must be unique.", path: ["entries"] });
});
export const boardNodeSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(["evidence", "suspect", "annotation"]),
  entityId: z.string().min(1).max(100).optional(),
  label: z.string().trim().min(1).max(120),
  text: z.string().max(2000).optional(),
  x: z.number().finite().min(-10000).max(10000),
  y: z.number().finite().min(-10000).max(10000)
}).superRefine((node, ctx) => {
  if (node.kind !== "annotation" && !node.entityId) ctx.addIssue({ code: "custom", message: "Evidence and suspect cards must reference a case item.", path: ["entityId"] });
  if (node.kind === "annotation" && !node.text?.trim()) ctx.addIssue({ code: "custom", message: "Annotations cannot be empty.", path: ["text"] });
});
export const boardEdgeSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.string().min(1).max(120),
  target: z.string().min(1).max(120),
  label: z.string().trim().max(80).optional()
});
export const boardSchema = z.object({
  nodes: z.array(boardNodeSchema).max(120),
  edges: z.array(boardEdgeSchema).max(300)
}).superRefine(({ nodes, edges }, ctx) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) ctx.addIssue({ code: "custom", message: "Board node IDs must be unique.", path: ["nodes"] });
  if (new Set(edges.map((edge) => edge.id)).size !== edges.length) ctx.addIssue({ code: "custom", message: "Board connection IDs must be unique.", path: ["edges"] });
  edges.forEach((edge, index) => {
    if (edge.source === edge.target || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      ctx.addIssue({ code: "custom", message: "Board connections must link two different existing cards.", path: ["edges", index] });
    }
  });
});
export const confidenceSchema = z.object({
  ratings: z.array(z.object({ suspectId: z.string().min(1).max(100), confidence: z.number().int().min(0).max(100) })).max(8)
}).superRefine(({ ratings }, ctx) => {
  if (new Set(ratings.map((rating) => rating.suspectId)).size !== ratings.length) ctx.addIssue({ code: "custom", message: "Confidence ratings must be unique per suspect.", path: ["ratings"] });
});
export const progressSchema = z.object({
  progress: z.number().int().min(0).max(100).optional(),
  markedEvidence: z.array(z.string().min(1)).max(100).optional(),
  examinedEvidenceId: z.string().min(1).max(100).optional(),
  investigatedSuspectId: z.string().min(1).max(100).optional(),
  timelineReviewed: z.boolean().optional()
});
export const accusationSchema = z.object({
  suspectId: z.string().min(1),
  explanation: z.string().trim().max(3000).default(""),
  supportingEvidenceIds: z.array(z.string().min(1)).max(30).default([])
});

export const suspectBlueprintSchema = z.object({
  suspectId: z.string().min(1),
  fullName: z.string().min(2),
  age: z.number().int().min(18).max(110),
  occupation: z.string().min(2),
  relationship: z.string().min(2),
  background: z.string().min(10),
  motive: z.string().min(5),
  opportunity: z.string().min(5),
  alibi: z.string().min(5),
  personality: z.string().min(5),
  hiddenInformation: z.string().min(5),
  publicMotive: z.string().min(3),
  publicAlibi: z.string().min(5)
});
export const planItemSchema = z.object({
  evidenceId: z.string().min(1),
  title: z.string().min(3),
  category: z.enum(evidenceCategories),
  description: z.string().min(10),
  source: z.string().min(3),
  timestamp: z.string().min(3),
  relatedSuspectIds: z.array(z.string()),
  criticalClueIds: z.array(z.string()).default([]),
  informationRevealed: z.string().min(5),
  hiddenClue: z.string().min(5),
  isRedHerring: z.boolean(),
  reliability: z.enum(["LOW", "MEDIUM", "HIGH"])
});
export const scenarioAnalysisSchema = z.object({
  incident: z.string().min(10),
  setting: z.string().min(3),
  characters: z.array(z.string()).min(1),
  possibleMotives: z.array(z.string()).min(1),
  mysteryCategory: z.string().min(3),
  narrativeConstraints: z.array(z.string()).default([])
});
export const mysteryBlueprintSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(30),
  location: z.string().min(3),
  incidentDate: z.string().min(8),
  incidentTime: z.string().min(3),
  investigationObjective: z.string().min(10),
  incident: z.object({
    subject: z.string().min(2),
    summary: z.string().min(20),
    happenedAt: z.string().min(8),
    location: z.string().min(3),
    background: z.string().min(10)
  }),
  suspects: z.array(suspectBlueprintSchema).min(3).max(8),
  solution: z.object({
    culpritSuspectId: z.string().min(1),
    motive: z.string().min(10),
    actualTimeline: z.array(z.object({ time: z.string(), event: z.string().min(5) })).min(3),
    completeExplanation: z.string().min(40),
    criticalClues: z.array(z.object({ clueId: z.string().min(1), description: z.string().min(10), inference: z.string().min(10) })).min(2),
    redHerringExplanations: z.array(z.string()).default([]),
    suspectInnocenceExplanations: z.array(z.object({ suspectId: z.string(), explanation: z.string() })).default([]),
    motiveTerms: z.array(z.string().min(3)).min(2).max(12)
  })
});
export const evidencePlanSchema = z.object({ evidencePlan: z.array(planItemSchema).min(8).max(12) });
export const evidenceContentSchema = z.object({ evidence: z.array(z.object({
  evidenceId: z.string().min(1),
  content: z.string().min(15),
  observations: z.array(z.string()).default([]),
  clueText: z.string().min(5)
})).min(8).max(12) });
export type EvidenceContent = z.infer<typeof evidenceContentSchema>;

export type Genre = (typeof genres)[number];
export type Difficulty = (typeof difficulties)[number];
export type EvidenceCategory = (typeof evidenceCategories)[number];
export type CaseStatus = (typeof caseStatuses)[number];
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CaseCreationInput = z.infer<typeof caseCreationSchema>;
export type AccusationInput = z.infer<typeof accusationSchema>;
export type MysteryBlueprint = z.infer<typeof mysteryBlueprintSchema>;
export type PlanItem = z.infer<typeof planItemSchema>;
export type EvidencePlan = z.infer<typeof evidencePlanSchema>["evidencePlan"];
export type JournalEntry = z.infer<typeof journalEntrySchema>;
export type InvestigationBoard = z.infer<typeof boardSchema>;

export interface PublicUser { id: string; name: string; email: string; avatar?: string }
export interface PublicCase {
  id: string; title: string; description: string; genre: Genre; difficulty: Difficulty; status: CaseStatus;
  suspectCount: number; generationProgress: number; generationStage: string; generationError?: string;
  location?: string; incidentDate?: string; incidentTime?: string; investigationObjective?: string;
  incident?: { subject: string; summary: string; background: string };
  createdAt: string; updatedAt: string; completedAt?: string;
}
export interface PublicSuspect {
  id: string; suspectId: string; fullName: string; age: number; occupation: string; relationship: string;
  background: string; publicMotive: string; publicAlibi: string; personality: string; profileImage?: string;
}
export interface PublicEvidence {
  id: string; evidenceId: string; title: string; category: EvidenceCategory; description: string; content: string;
  observations: string[]; clueText: string; source: string; timestamp: string; relatedSuspectIds: string[];
  reliability: "LOW" | "MEDIUM" | "HIGH"; isSimulatedMedia: boolean; mediaUrl?: string;
}
export interface PublicInvestigation {
  notes: string;
  progress: number;
  markedEvidence: string[];
  examinedEvidenceIds: string[];
  investigatedSuspectIds: string[];
  timelineReviewed: boolean;
  journalEntries: JournalEntry[];
  board: InvestigationBoard;
  confidenceRatings: Array<{ suspectId: string; confidence: number }>;
  isSubmitted: boolean;
  selectedSuspectId?: string;
  score?: number;
}
