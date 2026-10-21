import type { MobileTravelerProfileEditData } from '@data/traveler/mobile-traveler-data';
import { byLabel, fillField, scrollFormTo } from '@helpers/mobile-elements';

/**
 * Traveler "Profile" screen (left menu > Profile) and its "Edit Profile" sheet.
 */
export class MobileTravelerProfilePage {
  /** Screen title: a plain view (the menu item "Profile" is an image). */
  get heading() {
    return browser.$('//android.view.View[@content-desc="Profile"]');
  }

  /** "Edit Profile" tile of the Profile screen. */
  get editProfileTile() {
    return byLabel('Edit Profile');
  }

  /** Title of the Edit Profile sheet: a plain view (the tile is an image). */
  get editProfileHeading() {
    return browser.$('//android.view.View[@content-desc="Edit Profile"]');
  }

  // The sheet's text fields have no labels; they are, in order: First Name, Last Name, Phone, Location.
  get firstNameInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  get lastNameInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  get phoneInput() {
    return browser.$('(//android.widget.EditText)[3]');
  }

  get saveChangesButton() {
    return byLabel('Save Changes');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.editProfileTile.waitForDisplayed();
  }

  /** Open the Edit Profile sheet from the Profile screen. */
  async openEditProfile(): Promise<void> {
    await this.editProfileTile.click();
    await this.editProfileHeading.waitForDisplayed({ timeout: 30_000 });
    await this.firstNameInput.waitForDisplayed({ timeout: 30_000 });
  }

  /** Type the new first name, last name, and phone, and check each field kept its value. */
  async editDetails(data: MobileTravelerProfileEditData): Promise<void> {
    for (const [field, value] of [
      [this.firstNameInput, data.firstName],
      [this.lastNameInput, data.lastName],
      [this.phoneInput, data.phone],
    ] as const) {
      await fillField(field, value);
      await expect(field).toHaveText(value);
    }
  }

  /** Scroll down the sheet to Save Changes and tap it; the sheet closes. */
  async saveChanges(): Promise<void> {
    await scrollFormTo(this.saveChangesButton);
    await this.saveChangesButton.click();
    await this.saveChangesButton.waitForDisplayed({ reverse: true, timeout: 60_000 });
  }

  /** Check the Edit Profile sheet shows the saved first name, last name, and phone. */
  async verifyDetails(data: MobileTravelerProfileEditData): Promise<void> {
    await expect(this.firstNameInput).toHaveText(data.firstName);
    await expect(this.lastNameInput).toHaveText(data.lastName);
    await expect(this.phoneInput).toHaveText(data.phone);
  }
}
