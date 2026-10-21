import type { MobileStoryData } from '@data/traveler/mobile-traveler-data';
import { uploadFromFilePicker } from '@helpers/mobile-app';
import { byLabel, fillField, scrollTo, selectLocation } from '@helpers/mobile-elements';

/**
 * "Share Your Travel Experience" screen, shown to a traveler right after logging in.
 * Submitting it publishes a story; SKIP goes on to the app.
 */
export class MobileShareStoryPage {
  get heading() {
    return byLabel('Share Your Travel Experience');
  }

  // The fields are found by their order on the form: their placeholder (hint) is cleared once
  // they hold text, so a hint-based selector no longer finds a filled field.
  get titleInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  get locationInput() {
    return browser.$('(//android.widget.EditText)[2]');
  }

  get descriptionInput() {
    return browser.$('(//android.widget.EditText)[3]');
  }

  /** "Click to upload" under Add Picture; it opens Android's file picker. */
  get uploadArea() {
    return byLabel('Click to upload');
  }

  get submitButton() {
    return byLabel('Submit Experience');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.titleInput.waitForDisplayed();
  }

  /**
   * Fill in the story. The picture is added first: on the slow emulator, coming back from the
   * file picker can make the app lose text typed before it.
   */
  async fillStory(data: MobileStoryData): Promise<void> {
    await scrollTo(this.uploadArea);
    await uploadFromFilePicker(data.imagePath, () => this.uploadArea.click());

    await scrollTo(this.titleInput, 'up');
    await fillField(this.titleInput, data.title);
    await expect(this.titleInput).toHaveText(data.title);

    await selectLocation(this.locationInput, data.location);

    await scrollTo(this.descriptionInput);
    await fillField(this.descriptionInput, data.description);
    await expect(this.descriptionInput).toHaveText(data.description);
  }

  /**
   * Tap Submit Experience and wait until the app leaves this screen. (App bug: the app then
   * shows a red error screen instead of Stories, although the story is saved.)
   */
  async submit(): Promise<void> {
    await scrollTo(this.submitButton);
    await this.submitButton.click();
    await this.heading.waitForDisplayed({ reverse: true, timeout: 120_000 });
  }
}
