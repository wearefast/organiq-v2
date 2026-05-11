import { Global, Module } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolSandbox } from './tool.sandbox';
import { ToolBootstrap } from './tool.bootstrap';
import { AgentRuntime } from './agent.runtime';
import { AgentRegistry } from './agent.registry';
import { OutputValidator } from './output.validator';
import { OpenAiModule } from '../features/integrations/openai/openai.module';
import { IntegrationsModule } from '../features/integrations/integrations.module';

@Global()
@Module({
  imports: [OpenAiModule, IntegrationsModule],
  providers: [ToolRegistry, ToolSandbox, ToolBootstrap, AgentRuntime, AgentRegistry, OutputValidator],
  exports: [ToolRegistry, ToolSandbox, AgentRuntime, AgentRegistry, OutputValidator],
})
export class AgentsModule {}
