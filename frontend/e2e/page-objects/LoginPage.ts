import type { Locator, Page } from '@playwright/test';

/**
 * Page Object for `/login`. Selectors mirror `LoginForm.tsx`: the accessible
 * name of every field, not implementation details.
 *
 * The password field is located with `#password` rather than `getByLabel`
 * because `Input.tsx` also renders a "Mostrar/Ocultar contraseña" toggle
 * button whose `aria-label` would otherwise make a label-based query
 * ambiguous.
 */
export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByLabel('Correo electrónico');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.getByRole('button', { name: 'Entrar' });
    // `LoginForm.tsx` renders the failure as a `role="alert"` paragraph, so
    // the assertion targets the role rather than the copy inside it.
    this.errorMessage = page.getByRole('alert');
  }

  /** The persisted session token, or null when there is no session. */
  async storedAuthToken(): Promise<string | null> {
    return this.page.evaluate(() => window.localStorage.getItem('auth-token'));
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
