import { z } from "zod";

export const PoOutputSchema = z.object({
  summary: z.string(),
  goals: z.array(z.string()),
  nonGoals: z.array(z.string()),
  acceptanceCriteria: z.array(z.string()),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  openQuestions: z.array(z.string()),
  questionsForDev: z.array(z.string()),
});

export const DevOutputSchema = z.object({
  approach: z.string(),
  plan: z.array(z.string()),
  filesToTouch: z.array(z.string()),
  risks: z.array(z.string()),
  dependencies: z.array(z.string()),
  validationPlan: z.array(z.string()),
  answersForPo: z.array(z.string()),
});

export const DevResearchOutputSchema = z.object({
  answersForPo: z.array(z.string()),
  codeFindings: z.array(z.string()),
  filesVisited: z.array(z.string()),
  assumptions: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

export const ImplementationOutputSchema = z.object({
  summary: z.string(),
  filesChanged: z.array(z.string()),
  patchesApplied: z.array(z.string()),
  testsRun: z.array(z.string()),
  risks: z.array(z.string()),
  notes: z.array(z.string()),
});

export const QaOutputSchema = z.object({
  testPlan: z.array(z.string()),
  edgeCases: z.array(z.string()),
  riskAreas: z.array(z.string()),
  automationCandidates: z.array(z.string()),
  qualityGate: z.array(z.string()),
});

export const OrchestratorOutputSchema = z.object({
  decision: z.enum(["PROCEED", "NEEDS_INPUT", "BLOCKED"]),
  summary: z.string(),
  rationale: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type PoOutput = z.infer<typeof PoOutputSchema>;
export type DevOutput = z.infer<typeof DevOutputSchema>;
export type DevResearchOutput = z.infer<typeof DevResearchOutputSchema>;
export type ImplementationOutput = z.infer<typeof ImplementationOutputSchema>;
export type QaOutput = z.infer<typeof QaOutputSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
