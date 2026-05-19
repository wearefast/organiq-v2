/**
 * Verification rule interface.
 * Each agent step can have one or more verification rules
 * that validate the output before credits are debited.
 */
export interface VerificationRule {
  /** Unique name of this rule */
  name: string;

  /** Step keys this rule applies to */
  appliesTo: string[];

  /**
   * Validate the agent output.
   * Returns { valid: true } or { valid: false, errors: string[] }.
   * Errors are passed back to the agent as feedback for retry.
   */
  verify(output: unknown, context?: Record<string, unknown>): VerificationResult;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
}
