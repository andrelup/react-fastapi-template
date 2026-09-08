import { expect, test } from '@playwright/test';
import { LoginPage } from '../page-objects/LoginPage';

// Fixed seed accounts created by `backend/seed.py` (`make seed`), kept out of
// the Faker-generated pool precisely so this spec stays stable across seed
// re-runs. Development-only credentials — never valid outside a local DB.
const CUSTOMER_EMAIL = 'customer@bookshelf.dev';
const CUSTOMER_PASSWORD = 'BookShelf123!';

test.describe('Login', () => {
  test('redirects to the home page and keeps the session across a reload', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await expect(page).toHaveURL('/');
    const heading = page.getByRole('heading', { name: /^Bienvenida/ });
    await expect(heading).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL('/');
    await expect(heading).toBeVisible();
  });

  test('rejects a wrong password without opening a session', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await loginPage.login(CUSTOMER_EMAIL, 'not-the-right-password');

    await expect(loginPage.errorMessage).toBeVisible();
    // Still on the form, and with nothing persisted: a failed login must not
    // leave a half-open session behind.
    await expect(page).toHaveURL(/\/login$/);
    expect(await loginPage.storedAuthToken()).toBeNull();
  });
});
