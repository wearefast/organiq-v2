declare namespace Express {
  interface Request {
    /**
     * Internal organization record — attached by OrgMembershipGuard.
     */
    org?: { id: string; clerkOrgId: string };

    /**
     * Internal org member record — attached by OrgMembershipGuard.
     * Read by AdminOnlyGuard and AccessGuard.
     */
    member?: { id: string; role: string };

    /**
     * Clerk identity — attached by ClerkGuard.
     */
    user?: {
      clerkUserId: string;
      clerkOrgId?: string;
      sessionId?: string;
    };
  }
}
