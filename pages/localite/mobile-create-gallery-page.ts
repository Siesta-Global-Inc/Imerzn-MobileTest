import type { MobileGalleryData } from '@data/localite/mobile-localite-data';
import { uploadFromGallery } from '@helpers/mobile-app';
import { byLabel, fillField, inputByHint, scrollFormTo, selectLocation } from '@helpers/mobile-elements';

/** "Create Gallery" screen, opened from the localite Profile. */
export class MobileCreateGalleryPage {
  get heading() {
    return byLabel('Create Gallery');
  }

  // A field's hint holds its label ("Title"), plus the placeholder while empty ("Title\nEnter title").
  get titleInput() {
    return inputByHint('Title');
  }

  /** Location field; once a location is picked it has no hint, so find it by position. */
  get locationInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  get descriptionInput() {
    return inputByHint('Description');
  }

  /** "Add Picture" area. */
  get addPictureArea() {
    return byLabel('Click here to upload');
  }

  get saveButton() {
    return byLabel('Save');
  }

  /** Message shown at the bottom of the Profile screen after saving. */
  get createdMessage() {
    return byLabel('Your Gallery has been created successfully.');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
  }

  async fillForm(data: MobileGalleryData): Promise<void> {
    await this.waitForLoaded();
    await fillField(this.titleInput, data.title);
    await selectLocation(this.locationInput, data.location);

    await scrollFormTo(this.descriptionInput);
    await fillField(this.descriptionInput, data.description);

    await scrollFormTo(this.addPictureArea);
    await uploadFromGallery(data.primaryImagePath, () => this.addPictureArea.click());
  }

  /**
   * Tap Save and wait for the success message. Right after a picture is added the app can miss
   * the tap, so tap again while the form is still open.
   */
  async save(): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      if (await this.saveButton.isDisplayed().catch(() => false)) {
        await this.saveButton.click();
      }
      const saved = await this.createdMessage
        .waitForDisplayed({ timeout: 20_000 })
        .then(() => true, () => false);
      if (saved || !(await this.heading.isDisplayed().catch(() => false))) {
        await this.createdMessage.waitForDisplayed({ timeout: 30_000 }).catch(() => {});
        return;
      }
    }
    throw new Error('The gallery was not saved: still on "Create Gallery" after tapping Save 3 times.');
  }
}
