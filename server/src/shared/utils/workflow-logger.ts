import { Logger } from '@nestjs/common';

/**
 * Structured logger for workflow execution events.
 * Every log line is prefixed with [run:SHORT_ID step:STEP_KEY] for easy grep/filter.
 *
 * Usage:
 *   const wl = new WorkflowLogger(this.logger, workflowRunId, stepKey);
 *   wl.stepStarted();
 *   wl.apiCall('DataForSEO', '/keywords_data/…', { keywords: 47 });
 *   wl.apiSuccess('DataForSEO', '/keywords_data/…', 2300, { returned: 47 });
 *   wl.apiFailed('DataForSEO', '/keywords_data/…', 2300, err);
 *   wl.agentIteration(2, 10, 'tool_use');
 *   wl.toolCall('search_keyword_data', { keywords: 5 }, true, 800);
 *   wl.stepCompleted('completed', 3, 12400, 45_000);
 */
export class WorkflowLogger {
  private readonly prefix: string;

  constructor(
    private readonly logger: Logger,
    private readonly runId: string,
    private readonly stepKey: string,
  ) {
    this.prefix = `[run:${runId.slice(0, 8)} step:${stepKey}]`;
  }

  // ─── Step Lifecycle ──────────────────────────────────────

  stepStarted(): void {
    this.logger.log(`${this.prefix} STEP_STARTED`);
  }

  stepCompleted(
    status: string,
    iterations: number,
    totalTokens: number,
    durationMs: number,
  ): void {
    this.logger.log(
      `${this.prefix} STEP_COMPLETED status=${status} iterations=${iterations} tokens=${totalTokens} duration=${durationMs}ms`,
    );
  }

  stepFailed(error: string, attempt: number, maxAttempts: number): void {
    this.logger.error(
      `${this.prefix} STEP_FAILED attempt=${attempt}/${maxAttempts} error="${error}"`,
    );
  }

  // ─── Phase Transitions ────────────────────────────────────

  phaseStarted(phase: 'pipeline' | 'agent'): void {
    this.logger.log(`${this.prefix} PHASE_STARTED phase=${phase}`);
  }

  phaseCompleted(phase: 'pipeline' | 'agent', durationMs: number, summary?: string): void {
    this.logger.log(
      `${this.prefix} PHASE_COMPLETED phase=${phase} duration=${durationMs}ms${summary ? ` summary="${summary}"` : ''}`,
    );
  }

  pipelineOutput(data: unknown): void {
    try {
      const summary = summarizeOutput(data);
      this.logger.log(`${this.prefix} PIPELINE_OUTPUT ${summary}`);
    } catch {
      this.logger.log(`${this.prefix} PIPELINE_OUTPUT (summary failed)`);
    }
  }

  // ─── Agent Loop ───────────────────────────────────────────

  agentStart(model: string, tools: number, maxIterations: number, contextTokenEst: number): void {
    this.logger.log(
      `${this.prefix} AGENT_START model=${model} tools=${tools} maxIter=${maxIterations} ctxEst~${contextTokenEst}tok`,
    );
  }

  agentIteration(
    iteration: number,
    maxIterations: number,
    stopReason: string,
    inputTokens: number,
    outputTokens: number,
    cacheRead: number,
    cacheCreate: number,
    durationMs: number,
  ): void {
    this.logger.log(
      `${this.prefix} AGENT_ITER iter=${iteration}/${maxIterations} stopReason=${stopReason} ` +
        `tokens={in:${inputTokens},out:${outputTokens},cacheRead:${cacheRead},cacheCreate:${cacheCreate}} duration=${durationMs}ms`,
    );
  }

  toolCall(
    toolName: string,
    inputSummary: string,
    success: boolean,
    durationMs: number,
    errorMsg?: string,
  ): void {
    if (success) {
      this.logger.log(
        `${this.prefix} TOOL_CALL tool=${toolName} input=${inputSummary} status=OK duration=${durationMs}ms`,
      );
    } else {
      this.logger.error(
        `${this.prefix} TOOL_CALL tool=${toolName} input=${inputSummary} status=FAILED duration=${durationMs}ms error="${errorMsg}"`,
      );
    }
  }

