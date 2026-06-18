import { IsEmail } from 'class-validator';

export class AcceptInvitationDto {
  /**
   * The authenticated user's email address.
   * Obtained client-side from Clerk's useUser() hook and passed here for
   * invitation ownership verification (must match invitation.email).
   */
  @IsEmail()
  email!: string;
}
