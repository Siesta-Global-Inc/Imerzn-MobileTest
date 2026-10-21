import type { MobileExperienceData } from '@data/localite/mobile-localite-data';
import { uploadFromGallery } from '@helpers/mobile-app';
import {
  byLabel,
  byLabelStart,
  dragFormEdge,
  fillField,
  inputByHint,
  moveToUpperScreen,
  scrollFormTo,
  selectLocation,
  tapTitleBar,
  xpathString,
} from '@helpers/mobile-elements';
import { fillHtmlEditor } from '@helpers/mobile-html-editor';

/** "Create Experience" screen, opened from the localite Profile. */
export class MobileCreateExperiencePage {
  get heading() {
    return byLabel('Create Experience');
  }

  // A field's hint holds its label ("Title"), plus the placeholder while empty ("Title\nEnter title").
  get titleInput() {
    return inputByHint('Title');
  }

  /** "Categories of experiences" dropdown (shows "Select" until something is chosen). */
  get categoryDropdown() {
    // Inside the section label; the info icon next to the label has no text.
    return browser.$('//*[@content-desc="Categories of experiences"]//*[@clickable="true" and @content-desc!=""]');
  }

  categoryOption(name: string) {
    return browser.$(`//android.widget.Button[@content-desc=${xpathString(name)}]`);
  }

  /** "Enter location" field below "Select location ... Or". */
  get locationInput() {
    return browser.$('//*[@content-desc="Or"]/following-sibling::android.widget.EditText[1]');
  }

  get priceInput() {
    return inputByHint('Price (Per Person)');
  }

  /** Rich-text editor (a web view) inside a section such as "Know Before You Go". */
  editor(section: string) {
    return browser.$(`//*[@content-desc=${xpathString(section)}]//android.widget.EditText`);
  }

  get minPeopleInput() {
    return inputByHint('Minimum People');
  }

  get maxPeopleInput() {
    return inputByHint('Maximum People');
  }

  get durationInput() {
    return inputByHint('Duration (in hours)');
  }

  /** "Starting Time" dropdown; its label lists the chosen times, e.g. "Starting Time\n9:00 AM". */
  get startingTimeDropdown() {
    return byLabelStart('Starting Time');
  }

  startingTimeOption(time: string) {
    return browser.$(`//android.widget.Button[@content-desc=${xpathString(time)}]`);
  }

  get meetingPointInput() {
    return inputByHint('Meeting Point');
  }

  get dropOffPointInput() {
    return inputByHint('Drop-off Point');
  }

  get meetingNotesInput() {
    return inputByHint('Meeting / Dropoff Notes');
  }

  get policyInput() {
    return inputByHint('Cancellation Policy');
  }

  /** "Add Picture" area. */
  get addPictureArea() {
    return byLabel('Click here to upload');
  }

  /** "Add Additional Images or Videos" upload box, the last part of the form. */
  get additionalMediaArea() {
    return byLabel('Click to upload');
  }

  get publishButton() {
    return byLabel('Publish');
  }

  /** Layer behind an open dropdown list; tapping it closes the list. */
  get dropdownBackground() {
    return byLabel('Dismiss');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.titleInput.waitForDisplayed({ timeout: 60_000 });
  }