  agentCompleted(
    finishReason: string,
    iterations: number,
    totalInputTokens: number,
    totalOutputTokens: number,
    toolCallCount: number,
    durationMs: number,
  ): void {
    this.logger.log(
      `${this.prefix} AGENT_COMPLETED finishReason=${finishReason} iterations=${iterations} ` +
        `totalTokens={in:${totalInputTokens},out:${totalOutputTokens}} toolCalls=${toolCallCount} duration=${durationMs}ms`,
    );
  }

  // ─── External API Calls ───────────────────────────────────

  apiCall(service: string, endpoint: string, params?: Record<string, unknown>): void {
    const paramStr = params
      ? ' ' + Object.entries(params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')
      : '';
    this.logger.log(`${this.prefix} API_CALL service=${service} endpoint=${endpoint}${paramStr}`);
  }

  apiSuccess(service: string, endpoint: string, durationMs: number, responseSummary?: string): void {
    this.logger.log(
      `${this.prefix} API_SUCCESS service=${service} endpoint=${endpoint} duration=${durationMs}ms${responseSummary ? ` result="${responseSummary}"` : ''}`,
    );
  }

  apiFailed(service: string, endpoint: string, durationMs: number, error: unknown, attempt?: number): void {
    const msg = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `${this.prefix} API_FAILED service=${service} endpoint=${endpoint} duration=${durationMs}ms error="${msg}"${attempt !== undefined ? ` attempt=${attempt}` : ''}`,
    );
  }

  // ─── Verification ─────────────────────────────────────────

  verificationPassed(stepKey: string): void {
    this.logger.log(`${this.prefix} VERIFICATION_PASSED step=${stepKey}`);
  }

  verificationFailed(errors: string[], retry: number, maxRetries: number): void {
    this.logger.warn(
      `${this.prefix} VERIFICATION_FAILED retry=${retry}/${maxRetries} errors="${errors.join('; ')}"`,
    );
  }

  verificationExhausted(errors: string[]): void {
    this.logger.error(
      `${this.prefix} VERIFICATION_EXHAUSTED errors="${errors.join('; ')}"`,
    );
  }

  // ─── Warnings ────────────────────────────────────────────

  emptyPipelineData(field: string): void {
    this.logger.warn(`${this.prefix} EMPTY_PIPELINE_DATA field=${field} — agent will receive no data for this field`);
  }

  warn(msg: string): void {
    this.logger.warn(`${this.prefix} ${msg}`);
  }

  log(msg: string): void {
    this.logger.log(`${this.prefix} ${msg}`);
  }

  error(msg: string): void {
    this.logger.error(`${this.prefix} ${msg}`);
  }
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Returns a one-line human-readable summary of an unknown pipeline/agent output.
 * Avoids logging multi-MB objects verbatim.
 */
function summarizeOutput(data: unknown): string {
  if (data == null) return 'null';
  if (typeof data !== 'object') return String(data).slice(0, 100);

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);
  const parts: string[] = [];

  for (const key of keys.slice(0, 8)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      parts.push(`${key}[${val.length}]`);
    } else if (typeof val === 'object' && val !== null) {
      parts.push(`${key}={...}`);
    } else if (typeof val === 'string') {
      parts.push(`${key}="${val.slice(0, 40)}"`);
    } else {
      parts.push(`${key}=${val}`);
    }
  }

  return `{${parts.join(', ')}${keys.length > 8 ? `, +${keys.length - 8} more` : ''}}`;
}

/**
 * Summarize tool input for logging — truncates long strings, trims arrays.
 */
export function summarizeToolInput(input: unknown): string {
  if (input == null) return 'null';
  if (typeof input !== 'object') return String(input).slice(0, 80);

  const obj = input as Record<string, unknown>;
  const parts: string[] = [];

  for (const [key, val] of Object.entries(obj).slice(0, 5)) {
    if (typeof val === 'string') {
      parts.push(`${key}="${val.slice(0, 50)}${val.length > 50 ? '…' : ''}"`);
    } else if (Array.isArray(val)) {
      parts.push(`${key}[${val.length}]`);
    } else {
      parts.push(`${key}=${JSON.stringify(val).slice(0, 40)}`);
    }
  }

  return `{${parts.join(', ')}}`;
}
