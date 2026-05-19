import { VerificationRule, VerificationResult } from '../verification-rule.interface';

/**
 * Verification rule for the verdict-strategy step.
 * Validates: required top-level sections exist with non-empty arrays.
 */
export class VerdictStrategyRule implements VerificationRule {
  name = 'verdict-strategy-integrity';
  appliesTo = ['verdict-strategy'];

  verify(output: unknown): VerificationResult {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { valid: false, errors: ['Output is not a valid object'] };
    }

    const data = output as Record<string, unknown>;

    // Required top-level keys
    const requiredKeys = ['executiveSummary', 'swot', 'verdict', 'priorityMatrix', 'actionPlan', 'kpis'];
    for (const key of requiredKeys) {
      if (data[key] === undefined || data[key] === null) {
        errors.push(`Missing required section "${key}"`);
      }
    }

    // SWOT must have all 4 categories with at least 1 item each
    const swot = data.swot as Record<string, unknown[]> | undefined;
    if (swot && typeof swot === 'object') {
      for (const cat of ['strengths', 'weaknesses', 'opportunities', 'threats']) {
        if (!Array.isArray(swot[cat]) || swot[cat].length === 0) {
          errors.push(`swot.${cat} must be a non-empty array`);
        }
      }
    }

    // Verdict must have competeIn with at least 1 entry
    const verdict = data.verdict as Record<string, unknown[]> | undefined;
    if (verdict && typeof verdict === 'object') {
      if (!Array.isArray(verdict.competeIn) || verdict.competeIn.length === 0) {
        errors.push('verdict.competeIn must have at least 1 entry');
      }
    }

    // priorityMatrix must be non-empty
    if (Array.isArray(data.priorityMatrix) && data.priorityMatrix.length === 0) {
      errors.push('priorityMatrix must be a non-empty array');
    }

    // actionPlan must have at least month1
    const plan = data.actionPlan as Record<string, unknown> | undefined;
    if (plan && typeof plan === 'object') {
      if (!plan.month1) {
        errors.push('actionPlan must include at least month1');
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
