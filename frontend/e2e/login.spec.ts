import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('login page loads and shows Clerk sign-in', async ({ page }) => {
    await page.goto('/login');

    // Clerk sign-in component should render
    const signInElement = page.locator(
      '[data-clerk-component="SignIn"], .cl-signIn-root, input[name="identifier"]',
    );
    await expect(signInElement.first()).toBeVisible({ timeout: 15_000 });
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
