import { byLabel, fillField } from '@helpers/mobile-elements';

/** "Change Password" sheet, opened by Update Password on the localite Profile. */
export class MobileChangePasswordSheet {
  get heading() {
    return byLabel('Change Password');
  }

  // Found by position, not placeholder: a placeholder is only exposed while the field is empty.
  // The Profile behind the sheet has no text fields, so these are the sheet's three fields.
  get currentPasswordInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  get newPasswordInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  get confirmPasswordInput() {
    return browser.$('(//android.widget.EditText)[3]');
  }

  /** The sheet's button (the Profile button with the same label is an image, not a button). */
  get updatePasswordButton() {
    return browser.$('//android.widget.Button[@content-desc="Update Password"]');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 30_000 });
  }

  /** Fill the three fields and tap Update Password; the sheet closes when the change is saved. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.waitForLoaded();
    await fillField(this.currentPasswordInput, currentPassword);
    await fillField(this.newPasswordInput, newPassword);
    await fillField(this.confirmPasswordInput, newPassword);

    await this.updatePasswordButton.click();
    await this.heading.waitForDisplayed({
      reverse: true,
      timeout: 60_000,
      timeoutMsg: 'The password was not changed: the Change Password sheet is still open.',
    });
  }
}
