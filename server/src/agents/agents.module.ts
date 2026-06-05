import { Global, Module } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolSandbox } from './tool.sandbox';
import { ToolBootstrap } from './tool.bootstrap';
import { AgentRuntime } from './agent.runtime';
import { AgentRegistry } from './agent.registry';
import { OutputValidator } from './output.validator';
import { SkillService } from './skill.service';
import { IntegrationsModule } from '../features/integrations/integrations.module';
import { ProjectsModule } from '../features/projects/projects.module';

@Global()
@Module({
  imports: [IntegrationsModule, ProjectsModule],
  providers: [ToolRegistry, ToolSandbox, ToolBootstrap, AgentRuntime, AgentRegistry, OutputValidator, SkillService],
  exports: [ToolRegistry, ToolSandbox, AgentRuntime, AgentRegistry, OutputValidator, SkillService],
})
export class AgentsModule {}