  /**
   * Upload the picture at the bottom of the form first, then scroll back to the top and fill the
   * fields from top to bottom. On the 2 GB emulator, opening the photo picker after typing makes
   * the app lose the rich-text editors' text (fine on a real phone), so the upload goes first.
   */
  async fillForm(data: MobileExperienceData): Promise<void> {
    await this.waitForLoaded();
    await scrollFormTo(this.additionalMediaArea, 'down', 25);
    await this.show(this.addPictureArea);
    await uploadFromGallery(data.primaryImagePath, () => this.addPictureArea.click());
    await scrollFormTo(this.titleInput, 'up', 25);

    await this.fillText(this.titleInput, data.title);
    await this.selectCategory(data.category);
    await selectLocation(this.locationInput, data.location);

    await this.fillText(this.priceInput, data.price);
    await this.fillEditor('Know Before You Go', [data.knowBefore]);

    // Transportation, Wheel Chair Accessible, multi-day, and Experience Status keep their
    // defaults (No, No, off, Active), which match the CSV.
    await this.fillText(this.minPeopleInput, data.minPeople);
    await this.fillText(this.maxPeopleInput, data.maxPeople);

    // The app asks for the duration before it accepts a starting time.
    await this.fillText(this.durationInput, data.duration);
    await this.selectStartingTimes(data.startingTimes);

    await this.show(this.meetingPointInput);
    await selectLocation(this.meetingPointInput, data.location);
    await this.show(this.dropOffPointInput);
    await selectLocation(this.dropOffPointInput, data.location);

    await this.fillEditor("What's Included / Not Included", data.included);
    await this.fillText(this.meetingNotesInput, data.meetingNotes);
    await this.fillEditor('Description', [data.description]);
    await this.fillText(this.policyInput, data.policy);
  }

  /**
   * Before Publish (user's steps): scroll up to "Know Before You Go" and type it again if it is
   * empty, then tap the Price field. On the emulator the app can empty that editor after it was
   * filled; tapping Price moves the focus out of the editor so the app keeps its text.
   */
  async recheckBeforePublish(data: MobileExperienceData): Promise<void> {
    const knowBefore = this.editor('Know Before You Go');
    await this.showAbove(knowBefore);
    const text = await knowBefore.getText().catch(() => '');
    if (!text.includes(data.knowBefore)) {
      console.info('[RECHECK] Know Before You Go was empty; typing it again.');
      await this.fillEditor('Know Before You Go', [data.knowBefore]);
    }
    await this.showAbove(this.priceInput);
    await this.priceInput.click();
  }

  /**
   * Tap Publish (the button stays at the bottom of the screen, so no scrolling is needed) and wait
   * until the app leaves Create Experience. If the app shows a message instead (e.g. "Please enter
   * the description"), fail with it.
   */
  async publish(): Promise<void> {
    await this.publishButton.click();
    // Pictures of the first seconds after Publish, to see any message the app shows.
    for (let shot = 1; shot <= 2; shot += 1) {
      await browser.saveScreenshot(`mobile-test-results/EXP-002-after-publish-${shot}.png`).catch(() => {});
    }
    let message = '';
    const left = await browser.waitUntil(async () => {
      // Not the "Create Experience" heading: the Profile screen has a "+ Create Experience"
      // button with the same label.
      if (!(await this.publishButton.isDisplayed().catch(() => false))) {
        return true;
      }
      message = (await this.bottomMessage()) || message;
      // A message means the app refused the form; no need to wait longer.
      return message !== '';
    }, { timeout: 180_000, interval: 2_000 }).catch(() => false);
    if (!left || message) {
      throw new Error(`The experience was not published: still on "Create Experience" after Publish${message ? ` (app message: "${message}")` : ''}.`);
    }
  }

