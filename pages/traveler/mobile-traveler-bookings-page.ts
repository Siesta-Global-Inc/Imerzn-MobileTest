import type { MobileCreatedBooking } from '@data/state/mobile-created-bookings';

/** Statuses in the Bookings filter menu. */
export type MobileBookingStatusFilter = 'All' | 'Pending' | 'On Going' | 'Completed' | 'Cancelled' | 'Expired';
import { byLabel, byLabelStart, fillField, inputByHint, centerOnScreen, openTab, scrollTo, xpathString } from '@helpers/mobile-elements';

/**
 * Traveler "Bookings" tab. Each booking is a card whose label lists the localite, rating,
 * status, "Booking ID: <id>", location, and date; its buttons (e.g. Cancel Trip) are inside it.
 */
export class MobileTravelerBookingsPage {
  /** "Bookings" tab in the bottom bar ("Bookings\nTab 3 of 4", or "of 5" once Messages shows). */
  get bookingsTab() {
    return byLabelStart('Bookings\nTab');
  }

  get heading() {
    return browser.$('//android.view.View[@content-desc="Bookings"]');
  }

  card(bookingId: string) {
    return browser.$(`//*[contains(@content-desc, ${xpathString(`\nBooking ID: ${bookingId}\n`)})]`);
  }

  cancelTripButton(bookingId: string) {
    return this.card(bookingId).$('.//*[@content-desc="Cancel Trip"]');
  }

  /** Reason box of the Cancel Trip sheet. */
  get cancelReasonInput() {
    return inputByHint('Please write your reason here');
  }

  /** "Cancel Trip" button of the Cancel Trip sheet (the cards have buttons with the same label). */
  get confirmCancelButton() {
    return browser.$('(//android.widget.Button[@content-desc="Cancel Trip"])[last()]');
  }

  /** Details dialog opened by tapping a booking card. */
  get detailsHeading() {
    return byLabel('Details');
  }

  async open(): Promise<void> {
    await openTab(this.bookingsTab, this.heading);
  }

  /** Filter menu ("Show menu") right of the search box: All, Pending, On Going, ... */
  get filterMenuButton() {
    return byLabel('Show menu');
  }

  /** Option of the open filter menu. */
  statusFilterOption(status: MobileBookingStatusFilter) {
    return browser.$(`//android.widget.RadioButton[@content-desc=${xpathString(status)}]`);
  }

  /** Show only the bookings with the status: open the filter menu and choose it. */
  async filterByStatus(status: MobileBookingStatusFilter): Promise<void> {
    await this.filterMenuButton.waitForDisplayed({ timeout: 30_000 });
    await this.filterMenuButton.click();
    await this.statusFilterOption(status).waitForDisplayed({ timeout: 30_000 });
    await this.statusFilterOption(status).click();
    await this.statusFilterOption(status).waitForDisplayed({ reverse: true, timeout: 30_000 });
  }

  /**
   * The newest booking with the status on the date: filter the list by the status, then return the
   * highest id among the cards with that date (ids grow with each booking). Right after a payment
   * the status can still be changing, so the filter is applied again until the booking shows.
   */
  async newestBookingId(date: string, status: MobileBookingStatusFilter): Promise<string> {
    const ids = new Set<number>();
    for (let attempt = 1; attempt <= 3 && ids.size === 0; attempt += 1) {
      await this.filterByStatus(status);
      await browser.waitUntil(async () => {
        for (const card of await browser.$$('//*[contains(@content-desc, "Booking ID: ")]')) {
          const label = (await card.getAttribute('content-desc')) ?? '';
          const id = /Booking ID: (\d+)/.exec(label)?.[1];
          if (id && label.includes(date)) {
            ids.add(Number(id));
          }
        }
        return ids.size > 0;
      }, { timeout: 20_000, interval: 2_000 }).catch(() => {});
    }
    if (ids.size === 0) {
      throw new Error(`No ${status} booking dated ${date} was found in Bookings (filtered by ${status}).`);
    }
    return String(Math.max(...ids));
  }

  /**
   * Scroll to the booking's card and return its status line (third line, e.g. "On Going").
   * Opens the Bookings tab first if the app has left it (on CI, after Cancel Trip the app showed
   * the Localites tab).
   */
  async status(bookingId: string): Promise<string> {
    if (!(await this.heading.isDisplayed().catch(() => false))) {
      await this.open();
    }
    await this.show(bookingId);
    const label = (await this.card(bookingId).getAttribute('content-desc')) ?? '';
    return label.split('\n')[2]?.trim() ?? '';
  }

  /** Wait until the booking's status matches, e.g. /^On Going$/ or /Cancel/. */
  async expectStatus(bookingId: string, status: RegExp): Promise<void> {
    let current = '';
    await browser.waitUntil(async () => status.test((current = await this.status(bookingId))), {
      timeout: 60_000,
      interval: 3_000,
    }).catch(() => {
      throw new Error(`Booking ${bookingId}: status is "${current}", expected ${status}.`);
    });
  }

  /** Tap the card (above its buttons) and check the Details dialog, then close it with Back. */
  async verifyDetails(booking: MobileCreatedBooking): Promise<void> {
    await this.show(booking.bookingId);
    const { x, y, width, height } = await this.card(booking.bookingId).getElementRect(
      await this.card(booking.bookingId).elementId,
    );
    await browser.execute('mobile: clickGesture', { x: x + width / 2, y: y + height * 0.25 });
    await this.detailsHeading.waitForDisplayed({ timeout: 30_000 });

    await expect(byLabel(booking.experienceTitle)).toBeDisplayed();
    await expect(byLabelStart(`No. of People\n${booking.people}\n`)).toBeDisplayed();
    await expect(byLabelStart(`Date(s)\n${booking.date}\n`)).toBeDisplayed();
    await expect(byLabelStart('Start time\n')).toHaveAttribute('content-desc', expect.stringContaining(padTime(booking.startTime)));
    await expect(byLabel(booking.note)).toBeDisplayed();

    await browser.back();
    await this.detailsHeading.waitForDisplayed({ reverse: true, timeout: 10_000 });
  }

  /** Cancel Trip on the card, type the reason, and confirm. */
  async cancel(bookingId: string, reason: string): Promise<void> {
    await this.show(bookingId);
    await this.cancelTripButton(bookingId).click();
    await this.cancelReasonInput.waitForDisplayed({ timeout: 30_000 });
    await fillField(this.cancelReasonInput, reason);
    await this.confirmCancelButton.click();
    await this.cancelReasonInput.waitForDisplayed({ reverse: true, timeout: 60_000 });
  }

  /** Scroll the list until the booking's card is on screen. */
  async show(bookingId: string): Promise<void> {
    if (await this.card(bookingId).isDisplayed().catch(() => false)) {
      await centerOnScreen(this.card(bookingId));
      return;
    }
    await scrollTo(this.card(bookingId), 'down', 12).catch(async () => scrollTo(this.card(bookingId), 'up', 12));
    // A card found while scrolling can be cut off at the screen edge; bring all of it on screen.
    await centerOnScreen(this.card(bookingId));
  }
}

/** "9:00 AM" -> "09:00 AM" (the Details dialog pads the hour). */
export function padTime(time: string): string {
  return time.replace(/^(\d):/, '0$1:');
}
