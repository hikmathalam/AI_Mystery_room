import { z } from "zod";
import { evidencePlanSchema, mysteryBlueprintSchema, scenarioAnalysisSchema } from "@mystery-room/shared";
import type { CaseCreationInput, EvidenceContent, EvidencePlan, MysteryBlueprint } from "@mystery-room/shared";
import { Case } from "../models/Case.js";
import { CaseSolution } from "../models/CaseSolution.js";
import { Evidence } from "../models/Evidence.js";
import { Suspect } from "../models/Suspect.js";
import { HttpError } from "../utils/HttpError.js";
import { generateJson } from "./geminiProvider.js";
import { generateEvidenceImage } from "./mediaProvider.js";
import { scenarioAnalyzerSystemPrompt, scenarioAnalyzerUserPrompt } from "./prompts/scenarioAnalyzer.prompt.js";
import { mysteryGeneratorSystemPrompt, mysteryGeneratorUserPrompt } from "./prompts/mysteryGenerator.prompt.js";
import { evidencePlannerSystemPrompt, evidencePlannerUserPrompt } from "./prompts/evidencePlanner.prompt.js";
import { evidenceAnalyzerSystemPrompt, evidenceAnalyzerUserPrompt } from "./prompts/evidenceAnalyzer.prompt.js";
import { consistencyValidatorSystemPrompt } from "./prompts/consistencyValidator.prompt.js";
import { verifyBlueprint, verifyEvidenceContent, verifyEvidencePlan } from "./validation.js";

const consistencySchema = z.object({ isConsistent: z.boolean(), issues: z.array(z.string()).default([]) });
const PROMPT_VERSION = "mystery-room-v1.1";

async function stage(caseId: string, progress: number, generationStage: string) {
  const result = await Case.updateOne({ _id: caseId }, { generationProgress: progress, generationStage });
  if (!result.matchedCount) throw new Error("The case was removed during generation.");
}

function safeStageError(error: unknown) {
  return error instanceof HttpError ? error.message : "The investigation could not be generated. Please try again.";
}

async function validateEvidenceConsistency(blueprint: MysteryBlueprint, plan: EvidencePlan, content: EvidenceContent) {
  return generateJson(
    consistencyValidatorSystemPrompt,
    JSON.stringify({
      approvedPublicCase: { title: blueprint.title, description: blueprint.description, incident: blueprint.incident },
      suspects: blueprint.suspects.map(({ suspectId, fullName, publicAlibi }) => ({ suspectId, fullName, publicAlibi })),
      lockedGroundTruth: blueprint.solution,
      evidencePlan: plan,
      evidenceContent: content.evidence
    }),
    (value) => consistencySchema.parse(value)
  );
}

