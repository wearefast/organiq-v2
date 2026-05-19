import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PromptService } from './prompt.service';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PromptService - Agent Definition Parsing', () => {
  let service: PromptService;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `pulse-test-${Date.now()}`);
    const agentsDir = join(testDir, 'agents');
    const promptsDir = join(testDir, 'prompts');
    mkdirSync(agentsDir, { recursive: true });
    mkdirSync(promptsDir, { recursive: true });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NODE_ENV') return 'test';
              return undefined;
            },
          },
        },
      ],
    }).compile();

    service = module.get<PromptService>(PromptService);
    // Override private dirs for testing
    (service as any).agentsDir = agentsDir;
    (service as any).promptsDir = promptsDir;
  });

  afterEach(() => {
    try { rmSync(testDir, { recursive: true }); } catch {}
  });

  it('should parse old-format agent definition (no provider/tier/thinking)', async () => {
    const agentMd = `---
name: Test Agent
step_key: test-step
model: gpt-4o
temperature: 0.3
max_iterations: 5
credit_cost: 100
depends_on:
  - phase1-baseline
requires_approval: false
tools:
  - ahrefs_organic_keywords
---

You are a test agent. Analyze the data.`;

    writeFileSync(join((service as any).agentsDir, 'test-step.agent.md'), agentMd);

    const def = await service.loadAgentDefinition('test-step');

    expect(def.name).toBe('Test Agent');
    expect(def.stepKey).toBe('test-step');
    expect(def.model).toBe('gpt-4o');
    expect(def.temperature).toBe(0.3);
    expect(def.maxIterations).toBe(5);
    expect(def.creditCost).toBe(100);
    expect(def.dependsOn).toEqual(['phase1-baseline']);
    expect(def.requiresApproval).toBe(false);
    expect(def.tools).toEqual(['ahrefs_organic_keywords']);
    // New fields should be undefined for old format
    expect(def.provider).toBeUndefined();
    expect(def.tier).toBeUndefined();
    expect(def.thinkingBudget).toBeUndefined();
  });

  it('should parse new-format agent definition with provider/tier/thinking_budget', async () => {
    const agentMd = `---
name: Consolidated Keywords
step_key: consolidated-keywords
model: claude-opus-4-20250514
temperature: 1
max_iterations: 1
credit_cost: 150
depends_on:
  - method01-competitor-pages
  - method02-seed-expansion
  - method03-content-gap
requires_approval: true
tools:
provider: anthropic
tier: tier2
thinking_budget: 32000
---

You are the keyword consolidation agent.

## Output Schema
\`\`\`json
{"type": "object", "properties": {"keywords": {"type": "array"}}}
\`\`\``;

    writeFileSync(join((service as any).agentsDir, 'consolidated-keywords.agent.md'), agentMd);

    const def = await service.loadAgentDefinition('consolidated-keywords');

    expect(def.name).toBe('Consolidated Keywords');
    expect(def.model).toBe('claude-opus-4-20250514');
    expect(def.temperature).toBe(1);
    expect(def.provider).toBe('anthropic');
    expect(def.tier).toBe('tier2');
    expect(def.thinkingBudget).toBe(32000);
    expect(def.tools).toEqual([]);
    expect(def.requiresApproval).toBe(true);
    expect(def.outputSchema).toEqual({ type: 'object', properties: { keywords: { type: 'array' } } });
  });

  it('should default provider/tier to undefined for backward compat', async () => {
    const agentMd = `---
name: Legacy Agent
step_key: legacy
model: gpt-4o
---

Simple agent.`;

    writeFileSync(join((service as any).agentsDir, 'legacy.agent.md'), agentMd);

    const def = await service.loadAgentDefinition('legacy');

    expect(def.provider).toBeUndefined();
    expect(def.tier).toBeUndefined();
    expect(def.thinkingBudget).toBeUndefined();
    // Check defaults
    expect(def.model).toBe('gpt-4o');
    expect(def.temperature).toBe(0.3);
    expect(def.maxIterations).toBe(3);
    expect(def.creditCost).toBe(50);
  });
});
