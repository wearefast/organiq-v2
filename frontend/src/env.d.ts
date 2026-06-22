declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_API_URL?: string;
    API_URL?: string;
    INTERNAL_API_URL?: string;
    // Note: SUPER_ADMIN_CLERK_IDS is intentionally server-only (no NEXT_PUBLIC_ prefix).
    // Use the /api/me/admin-status route or middleware to check admin status client-side.
  }
}