  /** Text of the message bar the app shows at the bottom of the screen, if any. */
  private async bottomMessage(): Promise<string> {
    const source = await browser.getPageSource();
    // The message bar sits in the bottom fifth of the screen, over the Save As Draft / Publish bar.
    const { height } = await browser.getWindowSize();
    for (const match of source.matchAll(/content-desc="([^"]+)"[^>]*bounds="\[\d+,(\d+)\]/g)) {
      const [, label, top] = match;
      if (Number(top) > height * 0.8 && !['Publish', 'Save As Draft', 'Click to upload'].includes(label)) {
        return label;
      }
    }
    return '';
  }

  /** Choose the category in the multi-select list, then close the list. */
  private async selectCategory(category: string): Promise<void> {
    await this.categoryDropdown.click();
    await this.categoryOption(category).waitForDisplayed();
    await this.categoryOption(category).click();
    await this.closeDropdown();
    await expect(this.categoryDropdown).toHaveAttribute('content-desc', expect.stringContaining(category));
  }

  /** Choose each starting time in the list of 15-minute times, scrolling the list to it. */
  private async selectStartingTimes(times: string[]): Promise<void> {
    await this.show(this.startingTimeDropdown);
    await this.startingTimeDropdown.click();
    for (const time of times) {
      await this.scrollListTo(this.startingTimeOption(time), time);
      await this.startingTimeOption(time).click();
    }
    await this.closeDropdown();
    for (const time of times) {
      await expect(this.startingTimeDropdown).toHaveAttribute('content-desc', expect.stringContaining(time));
    }
  }

  /**
   * Drag inside an open time list until the option is shown, down or back up depending on whether
   * the first time on screen is before or after it (a drag can overshoot on a slow emulator).
   */
  private async scrollListTo(option: ReturnType<typeof browser.$>, time: string): Promise<void> {
    const target = minutesOfDay(time);
    for (let drag = 0; drag < 25 && !(await option.isDisplayed()); drag += 1) {
      const first = browser.$('(//android.widget.Button[contains(@content-desc, " AM") or contains(@content-desc, " PM")])[1]');
      const { x, y, width } = await first.getElementRect(await first.elementId);
      const down = minutesOfDay((await first.getAttribute('content-desc')) ?? '') < target;
      const centerX = Math.round(x + width / 2);
      const [from, to] = down ? [y + 600, y + 100] : [y + 100, y + 600];
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: centerX, y: from })
        .down()
        .pause(100)
        .move({ duration: 600, x: centerX, y: to })
        // Hold still before lifting, so Android does not turn the drag into a fling: on CI the
        // list flew past 1:30 PM to the end of the day.
        .pause(400)
        .up()
        .perform();
      await browser.pause(500);
    }
    await option.waitForDisplayed({ timeout: 5_000 });
  }

  /** Close an open dropdown list by tapping the layer at the top of the screen. */
  private async closeDropdown(): Promise<void> {
    // Just below the title bar, scaled to the screen size.
    const { width, height } = await browser.getWindowSize();
    await browser.execute('mobile: clickGesture', { x: Math.round(width / 2), y: Math.round(height * 0.125) });
    await this.dropdownBackground.waitForDisplayed({ reverse: true });
  }

  /** Scroll the rich-text editor into the upper part of the screen and set its text. */
  private async fillEditor(section: string, lines: string[]): Promise<void> {
    const editor = this.editor(section);
    await this.show(editor);
    await fillHtmlEditor(editor, lines);
  }

  /**
   * Scroll to an empty text field, type the value, and check the field kept it. If another field
   * still holds the focus the text is dropped; then tap the title bar (which does nothing by
   * itself) to release the focus, and type again.
   */
  private async fillText(field: ReturnType<typeof browser.$>, value: string): Promise<void> {
    await this.show(field);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await fillField(field, value);
      // The emulator can take a few seconds to show the typed value.
      const kept = await browser
        .waitUntil(async () => (await field.getText()) === value, { timeout: 5_000, interval: 1_000 })
        .catch(() => false);
      if (kept) {
        return;
      }
      await tapTitleBar();
    }
    await expect(field).toHaveText(value);
  }

  /**
   * Scroll up until the element is on screen. An element found while scrolling up appears at the
   * top edge, possibly under the title bar, so scroll a little further when it is that high.
   */
  private async showAbove(element: ReturnType<typeof browser.$>): Promise<void> {
    await scrollFormTo(element, 'up', 25);
    const { height } = await browser.getWindowSize();
    const { y } = await element.getLocation();
    if (y < height * 0.25) {
      await dragFormEdge('up', 0.25);
    }
    await element.waitForDisplayed();
  }

  /**
   * Scroll the element into the upper part of the screen. The Save As Draft / Publish bar stays
   * at the bottom of the screen, so a tap on a field behind it would hit the bar instead.
   */
  private async show(element: ReturnType<typeof browser.$>): Promise<void> {
    await scrollFormTo(element);
    await moveToUpperScreen(element);
  }
}

/** Minutes since midnight of a time like "1:30 PM", to compare times in the starting-time list. */
function minutesOfDay(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return 0;
  }
  const [, hours, minutes, period] = match;
  return ((Number(hours) % 12) + (period.toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(minutes);
}
