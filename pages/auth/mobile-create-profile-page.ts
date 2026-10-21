import type {
  MobileLocaliteProfileData,
  MobileTravelerProfileData,
} from '@data/common/mobile-auth-data';
import { addImageToGallery } from '@helpers/mobile-app';
import { byLabel, byLabelStart, fillField, inputByHint, scrollTo, tapInside } from '@helpers/mobile-elements';

/** "Create Your Profile" screen shown after the signup code is verified (Traveler and Localite). */
export class MobileCreateProfilePage {
  /** Title. The localite screen joins the title and subtitle into one label. */
  get heading() {
    return byLabelStart('Create Your Profile');
  }

  /** Round profile photo with the camera icon. */
  get profilePhoto() {
    return browser.$('(//android.widget.ImageView[@clickable="true"])[1]');
  }

  get chooseFromGalleryOption() {
    return byLabel('Choose From Gallery');
  }

  /** Newest photo in the system photo picker. */
  get newestGalleryPhoto() {
    return browser.$('(//*[starts-with(@content-desc, "Photo")])[1]');
  }

  get cropImageTitle() {
    return byLabel('Crop Image');
  }

  /** Check-mark button above the "Done" label on the Crop Image screen. */
  get cropDoneButton() {
    return browser.$('(//*[@content-desc="Done"]/preceding-sibling::android.widget.Button)[last()]');
  }

  get submitButton() {
    return byLabel('Submit');
  }

  get locationSearchInput() {
    return inputByHint('Search location');
  }

  locationSuggestion(location: string) {
    return byLabel(location);
  }

  get bioInput() {
    return inputByHint('Bio');
  }

  /** "Experiences I host" dropdown (shows "Select" until something is chosen). */
  get experiencesDropdown() {
    return browser.$('//*[@content-desc="Experiences I host"]/*[not(@content-desc="Request new activity")]');
  }

  experienceOption(name: string) {
    return browser.$(`//android.widget.Button[@content-desc="${name}"]`);
  }

  get zipcodeInput() {
    return inputByHint('Zipcode');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
  }

  /** Upload a profile photo: Choose From Gallery > newest photo > Crop Image > Done. */
  async uploadProfilePhoto(imagePath: string): Promise<void> {
    // Copy the image to the device first so it is the newest photo in the picker.
    await addImageToGallery(imagePath);

    await scrollTo(this.profilePhoto, 'up');
    // Only the camera icon (lower right of the round photo) opens the photo options.
    await tapInside(this.profilePhoto, 0.62, 0.71);
    await this.chooseFromGalleryOption.click();

    await this.newestGalleryPhoto.waitForDisplayed({ timeout: 60_000 });
    await this.newestGalleryPhoto.click();

    await this.cropImageTitle.waitForDisplayed({ timeout: 60_000 });
    // A tap while the cropper is still loading the picture is ignored; tap Done again until the
    // Crop Image screen closes.
    for (let tap = 1; tap <= 3; tap += 1) {
      await browser.pause(2_000);
      await this.cropDoneButton.click();
      if (await this.cropImageTitle.waitForDisplayed({ reverse: true, timeout: 20_000 }).then(() => true, () => false)) {
        return;
      }
    }
    await this.cropImageTitle.waitForDisplayed({ reverse: true, timeout: 20_000 });
  }

  /** Traveler: search a location and pick the matching suggestion (fills Country, State, City). */
  async selectLocation(data: MobileTravelerProfileData): Promise<void> {
    await scrollTo(this.locationSearchInput);
    const suggestion = this.locationSuggestion(data.location);
    // The location search sometimes never answers; then clear the field and type again.
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await this.locationSearchInput.clearValue();
      await fillField(this.locationSearchInput, data.locationSearch);
      if (await suggestion.waitForDisplayed({ timeout: 20_000 }).then(() => true, () => false)) {
        break;
      }
      if (attempt === 3) {
        throw new Error(`The location suggestion "${data.location}" was not shown.`);
      }
    }
    await suggestion.click();
  }

  /** Localite: fill Bio, choose the experiences hosted, and enter the zipcode. */
  async fillLocaliteDetails(data: MobileLocaliteProfileData): Promise<void> {
    await scrollTo(this.bioInput);
    await fillField(this.bioInput, data.bio);

    // Choose one experience per opening of the list, and check the field shows it: on a slow
    // device a tap while the list redraws can be lost, so try again. Back closes the list.
    for (const experience of data.experiences) {
      for (let attempt = 1; !(await this.selectedExperiences()).includes(experience); attempt += 1) {
        if (attempt > 3) {
          throw new Error(`Could not select the experience "${experience}".`);
        }
        await scrollTo(this.experiencesDropdown);
        await this.experiencesDropdown.click();
        await this.experienceOption(experience).waitForDisplayed();
        await browser.pause(1_000);
        await this.experienceOption(experience).click();
        await browser.pause(1_000);
        await browser.back();
        await this.experienceOption(experience).waitForDisplayed({ reverse: true });
      }
    }
    await expect(this.experiencesDropdown).toHaveAttribute('content-desc', data.experiences.join(', '));

    await scrollTo(this.zipcodeInput);
    await fillField(this.zipcodeInput, data.zipcode);
  }

  /** Experiences shown in the "Experiences I host" field, e.g. ["Hiking", "Culture & Heritage"]. */
  private async selectedExperiences(): Promise<string[]> {
    await scrollTo(this.experiencesDropdown);
    const label = (await this.experiencesDropdown.getAttribute('content-desc')) ?? '';
    return label.split(',').map((item) => item.trim());
  }

  /** Tap Submit and wait until the app leaves the Create Your Profile screen. */
  async submit(): Promise<void> {
    await scrollTo(this.submitButton);
    await this.submitButton.click();
    await this.heading.waitForDisplayed({
      reverse: true,
      timeout: 60_000,
      timeoutMsg: 'The profile was not saved: still on "Create Your Profile" after Submit.',
    });
  }
}
