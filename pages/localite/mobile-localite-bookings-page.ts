import { byLabelStart, fillField, inputByHint, openTab, scrollTo, xpathString } from '@helpers/mobile-elements';

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

  /** Filter menu ("Show menu") in the search box: All, Pending, On Going, Completed, Cancelled, Expired. */
  get filterMenuButton() {
    return browser.$('//android.widget.Button[@content-desc="Show menu"]');
  }

  statusFilterOption(status: string) {
    return browser.$(`//android.widget.RadioButton[@content-desc=${xpathString(status)}]`);
  }

  /** "Search by country, state, city or zipcode" box; it also finds a booking by its id. */
  get searchInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  /**
   * Show the booking's whole card: filter the list by the status, and if the card is still not
   * fully on screen (on CI booking 4077 was cut off under the search bar), search its Booking ID,
   * which lists only that booking.
   */
  async findBooking(bookingId: string, status: 'On Going' | 'Pending'): Promise<void> {
    await this.filterMenuButton.waitForDisplayed({ timeout: 30_000 });
    await this.filterMenuButton.click();
    await this.statusFilterOption(status).waitForDisplayed({ timeout: 30_000 });
    // Tap the status until it is selected (a tap while the menu is opening can be ignored). The
    // menu can stay open after the choice (seen locally), so close it with Back if needed.
    const option = this.statusFilterOption(status);
    for (let tap = 1; tap <= 3; tap += 1) {
      await browser.pause(1_500);
      if (!(await option.isDisplayed().catch(() => false))) {
        break;
      }
      await option.click().catch(() => {});
      await browser.pause(1_500);
      if ((await option.getAttribute('checked').catch(() => 'false')) === 'true') {
        break;
      }
    }
    if (await option.isDisplayed().catch(() => false)) {
      await browser.back();
    }
    await option.waitForDisplayed({ reverse: true, timeout: 10_000 });
    await browser.pause(2_000);
    if (await this.isFullyShown(bookingId)) {
      return;
    }
    console.info(`[INFO] Booking ${bookingId} is not fully shown after filtering by ${status}; searching its id.`);
    await this.searchInput.click();
    await this.searchInput.setValue(bookingId);
    await browser.pressKeyCode(66); // Enter
    await this.travelerAndStatus(bookingId).waitForDisplayed({ timeout: 30_000 });
  }

  /** True when the card's top line and its bottom (the buttons) are on screen. */
  private async isFullyShown(bookingId: string): Promise<boolean> {
    if (!(await this.travelerAndStatus(bookingId).isDisplayed().catch(() => false))) {
      return false;
    }
    const { height } = await browser.getWindowSize();
    const { y, height: cardHeight } = await this.card(bookingId).getElementRect(await this.card(bookingId).elementId);
    // The bottom tab bar covers the last ~9% of the screen.
    return y + cardHeight < height * 0.9;
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
    // move its top into the upper half, which brings the buttons under it on screen. The drag is
    // in the middle of the list: the screen's left edge (used by centerOnScreen) is outside this
    // list and does not scroll it.
    // The card can also be cut off at the top, its traveler/status line hidden under the search bar
    // (on CI LCN-001 failed on pending booking 4149 like that): then scroll the list up a little
    // until the whole card shows.
    const { width, height } = await browser.getWindowSize();
    for (let drag = 0; drag < 3; drag += 1) {
      const { y } = await this.card(bookingId).getLocation();
      const cutOffAtTop = !(await travelerLine.isDisplayed().catch(() => false));
      if (!cutOffAtTop && y <= height * 0.55) {
        return;
      }
      const x = Math.round(width / 2);
      // Cut off at the top: drag down (the list scrolls up); too low: drag up (the list scrolls down).
      const [from, to] = cutOffAtTop ? [height * 0.4, height * 0.6] : [height * 0.7, height * 0.4];
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x, y: Math.round(from) })
        .down()
        .pause(100)
        .move({ duration: 600, x, y: Math.round(to) })
        // Hold still before lifting, so the list does not fling past the card.
        .pause(400)
        .up()
        .perform();
      await browser.pause(1_000);
    }
  }
}
