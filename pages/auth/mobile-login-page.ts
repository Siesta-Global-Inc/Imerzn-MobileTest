import { byLabel, fillField } from '@helpers/mobile-elements';
import { MobileWelcomePage } from './mobile-welcome-page';

/** "Welcome Back" login screen. */
export class MobileLoginPage {
  get heading() {
    return byLabel('Welcome Back');
  }

  // Found by position, not placeholder: a placeholder is only exposed while the field is empty,
  // and a test may log in again on a form that still holds the previous attempt.
  get emailInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  get passwordInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  get logInButton() {
    return byLabel('Log In');
  }

  /** Error shown briefly at the bottom of the screen when the login is rejected. */
  get loginErrorMessage() {
    return byLabel('Invalid username or password');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed();
  }

  /**
   * Make sure the login screen is shown: stay on it if the app is already there
   * (e.g. after a failed login), otherwise open it from the welcome screen.
   */
  async open(): Promise<void> {
    if (await this.heading.isDisplayed().catch(() => false)) {
      return;
    }
    await new MobileWelcomePage().openLogin();
  }

  /**
   * Replace only the email and keep the password already typed in the form, then tap Log In.
   * The password is typed only if the field is empty (e.g. the login screen was just opened).
   */
  async loginWithNewEmail(email: string, password: string): Promise<void> {
    await this.waitForLoaded();
    await fillField(this.emailInput, email);
    if (!(await this.passwordInput.getText())) {
      await fillField(this.passwordInput, password);
    }
    await this.logInButton.click();
  }

  /** Fill in the email and password (replacing any previous text), then tap Log In. */
  async login(email: string, password: string): Promise<void> {
    await this.waitForLoaded();
    await fillField(this.emailInput, email);
    await fillField(this.passwordInput, password);
    await this.logInButton.click();
  }
}
