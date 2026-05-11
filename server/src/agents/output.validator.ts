import { Injectable, Logger } from '@nestjs/common';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class OutputValidator {
  private readonly logger = new Logger(OutputValidator.name);

  /**
   * Validate an agent's output against a JSON Schema.
   * Uses a lightweight approach: checks required fields, types, and basic constraints.
   */
  validate(output: unknown, schema: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (output === null || output === undefined) {
      return { valid: false, errors: ['Output is null or undefined'] };
    }

    if (schema.type === 'object' && typeof output !== 'object') {
      return { valid: false, errors: [`Expected object, got ${typeof output}`] };
    }

    if (schema.type === 'array' && !Array.isArray(output)) {
      return { valid: false, errors: [`Expected array, got ${typeof output}`] };
    }

    // Check required fields
    if (schema.required && Array.isArray(schema.required) && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      for (const field of schema.required as string[]) {
        if (!(field in obj) || obj[field] === undefined || obj[field] === null) {
          errors.push(`Missing required field: "${field}"`);
        }
      }
    }

    // Check property types
    if (schema.properties && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      const properties = schema.properties as Record<string, Record<string, unknown>>;

      for (const [key, propSchema] of Object.entries(properties)) {
        if (key in obj && obj[key] !== null && obj[key] !== undefined) {
          const expectedType = propSchema.type as string;
          const actualValue = obj[key];

          if (expectedType === 'string' && typeof actualValue !== 'string') {
            errors.push(`Field "${key}": expected string, got ${typeof actualValue}`);
          }
          if (expectedType === 'number' && typeof actualValue !== 'number') {
            errors.push(`Field "${key}": expected number, got ${typeof actualValue}`);
          }
          if (expectedType === 'boolean' && typeof actualValue !== 'boolean') {
            errors.push(`Field "${key}": expected boolean, got ${typeof actualValue}`);
          }
          if (expectedType === 'array' && !Array.isArray(actualValue)) {
            errors.push(`Field "${key}": expected array, got ${typeof actualValue}`);
          }
          if (expectedType === 'object' && (typeof actualValue !== 'object' || Array.isArray(actualValue))) {
            errors.push(`Field "${key}": expected object, got ${Array.isArray(actualValue) ? 'array' : typeof actualValue}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      this.logger.debug(`Validation failed with ${errors.length} errors`);
    }

    return { valid: errors.length === 0, errors };
  }
}