export async function generateCase(caseId: string, input: CaseCreationInput) {
  try {
    await stage(caseId, 5, "Reading the scenario");
    const record = await Case.findById(caseId).select("+generationAnalysis +generationBlueprint +generationEvidencePlan");
    if (!record) throw new Error("Case not found during generation.");

    let analysis: z.infer<typeof scenarioAnalysisSchema>;
    if (record.generationAnalysis) {
      analysis = scenarioAnalysisSchema.parse(record.generationAnalysis);
    } else {
      analysis = await generateJson(scenarioAnalyzerSystemPrompt, scenarioAnalyzerUserPrompt(input), (value) => scenarioAnalysisSchema.parse(value));
      await Case.updateOne({ _id: caseId }, { generationAnalysis: analysis });
    }

    await stage(caseId, 18, "Building the case blueprint");
    let blueprint: MysteryBlueprint;
    if (record.generationBlueprint) {
      blueprint = verifyBlueprint(record.generationBlueprint, input.suspectCount);
    } else {
      blueprint = await generateJson(mysteryGeneratorSystemPrompt, mysteryGeneratorUserPrompt(input, analysis), (value) => verifyBlueprint(mysteryBlueprintSchema.parse(value), input.suspectCount));
      await Case.updateOne({ _id: caseId }, { generationBlueprint: blueprint, promptVersion: PROMPT_VERSION });
    }

    await stage(caseId, 36, "Locking the ground truth");
    const existingSolution = await CaseSolution.findOne({ caseId }).lean();
    if (existingSolution && existingSolution.culpritSuspectId !== blueprint.solution.culpritSuspectId) {
      throw new Error("The locked ground truth cannot be changed during a retry.");
    }
    if (!existingSolution) {
      await CaseSolution.create({
        caseId,
        culpritSuspectId: blueprint.solution.culpritSuspectId,
        motive: blueprint.solution.motive,
        motiveTerms: blueprint.solution.motiveTerms,
        actualTimeline: blueprint.solution.actualTimeline,
        completeExplanation: blueprint.solution.completeExplanation,
        criticalClues: blueprint.solution.criticalClues,
        criticalEvidenceIds: [],
        redHerringExplanations: blueprint.solution.redHerringExplanations,
        suspectInnocenceExplanations: blueprint.solution.suspectInnocenceExplanations
      });
    }
    await Case.updateOne({ _id: caseId }, {
      title: blueprint.title,
      description: blueprint.description,
      location: blueprint.location,
      incidentDate: blueprint.incidentDate,
      incidentTime: blueprint.incidentTime,
      investigationObjective: blueprint.investigationObjective,
      incident: { subject: blueprint.incident.subject, summary: blueprint.incident.summary, background: blueprint.incident.background },
      promptVersion: PROMPT_VERSION
    });
    await Suspect.deleteMany({ caseId });
    await Suspect.insertMany(blueprint.suspects.map((suspect) => ({
      caseId,
      suspectId: suspect.suspectId,
      fullName: suspect.fullName,
      age: suspect.age,
      occupation: suspect.occupation,
      relationship: suspect.relationship,
      background: suspect.background,
      publicMotive: suspect.publicMotive,
      publicAlibi: suspect.publicAlibi,
      personality: suspect.personality,
      profileImage: ""
    })));

    await stage(caseId, 49, "Planning evidence against the locked solution");
    let evidencePlan: EvidencePlan;
    if (record.generationEvidencePlan) {
      evidencePlan = verifyEvidencePlan(evidencePlanSchema.parse({ evidencePlan: record.generationEvidencePlan }).evidencePlan, blueprint);
    } else {
      const solution = await CaseSolution.findOne({ caseId }).lean();
      evidencePlan = await generateJson(
        evidencePlannerSystemPrompt,
        evidencePlannerUserPrompt({ case: blueprint, lockedSolution: solution }),
        (value) => verifyEvidencePlan(evidencePlanSchema.parse(value).evidencePlan, blueprint)
      );
      await Case.updateOne({ _id: caseId }, { generationEvidencePlan: evidencePlan });
    }
    const criticalEvidenceIds = evidencePlan.filter((item) => item.criticalClueIds.length > 0).map((item) => item.evidenceId);
    await CaseSolution.updateOne({ caseId }, { criticalEvidenceIds });

    await stage(caseId, 60, "Writing fictional evidence");
    const approvedCase = {
      title: blueprint.title,
      incident: blueprint.incident,
      location: blueprint.location,
      suspects: blueprint.suspects.map(({ suspectId, fullName, relationship, publicAlibi }) => ({ suspectId, fullName, relationship, publicAlibi })),
      lockedSolution: blueprint.solution,
      evidencePlan
    };
    await Evidence.deleteMany({ caseId });
    let evidenceContent = await generateJson(evidenceAnalyzerSystemPrompt, evidenceAnalyzerUserPrompt(approvedCase), (value) => verifyEvidenceContent(value, evidencePlan));

    await stage(caseId, 75, "Checking chronology and clue consistency");
    let consistency = await validateEvidenceConsistency(blueprint, evidencePlan, evidenceContent);
    if (!consistency.isConsistent) {
      evidenceContent = await generateJson(evidenceAnalyzerSystemPrompt, evidenceAnalyzerUserPrompt(approvedCase, consistency.issues), (value) => verifyEvidenceContent(value, evidencePlan));
      consistency = await validateEvidenceConsistency(blueprint, evidencePlan, evidenceContent);
      if (!consistency.isConsistent) throw new Error("Evidence could not be made consistent with the approved timeline.");
    }

    await stage(caseId, 86, "Preparing optional evidence media");
    const [generatedImages, generatedPortraits] = await Promise.all([
      Promise.all(evidencePlan.filter((item) => item.category === "IMAGE").map(async (item) => {
        const url = await generateEvidenceImage(`Create a fictional investigative photograph for a detective game. It must be a believable documentary-style image of: ${item.description}. The case location is ${blueprint.location}. Do not show readable text or real people.`, caseId, item.evidenceId);
        return [item.evidenceId, url] as const;
      })),
      Promise.all(blueprint.suspects.map(async (suspect) => {
        const url = await generateEvidenceImage(`Create a fictional case-file portrait photograph of ${suspect.fullName}, age ${suspect.age}, ${suspect.occupation}. This is a fictional character, neutral documentary portrait, simple dark background, no text.`, caseId, `suspect_${suspect.suspectId}`);
        return [suspect.suspectId, url] as const;
      }))
    ]);
    const imageById = new Map(generatedImages);
    const portraitBySuspect = new Map(generatedPortraits);
    for (const [suspectId, profileImage] of portraitBySuspect) {
      if (profileImage) await Suspect.updateOne({ caseId, suspectId }, { profileImage });
    }
    for (const item of evidencePlan) {
      const content = evidenceContent.evidence.find((entry) => entry.evidenceId === item.evidenceId)!;
      await Evidence.create({
        caseId,
        evidenceId: item.evidenceId,
        title: item.title,
        category: item.category,
        description: item.description,
        content: content.content,
        observations: content.observations,
        clueText: content.clueText,
        source: item.source,
        timestamp: item.timestamp,
        relatedSuspectIds: item.relatedSuspectIds,
        reliability: item.reliability,
        isSimulatedMedia: item.category === "CCTV" || (item.category === "IMAGE" && !imageById.get(item.evidenceId)),
        mediaUrl: imageById.get(item.evidenceId) || ""
      });
    }

    await stage(caseId, 96, "Publishing the case file");
    await Case.updateOne({ _id: caseId }, { status: "READY", generationProgress: 100, generationStage: "Case ready", generationError: "" });
  } catch (error) {
    console.error(`Case generation failed for ${caseId}:`, error);
    await Case.updateOne({ _id: caseId }, {
      status: "FAILED",
      generationError: safeStageError(error),
      generationStage: "Generation failed"
    });
  }
}
