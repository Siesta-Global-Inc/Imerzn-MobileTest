import { toPickerDayLabel } from '@data/traveler/mobile-booking-data';
import { byLabel, byLabelStart, fillField, scrollTo } from '@helpers/mobile-elements';

/**
 * Booking an experience as a traveler: the experience card on the Experiences tab, the
 * experience details ("Special Experience"), and the "Book Experience" sheet.
 */
export class MobileBookingSheet {
  /** Experience card on the Experiences tab; its label starts with the title. */
  experienceCard(title: string) {
    return byLabelStart(`${title}\n`);
  }

  /** "Book Experience" button on the experience details (the sheet's own label is a plain view). */
  get bookExperienceButton() {
    return browser.$('//android.widget.Button[@content-desc="Book Experience"]');
  }

  /** The Book Experience sheet. */
  get sheet() {
    return browser.$('//android.view.View[@content-desc="Book Experience"]');
  }

  get dateLabel() {
    return byLabel('Date(s)');
  }

  /** Day in the date picker, e.g. "Thursday, October 22, 2026". */
  pickerDay(date: Date) {
    return byLabel(toPickerDayLabel(date));
  }

  get pickerDoneButton() {
    return byLabel('Done');
  }

  /** "Select time" dropdown; after a time is chosen it shows the time instead. */
  get startTimeDropdown() {
    return byLabel('Select time');
  }

  /** Start time options of the open dropdown (buttons labelled e.g. "9:00 AM"). */
  get startTimeOptions() {
    return browser.$$('//android.widget.Button[contains(@content-desc, " AM") or contains(@content-desc, " PM")]');
  }

  get groupSizeInput() {
    return browser.$('//*[starts-with(@content-desc, "Group Size")]/following-sibling::android.widget.EditText[1]');
  }

  get noteInput() {
    return browser.$('//*[@content-desc="Notes"]/following-sibling::android.widget.EditText[1]');
  }

  get bookButton() {
    return browser.$('//android.widget.Button[@content-desc="Book"]');
  }

  /**
   * Open the experience from the Experiences tab (scrolling down to its card) and wait for its
   * details. maxSwipes: how far down the list to look (the app has no search by title).
   */
  async openExperience(title: string, maxSwipes = 10): Promise<void> {
    const card = this.experienceCard(title);
    await card.waitForExist({ timeout: 30_000 }).catch(() => {});
    await scrollTo(card, 'down', maxSwipes);
    await card.click();
    await this.bookExperienceButton.waitForDisplayed({ timeout: 60_000 });
  }

  /** Tap Book Experience and wait for the sheet. */
  async open(): Promise<void> {
    await this.bookExperienceButton.click();
    await this.dateLabel.waitForDisplayed({ timeout: 30_000 });
  }

  /** Pick the date: open the picker (the field under "Date(s)" has no label), choose the day, Done. */
  async selectDate(date: Date): Promise<void> {
    const { x, y, height } = await this.dateLabel.getElementRect(await this.dateLabel.elementId);
    await browser.execute('mobile: clickGesture', { x: x + 200, y: y + height + 115 });
    await this.pickerDoneButton.waitForDisplayed({ timeout: 30_000 });

    // The picker opens on the current month; go to the next month when the day is in it.
    for (let page = 0; page < 3 && !(await this.pickerDay(date).isDisplayed().catch(() => false)); page += 1) {
      await this.tapNextMonth();
    }
    await this.pickerDay(date).click();
    await this.pickerDoneButton.click();
    await this.pickerDoneButton.waitForDisplayed({ reverse: true });
  }

  /** Open the start time dropdown; true if it offers at least one time (closes it again). */
  async hasStartTimes(): Promise<boolean> {
    await this.startTimeDropdown.click();
    const offered = await browser.waitUntil(async () => (await this.startTimeOptions.length) > 0, { timeout: 10_000 })
      .then(() => true, () => false);
    await browser.back();
    await browser.pause(1_000);
    return offered;
  }

  /** Open the start time dropdown, choose the first time, and return it (e.g. "9:00 AM"). */
  async selectFirstStartTime(): Promise<string> {
    await this.startTimeDropdown.click();
    await browser.waitUntil(async () => (await this.startTimeOptions.length) > 0, {
      timeout: 30_000,
      timeoutMsg: 'No start times were offered.',
    });
    const first = (await this.startTimeOptions)[0];
    const time = (await first.getAttribute('content-desc')) ?? '';
    await first.click();
    await this.startTimeDropdown.waitForDisplayed({ reverse: true, timeout: 10_000 }).catch(() => {});
    return time;
  }

  /** Type the group size and the note (the sheet scrolls to show them). */
  async fillGroupSizeAndNote(groupSize: number, note: string): Promise<void> {
    await this.swipeSheetTo(this.groupSizeInput);
    await fillField(this.groupSizeInput, String(groupSize));
    await expect(this.groupSizeInput).toHaveText(String(groupSize));
    await this.swipeSheetTo(this.noteInput);
    await fillField(this.noteInput, note);
    await expect(this.noteInput).toHaveText(note);
  }

  /** Tap Book; the Payment dialog opens. */
  async book(): Promise<void> {
    await this.bookButton.click();
  }

  /** The next-month arrow has no label; it sits to the right of the month heading. */
  private async tapNextMonth(): Promise<void> {
    const heading = browser.$('//*[@content-desc and contains(@content-desc, " 20") and @clickable="true"][1]');
    const { x, y, width, height } = await heading.getElementRect(await heading.elementId);
    await browser.execute('mobile: clickGesture', { x: x + width + 100, y: y + height / 2 });
    await browser.pause(1_500);
  }

  /** Swipe in the middle of the sheet until the element is shown (the form edge does not scroll the sheet). */
  private async swipeSheetTo(element: ReturnType<typeof browser.$>): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    for (let swipe = 0; swipe < 5 && !(await element.isDisplayed().catch(() => false)); swipe += 1) {
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: Math.round(width / 2), y: Math.round(height * 0.75) })
        .down()
        .pause(100)
        .move({ duration: 800, x: Math.round(width / 2), y: Math.round(height * 0.4) })
        .pause(400)
        .up()
        .perform();
      await browser.pause(1_000);
    }
    await element.waitForDisplayed({ timeout: 10_000 });
  }
}
