import {
  Controller,
  Post,
  Get,
  Delete,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ClerkGuard } from '../auth/clerk.guard';
import { OrgMembershipGuard } from '../auth/org-membership.guard';
import { AdminOnlyGuard } from '../auth/admin-only.guard';
import { InvitationService } from './invitation.service';
import { AccessGrantService } from './access-grant.service';
import { WorkspaceCreditLimitService } from './workspace-credit-limit.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateMemberAccessDto } from './dto/update-member-access.dto';

/**
 * User Management API
 *
 * All routes require ClerkGuard + OrgMembershipGuard.
 * Admin-only routes additionally require AdminOnlyGuard.
 *
 * Guard execution order matters:
 *   ClerkGuard → sets req.user
 *   OrgMembershipGuard → sets req.org + req.member
 *   AdminOnlyGuard → checks req.member.role
 */
@ApiTags('user-management')
@ApiBearerAuth()
@UseGuards(ClerkGuard, OrgMembershipGuard)
@Controller('orgs/:orgId')
export class UserManagementController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly accessGrantService: AccessGrantService,
    private readonly creditLimitService: WorkspaceCreditLimitService,
  ) {}

  // ─── Members ──────────────────────────────────────────────────────────────

  /** List all org members with their current access grants */
  @Get('members')
  @UseGuards(AdminOnlyGuard)
  listMembers(@Req() req: any) {
    return this.accessGrantService.getMembersWithGrants(req.org.id);
  }

  /** Remove a member from the org */
  @Delete('members/:memberId')
  @UseGuards(AdminOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(@Param('memberId') memberId: string, @Req() req: any) {
    // Prevent admin from removing themselves (use org deletion instead)
    if (memberId === req.member.id) {
      throw new BadRequestException('Admins cannot remove themselves from the organization');
    }
    await this.accessGrantService.removeMember(req.org.id, memberId);
  }

  // ─── Access Grants ────────────────────────────────────────────────────────

  /** Replace a member's access grants */
  @Put('members/:memberId/access')
  @UseGuards(AdminOnlyGuard)
  updateMemberAccess(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberAccessDto,
    @Req() req: any,
  ) {
    return this.accessGrantService.replaceGrants(
      req.org.id,
      memberId,
      req.member.id,
      dto.accessGrants,
    );
  }

  /** Get current user's own access grants */
  @Get('members/me/access')
  getMyAccess(@Req() req: any) {
    return this.accessGrantService.getMemberGrants(req.member.id, req.org.id);
  }

  // ─── Invitations ──────────────────────────────────────────────────────────

  /** List invitations for the org */
  @Get('invitations')
  @UseGuards(AdminOnlyGuard)
  listInvitations(@Req() req: any) {
    return this.invitationService.listByOrg(req.org.id);
  }

  /** Create and send an invitation */
  @Post('invitations')
  @UseGuards(AdminOnlyGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  createInvitation(@Body() dto: CreateInvitationDto, @Req() req: any) {
    return this.invitationService.create(req.org.id, req.member.id, dto);
  }

  /** Revoke a pending invitation */
  @Delete('invitations/:invitationId')
  @UseGuards(AdminOnlyGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvitation(
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    await this.invitationService.revoke(invitationId, req.org.id, req.member.id);
  }

  // ─── Workspace Credit Limits ──────────────────────────────────────────────

  /** Get the credit limit for a workspace */
  @Get('workspaces/:workspaceId/credit-limit')
  @UseGuards(AdminOnlyGuard)
  getCreditLimit(@Param('workspaceId') workspaceId: string, @Req() req: any) {
    return this.creditLimitService.getLimit(req.org.id, workspaceId);
  }

  /** Set or update the monthly credit limit for a workspace */
  @Put('workspaces/:workspaceId/credit-limit')
  @UseGuards(AdminOnlyGuard)
  setCreditLimit(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: { monthlyLimit: number },
    @Req() req: any,
  ) {
    return this.creditLimitService.setLimit(req.org.id, workspaceId, dto.monthlyLimit);
  }

  /** Remove the credit limit for a workspace (no cap) */
  @Delete('workspaces/:workspaceId/credit-limit')
  @UseGuards(AdminOnlyGuard)
  @HttpCode(HttpStatus.OK)
  removeCreditLimit(@Param('workspaceId') workspaceId: string, @Req() req: any) {
    return this.creditLimitService.removeLimit(req.org.id, workspaceId);
  }
}

/**
 * Public invitation acceptance endpoint.
 * GET :token is unauthenticated (public preview for new users who don't have accounts yet).
 * POST :token/accept requires ClerkGuard (user must be signed in).
 */
@ApiTags('user-management')
@ApiBearerAuth()
@Controller('invitations')
export class InvitationAcceptController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly configService: ConfigService,
  ) {}

  /** Preview an invitation (public — no auth required, safe fields only) */
  @Get(':token')
  findInvitation(@Param('token') token: string) {
    return this.invitationService.findByToken(token);
  }

  /** Accept an invitation — user must be signed in */
  @Post(':token/accept')
  @UseGuards(ClerkGuard)
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Param('token') token: string,
    @Req() req: any,
  ) {
    // Fetch the user's verified primary email from Clerk server-side.
    // We do NOT trust the client-sent email — it could be spoofed.
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) throw new Error('CLERK_SECRET_KEY not configured');
    const { createClerkClient } = await import('@clerk/backend');
    const clerk = createClerkClient({ secretKey });
    const clerkUser = await clerk.users.getUser(req.user.clerkUserId);
    const primaryEmail = clerkUser.emailAddresses.find(
      (e: { id: string; emailAddress: string }) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;
    if (!primaryEmail) throw new Error('No primary email on Clerk user');
    return this.invitationService.accept(token, req.user.clerkUserId, primaryEmail);
  }
}
