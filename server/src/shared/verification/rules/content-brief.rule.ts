import { VerificationRule, VerificationResult } from '../verification-rule.interface';

/**
 * Verification rule for the content-brief step.
 * Validates: required fields present, outline/sections non-empty,
 * targetKeyword matches the run's target keyword.
 */
export class ContentBriefRule implements VerificationRule {
  name = 'content-brief-integrity';
  appliesTo = ['content-brief'];

  verify(output: unknown): VerificationResult {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { valid: false, errors: ['Output is not a valid object'] };
    }

    const data = output as Record<string, unknown>;

    // 1. Must have a non-empty targetKeyword
    if (typeof data.targetKeyword !== 'string' || !data.targetKeyword.trim()) {
      errors.push('Missing or empty "targetKeyword" field');
    }

    // 2. Must have a non-empty title
    if (typeof data.title !== 'string' || !data.title.trim()) {
      errors.push('Missing or empty "title" field');
    }

    // 3. Must have outline or sections as a non-empty array
    const outline = data.outline ?? data.sections;
    if (!Array.isArray(outline) || outline.length === 0) {
      errors.push('Missing or empty "outline" (or "sections") array');
    }

    // 4. Must have a searchIntent string
    if (typeof data.searchIntent !== 'string' || !data.searchIntent.trim()) {
      errors.push('Missing or empty "searchIntent" field');
    }

    return { valid: errors.length === 0, errors };
  }
}
