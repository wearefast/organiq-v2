import { Global, Module } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolSandbox } from './tool.sandbox';
import { ToolBootstrap } from './tool.bootstrap';
import { ManagedAgentRuntime } from './managed-agent.runtime';
import { AgentRegistry } from './agent.registry';
import { OutputValidator } from './output.validator';
import { SkillService } from './skill.service';
import { IntegrationsModule } from '../features/integrations/integrations.module';

@Global()
@Module({
  imports: [IntegrationsModule],
  providers: [ToolRegistry, ToolSandbox, ToolBootstrap, ManagedAgentRuntime, AgentRegistry, OutputValidator, SkillService],
  exports: [ToolRegistry, ToolSandbox, ManagedAgentRuntime, AgentRegistry, OutputValidator, SkillService],
})
export class AgentsModule {}
