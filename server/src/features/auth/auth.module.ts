import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ClerkGuard } from './clerk.guard';
import { OrgMembershipGuard } from './org-membership.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, ClerkGuard, OrgMembershipGuard],
  exports: [AuthService, ClerkGuard, OrgMembershipGuard],
})
export class AuthModule {}
