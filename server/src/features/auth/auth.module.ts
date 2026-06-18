import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkGuard } from './clerk.guard';
import { OrgMembershipGuard } from './org-membership.guard';
import { AdminOnlyGuard } from './admin-only.guard';
import { AccessGuard } from './access.guard';
import { AccessService } from './access.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkGuard, OrgMembershipGuard, AdminOnlyGuard, AccessGuard, AccessService],
  exports: [AuthService, ClerkGuard, OrgMembershipGuard, AdminOnlyGuard, AccessGuard, AccessService],
})
export class AuthModule {}
