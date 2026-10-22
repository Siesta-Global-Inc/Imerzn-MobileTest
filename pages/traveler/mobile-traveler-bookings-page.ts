import type { MobileCreatedBooking } from '@data/state/mobile-created-bookings';
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

  /**
   * The newest booking on the date: scroll down the list, collect the ids of the cards with that
   * date, and return the highest (ids grow with each booking).
   */
  async newestBookingId(date: string): Promise<string> {
    const ids = new Set<number>();
    for (let swipe = 0; swipe < 12; swipe += 1) {
      const before = ids.size;
      for (const card of await browser.$$('//*[contains(@content-desc, "Booking ID: ")]')) {
        const label = (await card.getAttribute('content-desc')) ?? '';
        const id = /Booking ID: (\d+)/.exec(label)?.[1];
        if (id && label.includes(date)) {
          ids.add(Number(id));
        }
      }
      if (swipe > 0 && ids.size === before && ids.size > 0) {
        break;
      }
      await browser.execute('mobile: scrollGesture', {
        left: 100, top: 600, width: 1100, height: 1800, direction: 'down', percent: 0.7,
      }).catch(() => {});
    }
    if (ids.size === 0) {
      throw new Error(`No booking dated ${date} was found in Bookings.`);
    }
    await this.scrollToTop();
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

  private async scrollToTop(): Promise<void> {
    for (let swipe = 0; swipe < 12; swipe += 1) {
      const canScroll = await browser.execute('mobile: scrollGesture', {
        left: 100, top: 600, width: 1100, height: 1800, direction: 'up', percent: 1,
      }).catch(() => false);
      if (!canScroll) {
        return;
      }
    }
  }
}

/** "9:00 AM" -> "09:00 AM" (the Details dialog pads the hour). */
export function padTime(time: string): string {
  return time.replace(/^(\d):/, '0$1:');
}
