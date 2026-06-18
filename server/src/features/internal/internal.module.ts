import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { SuperAdminGuard } from './super-admin.guard';
import { CreditsModule } from '../credits/credits.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [CreditsModule, OrganizationsModule],
  controllers: [InternalController],
  providers: [SuperAdminGuard],
})
export class InternalModule {}
