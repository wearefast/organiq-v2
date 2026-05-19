import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentRuntime } from '../../agents/agent.runtime';

export interface ShadowResult {
  /** Whether shadow mode was active for this step */
  active: boolean;
  /** Shadow provider execution result (if ran) */
  shadowOutput?: unknown;
  /** Comparison verdict */
  verdict?: ShadowVerdict;
}

export interface ShadowVerdict {
  /** Did both providers produce structurally similar output? */
  structuralMatch: boolean;
  /** Key differences found */
  differences: string[];
  /** Shadow provider name */
  shadowProvider: string;
  /** Duration of shadow execution (ms) */
  shadowDurationMs: number;
}

@Injectable()
export class ShadowService {
  private readonly logger = new Logger(ShadowService.name);
  private readonly shadowSteps: Set<string>;

  constructor(
    private readonly configService: ConfigService,
    private readonly agentRuntime: AgentRuntime,
  ) {
    const raw = this.configService.get<string>('SHADOW_MODE_STEPS') || '';
    this.shadowSteps = new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );

    if (this.shadowSteps.size > 0) {
      this.logger.log(`Shadow mode enabled for steps: ${[...this.shadowSteps].join(', ')}`);
    }
  }

  /** Check if shadow mode is active for a given step */
  isActive(stepKey: string): boolean {
    return this.shadowSteps.has(stepKey);
  }

  /**
   * Run the shadow provider in parallel (fire-and-forget style, non-blocking).
   * Returns ShadowResult with verdict for metadata storage.
   * Shadow failures are logged but never throw — they must not block the primary path.
   */
  async runShadow(params: {
    stepKey: string;
    primaryOutput: unknown;
    agentConfig: {
      name: string;
      model: string;
      temperature: number;
      maxIterations: number;
      tools: string[];
      systemPrompt: string;
      userPrompt: string;
      provider?: 'openai' | 'anthropic';
      tier?: 'tier1' | 'tier2' | 'tier3';
      thinkingBudget?: number;
    };
  }): Promise<ShadowResult> {
    if (!this.isActive(params.stepKey)) {
      return { active: false };
    }

    const shadowProvider = this.getShadowProvider(params.agentConfig.provider);
    if (!shadowProvider) {
      return { active: false };
    }

    this.logger.log(`Running shadow (${shadowProvider}) for step: ${params.stepKey}`);
    const start = Date.now();

    try {
      const shadowResult = await this.agentRuntime.execute({
        ...params.agentConfig,
        provider: shadowProvider,
        model: this.getDefaultModel(shadowProvider),
        tier: params.agentConfig.tier,
        thinkingBudget: params.agentConfig.thinkingBudget,
      });

      const durationMs = Date.now() - start;
      const verdict = this.compareOutputs(params.primaryOutput, shadowResult.output, shadowProvider, durationMs);

      this.logger.log(
        `Shadow complete for ${params.stepKey}: structural_match=${verdict.structuralMatch}, differences=${verdict.differences.length}, duration=${durationMs}ms`,
      );

      return { active: true, shadowOutput: shadowResult.output, verdict };
    } catch (error) {
      const durationMs = Date.now() - start;
      this.logger.error(`Shadow execution failed for ${params.stepKey} after ${durationMs}ms: ${(error as Error).message}`);
      return {
        active: true,
        verdict: {
          structuralMatch: false,
          differences: [`Shadow provider error: ${(error as Error).message}`],
          shadowProvider,
          shadowDurationMs: durationMs,
        },
      };
    }
  }

  /** Determine the shadow provider (opposite of primary) */
  private getShadowProvider(primaryProvider?: 'openai' | 'anthropic'): 'openai' | 'anthropic' | null {
    const primary = primaryProvider || 'openai';
    if (primary === 'openai') return 'anthropic';
    if (primary === 'anthropic') return 'openai';
    return null;
  }

  /** Get the default model for a shadow provider */
  private getDefaultModel(provider: 'openai' | 'anthropic'): string {
    if (provider === 'openai') return 'gpt-4o';
    return 'claude-opus-4-20250514';
  }

  /** Structural comparison of primary vs shadow output */
  private compareOutputs(primary: unknown, shadow: unknown, shadowProvider: string, durationMs: number): ShadowVerdict {
    const differences: string[] = [];

    // Both should be objects
    if (typeof primary !== 'object' || primary === null || typeof shadow !== 'object' || shadow === null) {
      differences.push('Type mismatch: one or both outputs are not objects');
      return { structuralMatch: false, differences, shadowProvider, shadowDurationMs: durationMs };
    }

    const primaryKeys = Object.keys(primary as Record<string, unknown>).sort();
    const shadowKeys = Object.keys(shadow as Record<string, unknown>).sort();

    // Check top-level key presence
    const missingInShadow = primaryKeys.filter((k) => !shadowKeys.includes(k));
    const extraInShadow = shadowKeys.filter((k) => !primaryKeys.includes(k));

    if (missingInShadow.length > 0) {
      differences.push(`Keys missing in shadow: ${missingInShadow.join(', ')}`);
    }
    if (extraInShadow.length > 0) {
      differences.push(`Extra keys in shadow: ${extraInShadow.join(', ')}`);
    }

    // Check array lengths for shared keys
    const pObj = primary as Record<string, unknown>;
    const sObj = shadow as Record<string, unknown>;

    for (const key of primaryKeys) {
      if (Array.isArray(pObj[key]) && Array.isArray(sObj[key])) {
        const pLen = (pObj[key] as unknown[]).length;
        const sLen = (sObj[key] as unknown[]).length;
        const ratio = pLen > 0 ? sLen / pLen : sLen === 0 ? 1 : 0;
        if (ratio < 0.5 || ratio > 2.0) {
          differences.push(`Array "${key}" length divergence: primary=${pLen}, shadow=${sLen}`);
        }
      }
    }

    return {
      structuralMatch: differences.length === 0,
      differences,
      shadowProvider,
      shadowDurationMs: durationMs,
    };
  }
}
