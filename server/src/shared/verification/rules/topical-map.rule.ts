import { VerificationRule, VerificationResult } from '../verification-rule.interface';

/**
 * Verification rule for the topical-map step.
 * Validates: pillars exist with clusters and pages, calendar is non-empty.
 */
export class TopicalMapRule implements VerificationRule {
  name = 'topical-map-integrity';
  appliesTo = ['topical-map'];

  verify(output: unknown): VerificationResult {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { valid: false, errors: ['Output is not a valid object'] };
    }

    const data = output as Record<string, unknown>;

    // Must have pillars array
    if (!Array.isArray(data.pillars)) {
      return { valid: false, errors: ['Missing or invalid "pillars" array'] };
    }

    const pillars = data.pillars as Array<Record<string, unknown>>;

    if (pillars.length === 0) {
      errors.push('pillars array is empty — must have at least 1 pillar');
    }

    // Each pillar must have clusters with pages
    for (let i = 0; i < Math.min(pillars.length, 20); i++) {
      const pillar = pillars[i];
      if (!pillar.name) {
        errors.push(`Pillar ${i} missing "name"`);
      }
      if (!Array.isArray(pillar.clusters) || (pillar.clusters as unknown[]).length === 0) {
        errors.push(`Pillar "${pillar.name || i}" has no clusters`);
      } else {
        const clusters = pillar.clusters as Array<Record<string, unknown>>;
        for (let j = 0; j < Math.min(clusters.length, 10); j++) {
          const cluster = clusters[j];
          if (!Array.isArray(cluster.pages) || (cluster.pages as unknown[]).length === 0) {
            errors.push(`Cluster "${cluster.name || j}" in pillar "${pillar.name || i}" has no pages`);
            break; // Only report first empty cluster per pillar
          }
        }
      }
    }

    // Must have calendar
    if (!Array.isArray(data.calendar)) {
      errors.push('Missing or invalid "calendar" array');
    } else if ((data.calendar as unknown[]).length === 0) {
      errors.push('calendar array is empty');
    }

    // Must have linkingArchitecture
    if (!data.linkingArchitecture || typeof data.linkingArchitecture !== 'object') {
      errors.push('Missing "linkingArchitecture" object');
    }

    return { valid: errors.length === 0, errors };
  }
}
