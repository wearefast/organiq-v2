/**
 * Playwright E2E auth helper.
 * For local dev testing, Clerk's dev mode allows bypass via test tokens.
 * This helper sets the Clerk session cookie to simulate authenticated state.
 */
import { Page } from '@playwright/test';

/**
 * Bypass Clerk auth for E2E tests.
 * In dev mode, navigate to the app which shows the Clerk sign-in page.
 * For full E2E with real Clerk, set CLERK_TEST_EMAIL and CLERK_TEST_PASSWORD env vars.
 */
export async function authenticateUser(page: Page) {
  const email = process.env.CLERK_TEST_EMAIL;
  const password = process.env.CLERK_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'CLERK_TEST_EMAIL and CLERK_TEST_PASSWORD must be set for E2E tests. ' +
        'Create a test user in your Clerk dev instance.',
    );
  }

  // Navigate to login page
  await page.goto('/login');

  // Clerk's sign-in component renders in an iframe or inline — wait for email field
  const emailInput = page.locator('input[name="identifier"], input[type="email"]');
  await emailInput.waitFor({ timeout: 15_000 });
  await emailInput.fill(email);

  // Click continue/submit
  const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]');
  await continueBtn.first().click();

  // Wait for password field
  const passwordInput = page.locator('input[type="password"]');
  await passwordInput.waitFor({ timeout: 10_000 });
  await passwordInput.fill(password);

  // Submit password
  const signInBtn = page.locator('button:has-text("Continue"), button:has-text("Sign in"), button[type="submit"]');
  await signInBtn.first().click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/(dashboard|workspaces)/, { timeout: 15_000 });
}
