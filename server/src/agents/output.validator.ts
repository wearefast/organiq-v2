import { Injectable, Logger } from '@nestjs/common';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

@Injectable()
export class OutputValidator {
  private readonly logger = new Logger(OutputValidator.name);

  /**
   * Validate an agent's output against the structured example declared in the
   * agent definition's "Output Schema" block.
   */
  validate(output: unknown, schema: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (output === null || output === undefined) {
      return { valid: false, errors: ['Output is null or undefined'] };
    }

    this.validateValue(output, schema, 'output', errors);

    if (errors.length > 0) {
      this.logger.debug(`Validation failed with ${errors.length} errors`);
    }

    return { valid: errors.length === 0, errors };
  }

  private validateValue(
    value: unknown,
    schemaExample: unknown,
    path: string,
    errors: string[],
  ): void {
    if (schemaExample === null) {
      if (value === undefined) {
        errors.push(`${path}: missing required field`);
      }
      return;
    }

    if (typeof schemaExample === 'string') {
      const allowsNull = schemaExample.includes('null');
      if (value === null && allowsNull) return;
      if (typeof value !== 'string') {
        errors.push(`${path}: expected string, got ${this.describeValue(value)}`);
      }
      return;
    }

    if (typeof schemaExample === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${path}: expected number, got ${this.describeValue(value)}`);
      }
      return;
    }

    if (typeof schemaExample === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${path}: expected boolean, got ${this.describeValue(value)}`);
      }
      return;
    }

    if (Array.isArray(schemaExample)) {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${this.describeValue(value)}`);
        return;
      }

      if (schemaExample.length === 0) return;

      const itemSchema = schemaExample[0];
      for (let index = 0; index < value.length; index += 1) {
        this.validateValue(value[index], itemSchema, `${path}[${index}]`, errors);
      }
      return;
    }

    if (typeof schemaExample === 'object') {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${this.describeValue(value)}`);
        return;
      }

      const valueObject = value as Record<string, unknown>;
      for (const [key, childSchema] of Object.entries(schemaExample as Record<string, unknown>)) {
        if (!(key in valueObject)) {
          errors.push(`${path}.${key}: missing required field`);
          continue;
        }

        this.validateValue(valueObject[key], childSchema, `${path}.${key}`, errors);
      }
    }
  }

  private describeValue(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }
}
