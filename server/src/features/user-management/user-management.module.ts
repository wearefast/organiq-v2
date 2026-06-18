import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { AccessGrantService } from './access-grant.service';
import { WorkspaceCreditLimitService } from './workspace-credit-limit.service';
import { UserManagementController, InvitationAcceptController } from './user-management.controller';

@Module({
  controllers: [UserManagementController, InvitationAcceptController],
  providers: [InvitationService, AccessGrantService, WorkspaceCreditLimitService],
  exports: [InvitationService, AccessGrantService, WorkspaceCreditLimitService],
})
export class UserManagementModule {}
