export function calculateInvestigationProgress(input: {
  evidenceCount: number;
  examinedEvidenceCount: number;
  suspectCount: number;
  investigatedSuspectCount: number;
  markedEvidenceCount: number;
  timelineReviewed: boolean;
}) {
  const evidence = input.evidenceCount ? input.examinedEvidenceCount / input.evidenceCount : 0;
  const suspects = input.suspectCount ? input.investigatedSuspectCount / input.suspectCount : 0;
  const clues = input.evidenceCount ? input.markedEvidenceCount / input.evidenceCount : 0;
  return Math.round(100 * (evidence * 0.45 + suspects * 0.25 + (input.timelineReviewed ? 0.2 : 0) + clues * 0.1));
}

export function calculateAccusationScore(input: {
  suspectId: string;
  explanation: string;
  supportingEvidenceIds: string[];
}, solution: {
  culpritSuspectId: string;
  motiveTerms: string[];
  criticalEvidenceIds: string[];
  actualTimeline: Array<{ time?: string | null; event?: string | null }>;
}) {
  const correct = input.suspectId === solution.culpritSuspectId;
  const explanation = input.explanation.toLowerCase();
  const matchedTerms = solution.motiveTerms.filter((term) => explanation.includes(term.toLowerCase())).length;
  const motive = solution.motiveTerms.length ? Math.round(20 * matchedTerms / solution.motiveTerms.length) : 0;
  const selectedCritical = input.supportingEvidenceIds.filter((id) => solution.criticalEvidenceIds.includes(id)).length;
  const evidence = solution.criticalEvidenceIds.length ? Math.round(20 * selectedCritical / solution.criticalEvidenceIds.length) : 0;
  const timelineTerms = solution.actualTimeline
    .flatMap((event) => `${event.time || ""} ${event.event || ""}`.toLowerCase().split(/[^a-z0-9:]+/))
    .filter((term) => term.length >= 5);
  const timelineMatches = new Set(timelineTerms.filter((term) => explanation.includes(term))).size;
  const timeline = timelineTerms.length ? Math.min(10, Math.round(10 * timelineMatches / Math.min(6, timelineTerms.length))) : 0;
  const breakdown = { culprit: correct ? 50 : 0, motive, evidence, timeline };
  return { isCorrect: correct, score: Object.values(breakdown).reduce((sum, points) => sum + points, 0), breakdown };
}
