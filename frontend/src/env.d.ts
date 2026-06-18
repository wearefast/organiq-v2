declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL?: string;
    API_URL?: string;
    INTERNAL_API_URL?: string;
    /** Comma-separated Clerk user IDs that have platform super-admin access */
    NEXT_PUBLIC_SUPER_ADMIN_CLERK_IDS?: string;
  }
}
