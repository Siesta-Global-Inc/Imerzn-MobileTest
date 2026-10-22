import { byLabelStart, fillField, inputByHint, centerOnScreen, openTab, scrollTo, xpathString } from '@helpers/mobile-elements';

/**
 * Localite "Bookings" tab. Each booking is a view labelled "Booking ID: <id>"; inside it are
 * "<traveler name>\n<status>", the date, duration, start time, location, and the buttons
 * (Chat for paid bookings, Cancel Booking).
 */
export class MobileLocaliteBookingsPage {
  get bookingsTab() {
    return byLabelStart('Bookings\nTab');
  }

  get heading() {
    return browser.$('//android.view.View[@content-desc="Bookings"]');
  }

  card(bookingId: string) {
    return browser.$(`//*[@content-desc=${xpathString(`Booking ID: ${bookingId}`)}]`);
  }

  /** "<traveler name>\n<status>" inside the card. */
  travelerAndStatus(bookingId: string) {
    return this.card(bookingId).$('.//*[contains(@content-desc, "\n")]');
  }

  button(bookingId: string, name: 'Chat' | 'Cancel Booking' | 'Complete Booking') {
    return this.card(bookingId).$(`.//*[@content-desc=${xpathString(name)}]`);
  }

  get cancelReasonInput() {
    return inputByHint('Please write your reason here');
  }

  /** "Cancel Booking" button of the Cancel Booking sheet (the cards have buttons with the same label). */
  get confirmCancelButton() {
    return browser.$('(//android.widget.Button[@content-desc="Cancel Booking"])[last()]');
  }

  async open(): Promise<void> {
    await openTab(this.bookingsTab, this.heading);
  }

  /** Scroll to the booking and return "<traveler name>" and "<status>". */
  async travelerAndStatusOf(bookingId: string): Promise<{ traveler: string; status: string }> {
    await this.show(bookingId);
    const [traveler = '', status = ''] = ((await this.travelerAndStatus(bookingId).getAttribute('content-desc')) ?? '')
      .split('\n').map((line) => line.trim());
    return { traveler, status };
  }

  /** Wait until the booking's status matches, e.g. /^On Going$/ or /Cancel/. */
  async expectStatus(bookingId: string, status: RegExp): Promise<void> {
    let current = '';
    await browser.waitUntil(async () => status.test((current = (await this.travelerAndStatusOf(bookingId)).status)), {
      timeout: 60_000,
      interval: 3_000,
    }).catch(() => {
      throw new Error(`Booking ${bookingId}: status is "${current}", expected ${status}.`);
    });
  }

  /** Check the card's date, start time, and duration (e.g. "10-22-2026", "09:00 AM", "1 hour"). */
  async verifyCardDetails(bookingId: string, details: { date: string; startTime: string; durationHours: number }): Promise<void> {
    await this.show(bookingId);
    const card = this.card(bookingId);
    await expect(card.$(`.//*[@content-desc=${xpathString(details.date)}]`)).toBeExisting();
    await expect(card.$(`.//*[@content-desc=${xpathString(details.startTime)}]`)).toBeExisting();
    const duration = `${details.durationHours} hour${details.durationHours === 1 ? '' : 's'}`;
    await expect(card.$(`.//*[@content-desc=${xpathString(duration)}]`)).toBeExisting();
  }

  /**
   * Id of the first booking that shows "Complete Booking" (paid, On Going, and its start time has
   * passed), scrolling down the list; '' if there is none.
   */
  async firstCompletableBookingId(): Promise<string> {
    const completable = browser.$('(//*[starts-with(@content-desc, "Booking ID: ")][.//*[@content-desc="Complete Booking"]])[1]');
    // Wait for the list to load before looking (the tab shows before its bookings do).
    await browser.$('(//*[starts-with(@content-desc, "Booking ID: ")])[1]').waitForExist({ timeout: 60_000 });
    for (let swipe = 0; swipe < 15; swipe += 1) {
      if (await completable.waitForExist({ timeout: 3_000 }).then(() => true, () => false)) {
        return /Booking ID: (\d+)/.exec((await completable.getAttribute('content-desc')) ?? '')?.[1] ?? '';
      }
      const moved = await browser.execute('mobile: scrollGesture', {
        left: 100, top: 600, width: 1100, height: 1800, direction: 'down', percent: 0.7,
      }).catch(() => false);
      // At the end of the list, look once more (the last swipe may have just shown the button).
      if (!moved) {
        const id = await completable.isExisting().catch(() => false)
          ? /Booking ID: (\d+)/.exec((await completable.getAttribute('content-desc')) ?? '')?.[1] ?? ''
          : '';
        return id;
      }
    }
    return '';
  }

  /** Tap Complete Booking (it completes at once, without a confirmation) and wait for "Completed". */
  async complete(bookingId: string): Promise<void> {
    await this.show(bookingId);
    await this.button(bookingId, 'Complete Booking').click();
    await this.expectStatus(bookingId, /^Completed$/);
  }

  /** Cancel Booking on the card, type the reason, and confirm. */
  async cancel(bookingId: string, reason: string): Promise<void> {
    await this.show(bookingId);
    await this.button(bookingId, 'Cancel Booking').click();
    await this.cancelReasonInput.waitForDisplayed({ timeout: 30_000 });
    await fillField(this.cancelReasonInput, reason);
    await this.confirmCancelButton.click();
    await this.cancelReasonInput.waitForDisplayed({ reverse: true, timeout: 60_000 });
  }

  /** Scroll the list until the booking's buttons are on screen. */
  async show(bookingId: string): Promise<void> {
    const travelerLine = this.travelerAndStatus(bookingId);
    if (!(await travelerLine.isDisplayed().catch(() => false))) {
      await scrollTo(this.card(bookingId), 'down', 12).catch(async () => scrollTo(this.card(bookingId), 'up', 12));
    }
    // A card found while scrolling can be cut off at the screen edge (on CI Chat was below it):
    // move its top line into the upper half, which brings the buttons under it on screen.
    await centerOnScreen((await travelerLine.isDisplayed().catch(() => false)) ? travelerLine : this.card(bookingId));
  }
}
