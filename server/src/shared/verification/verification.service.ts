import { Injectable, Logger } from '@nestjs/common';
import { VerificationRule, VerificationResult } from './verification-rule.interface';
import { ConsolidatedKeywordsRule } from './rules/consolidated-keywords.rule';
import { VerdictStrategyRule } from './rules/verdict-strategy.rule';
import { TopicalMapRule } from './rules/topical-map.rule';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);
  private readonly rules: VerificationRule[];

  constructor() {
    this.rules = [
      new ConsolidatedKeywordsRule(),
      new VerdictStrategyRule(),
      new TopicalMapRule(),
    ];
  }

  /**
   * Verify agent output against all applicable rules for the given step.
   * Returns combined result of all matching rules.
   */
  verify(stepKey: string, output: unknown, context?: Record<string, unknown>): VerificationResult {
    const applicableRules = this.rules.filter((r) => r.appliesTo.includes(stepKey));

    if (applicableRules.length === 0) {
      return { valid: true, errors: [] };
    }

    const allErrors: string[] = [];

    for (const rule of applicableRules) {
      const result = rule.verify(output, context);
      if (!result.valid) {
        this.logger.warn(`Verification rule "${rule.name}" failed for step "${stepKey}": ${result.errors.join('; ')}`);
        allErrors.push(...result.errors);
      }
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
    };
  }

  /** Get list of registered rules for a step */
  getRulesForStep(stepKey: string): string[] {
    return this.rules.filter((r) => r.appliesTo.includes(stepKey)).map((r) => r.name);
  }
}
