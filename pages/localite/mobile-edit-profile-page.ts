import type { MobileEditProfileData } from '@data/localite/mobile-localite-data';
import { byLabel, fillField, screenLabels, scrollFormTo, xpathString } from '@helpers/mobile-elements';

/** "Edit Profile" screen, opened from the localite Profile. */
export class MobileEditProfilePage {
  get heading() {
    return byLabel('Edit Profile');
  }

  // The filled fields have no hint or label of their own, so the name fields are found by
  // position (First Name, Last Name, Business Name, Phone Number from the top).
  get firstNameInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  get lastNameInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  /** Bio field, found by the bio it currently shows. */
  bioInput(currentBio: string) {
    return browser.$(`//android.widget.EditText[@text=${xpathString(currentBio)}]`);
  }

  /** "Experiences I host" dropdown right below the Bio; its label lists the chosen experiences. */
  experiencesDropdown(bio: string) {
    return browser.$(`//android.widget.EditText[@text=${xpathString(bio)}]/following-sibling::*[@clickable="true"][1]`);
  }

  experienceOption(name: string) {
    return browser.$(`//android.widget.Button[@content-desc=${xpathString(name)}]`);
  }

  get saveButton() {
    return byLabel('Save');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.firstNameInput.waitForDisplayed({ timeout: 60_000 });
  }

  /** Enter the new name and bio, and choose exactly the experiences in the data. */
  async fillForm(data: MobileEditProfileData, currentBio: string): Promise<void> {
    await this.waitForLoaded();
    await fillField(this.firstNameInput, data.firstName);
    await fillField(this.lastNameInput, data.lastName);

    await scrollFormTo(this.bioInput(currentBio));
    await fillField(this.bioInput(currentBio), data.bio);

    // Tapping an option adds or removes it; tap the ones that need to change, one per opening
    // of the list (on a slow device a tap while the list redraws can be lost, so check and retry).
    const dropdown = this.experiencesDropdown(data.bio);
    for (let attempt = 1; ; attempt += 1) {
      const selected = await this.selectedExperiences(dropdown);
      const toChange = [
        ...data.experiences.filter((name) => !selected.includes(name)),
        ...selected.filter((name) => !data.experiences.includes(name)),
      ];
      if (toChange.length === 0) {
        break;
      }
      if (attempt > data.experiences.length + 3) {
        throw new Error(`Could not choose the experiences ${data.experiences.join(', ')}.`);
      }
      await scrollFormTo(dropdown);
      await dropdown.click();
      await this.experienceOption(toChange[0]).waitForDisplayed();
      await browser.pause(1_000);
      await this.experienceOption(toChange[0]).click();
      await browser.pause(1_000);
      await browser.back();
      await this.experienceOption(toChange[0]).waitForDisplayed({ reverse: true });
    }
  }

  /**
   * Tap Save and wait until the app leaves Edit Profile. If it stays, fail with the message the
   * app showed after the tap (e.g. a required field), when there was one.
   */
  async save(): Promise<void> {
    await scrollFormTo(this.saveButton);
    const labelsBefore = new Set(await screenLabels());
    await this.saveButton.click();
    let message = '';
    const left = await browser.waitUntil(async () => {
      if (!(await this.heading.isDisplayed().catch(() => false))) {
        return true;
      }
      message = (await screenLabels()).find((label) => !labelsBefore.has(label)) ?? message;
      return false;
    }, { timeout: 60_000, interval: 1_000 }).catch(() => false);
    if (!left) {
      throw new Error(`The profile was not saved: still on "Edit Profile" after Save${message ? ` (app message: "${message}")` : ''}.`);
    }
  }

  /** Experiences shown in the dropdown, e.g. ["Hiking", "Culture & Heritage"]. */
  private async selectedExperiences(dropdown: ReturnType<typeof browser.$>): Promise<string[]> {
    await scrollFormTo(dropdown);
    const label = (await dropdown.getAttribute('content-desc')) ?? '';
    return label.split(',').map((item) => item.trim()).filter((item) => item && item !== 'Select');
  }
}

