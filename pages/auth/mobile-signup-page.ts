import type { MobileSignupFormData } from '@data/common/mobile-auth-data';
import { byLabel, fillField, inputByHint, scrollTo } from '@helpers/mobile-elements';

/** Account type tabs at the top of the Sign Up screen. */
export type MobileSignupRole = 'Traveler' | 'Localites';

/** "Sign Up" screen and the phone/email verification screens that follow it. */
export class MobileSignupPage {
  get heading() {
    return byLabel('Sign Up');
  }

  roleTab(role: MobileSignupRole) {
    return byLabel(role);
  }

  get consentCheckbox() {
    return browser.$('//android.widget.CheckBox');
  }

  get continueButton() {
    return byLabel('Continue');
  }

  /** Message shown after the form is accepted and a code is sent. */
  get codeSentMessage() {
    return byLabel('Verification code sent to your registered email and phone. Please confirm.');
  }

  /** Button on the "code sent" screen that opens the code entry screen. */
  get verificationCodeButton() {
    return browser.$('//android.widget.Button[@content-desc="Verification code"]');
  }

  /** Single input for the whole verification code. */
  get codeInput() {
    return browser.$('//android.widget.EditText');
  }

  get verifyButton() {
    return byLabel('Verify');
  }

  /** Select Traveler or Localites on the Sign Up screen. */
  async selectRole(role: MobileSignupRole): Promise<void> {
    await this.heading.waitForDisplayed();
    await this.roleTab(role).click();
  }

  /** Fill in the Sign Up form (same fields for Traveler and Localites). */
  async fillForm(data: MobileSignupFormData): Promise<void> {
    await fillField(inputByHint('First Name'), data.firstName);
    await fillField(inputByHint('Last Name'), data.lastName);
    await fillField(inputByHint('Enter Email Address'), data.email);
    // The +1 (United States) country code is preselected; type the 10-digit number only.
    await fillField(inputByHint('Contact number'), data.phone);
    await fillField(inputByHint('Enter Password'), data.password);
    await fillField(inputByHint('Re-Enter Password'), data.password);
  }

  /** Tick the SMS / Terms consent checkbox and tap Continue. */
  async submit(): Promise<void> {
    await scrollTo(this.consentCheckbox);
    if ((await this.consentCheckbox.getAttribute('checked')) !== 'true') {
      await this.consentCheckbox.click();
    }
    await expect(this.consentCheckbox).toHaveAttribute('checked', 'true');

    await scrollTo(this.continueButton);
    await this.continueButton.click();
  }

  /** Open the code entry screen, type the code and tap Verify. */
  async verifyCode(code: string): Promise<void> {
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Signup OTP must contain exactly 6 digits.');
    }
    await this.codeSentMessage.waitForDisplayed({ timeout: 60_000 });
    await this.verificationCodeButton.click();

    await fillField(this.codeInput, code);
    await this.verifyButton.click();
  }
}
