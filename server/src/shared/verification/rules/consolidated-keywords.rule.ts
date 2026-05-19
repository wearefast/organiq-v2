import { VerificationRule, VerificationResult } from '../verification-rule.interface';

/**
 * Verification rule for the consolidated-keywords step.
 * Validates: keyword count matches stats, no duplicates, all required fields present.
 */
export class ConsolidatedKeywordsRule implements VerificationRule {
  name = 'consolidated-keywords-integrity';
  appliesTo = ['consolidated-keywords'];

  verify(output: unknown): VerificationResult {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { valid: false, errors: ['Output is not a valid object'] };
    }

    const data = output as Record<string, unknown>;

    // 1. Must have keywords array
    if (!Array.isArray(data.keywords)) {
      return { valid: false, errors: ['Missing or invalid "keywords" array'] };
    }

    const keywords = data.keywords as Array<Record<string, unknown>>;

    // 2. Must have at least 1 keyword
    if (keywords.length === 0) {
      errors.push('Keywords array is empty');
    }

    // 3. Stats.afterDedup must match actual keyword count
    const stats = data.stats as Record<string, unknown> | undefined;
    if (stats && typeof stats.afterDedup === 'number') {
      if (stats.afterDedup !== keywords.length) {
        errors.push(
          `stats.afterDedup (${stats.afterDedup}) does not match actual keyword count (${keywords.length})`,
        );
      }
    }

    // 4. No duplicate keywords (case-insensitive)
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const kw of keywords) {
      const keyword = String(kw.keyword ?? '').toLowerCase().trim();
      if (!keyword) {
        errors.push('Found keyword entry with empty "keyword" field');
        continue;
      }
      if (seen.has(keyword)) {
        duplicates.push(keyword);
      }
      seen.add(keyword);
    }
    if (duplicates.length > 0) {
      errors.push(`Found ${duplicates.length} duplicate keyword(s): ${duplicates.slice(0, 5).join(', ')}${duplicates.length > 5 ? '...' : ''}`);
    }

    // 5. Required fields on each keyword
    const requiredFields = ['keyword', 'volume', 'difficulty', 'intent', 'funnelStage', 'opportunityScore', 'source'];
    const missingFieldCounts = new Map<string, number>();

    for (const kw of keywords.slice(0, 200)) {
      for (const field of requiredFields) {
        if (kw[field] === undefined || kw[field] === null) {
          missingFieldCounts.set(field, (missingFieldCounts.get(field) ?? 0) + 1);
        }
      }
    }

    for (const [field, count] of missingFieldCounts) {
      if (count > 0) {
        errors.push(`${count} keyword(s) missing required field "${field}"`);
      }
    }

    // 6. Intent values must be valid
    const validIntents = new Set(['informational', 'navigational', 'commercial', 'transactional']);
    const invalidIntents = keywords
      .filter((kw) => kw.intent && !validIntents.has(String(kw.intent).toLowerCase()))
      .slice(0, 3);
    if (invalidIntents.length > 0) {
      errors.push(`Invalid intent value(s): ${invalidIntents.map((k) => k.intent).join(', ')}`);
    }

    // 7. Funnel stage must be valid
    const validFunnels = new Set(['tofu', 'mofu', 'bofu', 'TOFU', 'MOFU', 'BOFU']);
    const invalidFunnels = keywords
      .filter((kw) => kw.funnelStage && !validFunnels.has(String(kw.funnelStage)))
      .slice(0, 3);
    if (invalidFunnels.length > 0) {
      errors.push(`Invalid funnelStage value(s): ${invalidFunnels.map((k) => k.funnelStage).join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }
}
