import { expect, test } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';

// Fixed seed account created by `backend/seed.py` (`make seed`), kept out of the
// Faker-generated pool precisely so this spec stays stable across seed re-runs.
// Development-only credentials — never valid outside a local DB.
//
// PLACEHOLDER: the seed is mid-migration to the neutral catalogue (roles become
// ADMIN/EDITOR/VIEWER in #11, `seed.py` is rewritten with one account per role
// in #12). No account exists under these values yet, so this spec fails until
// #12 lands and these two constants are pointed at what it actually creates.
const VIEWER_EMAIL = 'viewer@example.com';
const VIEWER_PASSWORD = 'ChangeMe123!';

test.describe('Login', () => {
  test('redirects to the home page and keeps the session across a reload', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(VIEWER_EMAIL, VIEWER_PASSWORD);

    await expect(page).toHaveURL('/');
    const heading = page.getByRole('heading', { name: /^Hola/ });
    await expect(heading).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL('/');
    await expect(heading).toBeVisible();
  });

  test('rejects a wrong password without opening a session', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(VIEWER_EMAIL, 'not-the-right-password');

    await expect(loginPage.errorMessage).toBeVisible();
    // Still on the form, and with nothing persisted: a failed login must not
    // leave a half-open session behind.
    await expect(page).toHaveURL(/\/login$/);
    expect(await loginPage.storedAuthToken()).toBeNull();
  });
});
