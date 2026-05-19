import { Global, Module } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolSandbox } from './tool.sandbox';
import { ToolBootstrap } from './tool.bootstrap';
import { AgentRuntime } from './agent.runtime';
import { AgentRegistry } from './agent.registry';
import { OutputValidator } from './output.validator';
import { OpenAiProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { IntegrationsModule } from '../features/integrations/integrations.module';

@Global()
@Module({
  imports: [IntegrationsModule],
  providers: [ToolRegistry, ToolSandbox, ToolBootstrap, AgentRuntime, AgentRegistry, OutputValidator, OpenAiProvider, AnthropicProvider],
  exports: [ToolRegistry, ToolSandbox, AgentRuntime, AgentRegistry, OutputValidator, OpenAiProvider, AnthropicProvider],
})
export class AgentsModule {}
