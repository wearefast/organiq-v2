import { VerificationRule, VerificationResult } from '../verification-rule.interface';

/**
 * Verification rule for the content-article step.
 * Validates: article body is non-empty, required metadata present.
 */
export class ContentArticleRule implements VerificationRule {
  name = 'content-article-integrity';
  appliesTo = ['content-article'];

  /** Minimum character count for a valid article body */
  private static readonly MIN_CONTENT_LENGTH = 500;

  verify(output: unknown): VerificationResult {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { valid: false, errors: ['Output is not a valid object'] };
    }

    const data = output as Record<string, unknown>;

    // 1. Must have a non-empty title
    if (typeof data.title !== 'string' || !data.title.trim()) {
      errors.push('Missing or empty "title" field');
    }

    // 2. Must have article body content of sufficient length
    const content = data.content ?? data.body;
    if (typeof content !== 'string' || content.trim().length < ContentArticleRule.MIN_CONTENT_LENGTH) {
      errors.push(
        `"content" field is missing or too short (minimum ${ContentArticleRule.MIN_CONTENT_LENGTH} characters)`,
      );
    }

    // 3. Must have a meta description (non-empty string)
    if (typeof data.metaDescription !== 'string' || !data.metaDescription.trim()) {
      errors.push('Missing or empty "metaDescription" field');
    }

    // 4. wordCount should be a positive number when present
    if (data.wordCount !== undefined) {
      const wc = Number(data.wordCount);
      if (!Number.isFinite(wc) || wc <= 0) {
        errors.push(`"wordCount" is not a positive number (got: ${String(data.wordCount)})`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
