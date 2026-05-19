/**
 * Prompt Evaluation Framework
 * 
 * Loads an agent definition + synthetic test input, executes via Claude,
 * and validates output against a rubric (structural checks).
 * 
 * This is a lightweight alternative to full LLM-as-judge — it checks
 * that the output conforms to expected schema and contains required fields.
 */

export interface EvalCase {
  /** Test case name */
  name: string;
  /** Step key to evaluate */
  stepKey: string;
  /** Synthetic input context for the prompt */
  context: Record<string, unknown>;
  /** Rubric: structural checks the output must pass */
  rubric: RubricCheck[];
}

export interface RubricCheck {
  /** What we're checking */
  description: string;
  /** Path to check in the output (dot-notation) */
  path?: string;
  /** Check type */
  check: 'exists' | 'array_min' | 'type' | 'contains' | 'custom';
  /** Expected value (for array_min: minimum length, for type: expected type, for contains: substring) */
  expected?: unknown;
  /** Custom check function (for 'custom' type) */
  fn?: (output: unknown) => boolean;
}

export interface EvalResult {
  caseName: string;
  stepKey: string;
  passed: boolean;
  checks: Array<{ description: string; passed: boolean; actual?: unknown }>;
  durationMs: number;
  error?: string;
}

/**
 * Evaluate output against a rubric.
 * Does NOT call the LLM — just validates an existing output.
 */
export function evaluateOutput(output: unknown, rubric: RubricCheck[]): Array<{ description: string; passed: boolean; actual?: unknown }> {
  return rubric.map((check) => {
    try {
      const value = check.path ? resolvePath(output, check.path) : output;

      switch (check.check) {
        case 'exists':
          return { description: check.description, passed: value !== undefined && value !== null, actual: value === undefined ? 'undefined' : 'exists' };

        case 'array_min': {
          const isArray = Array.isArray(value);
          const minLen = check.expected as number;
          return { description: check.description, passed: isArray && value.length >= minLen, actual: isArray ? value.length : 'not an array' };
        }

        case 'type': {
          const expectedType = check.expected as string;
          const actualType = Array.isArray(value) ? 'array' : typeof value;
          return { description: check.description, passed: actualType === expectedType, actual: actualType };
        }

        case 'contains': {
          const needle = check.expected as string;
          const haystack = typeof value === 'string' ? value : JSON.stringify(value);
          return { description: check.description, passed: haystack.includes(needle), actual: typeof value };
        }

        case 'custom': {
          if (!check.fn) return { description: check.description, passed: false, actual: 'no fn provided' };
          return { description: check.description, passed: check.fn(value), actual: value };
        }

        default:
          return { description: check.description, passed: false, actual: `unknown check type: ${check.check}` };
      }
    } catch (error) {
      return { description: check.description, passed: false, actual: `error: ${(error as Error).message}` };
    }
  });
}

function resolvePath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
