/**
 * Pipeline interface for Tier 1 steps.
 * Tier 1 = deterministic code (no LLM), direct API calls + data transformation.
 */
export interface Pipeline {
  /** Step key this pipeline handles */
  stepKey: string;

  /** Execute the pipeline with the given workflow context */
  execute(context: Record<string, unknown>): Promise<unknown>;
}
