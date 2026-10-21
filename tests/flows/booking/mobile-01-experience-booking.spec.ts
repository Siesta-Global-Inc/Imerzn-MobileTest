import { loginAsTraveler } from '@pages/auth/mobile-session';
import { MobileBookingSheet } from '@pages/traveler/mobile-booking-sheet';
import { MobilePaymentDialog, toCents } from '@pages/traveler/mobile-payment-dialog';
import { MobileTravelerBookingsPage } from '@pages/traveler/mobile-traveler-bookings-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { readMobileExperienceData } from '@data/localite/mobile-localite-data';
import {
  type MobileBookingRequest, readMobileBookingData, toAppDate,
} from '@data/traveler/mobile-booking-data';
import {
  type MobileCreatedBooking, saveMobileCreatedBookings,
} from '@data/state/mobile-created-bookings';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';

/*
 * Mobile booking flow step 1 of 5: the traveler (mobile AUTH-003) books the experience published by
 * mobile EXP-002 four times: 2 paid and 2 left pending. The bookings are saved to
 * testdata/traveler/mobile-created-bookings.json for steps 2-5.
 * Unlike the web, the app has no promo code, so there is no promo step.
 */
describe('mobile-flow-booking', () => {
  it('mobile BKG-001 | Traveler books the created experience: 2 paid and 2 pending', async function () {
    // Four bookings with payment on a slow emulator.
    this.timeout(2_400_000);

    // Pre-setup: the localite's latest experience, the traveler, and booking.csv.
    const localite = await readMobileCreatedLocalite();
    const traveler = await readMobileCreatedTraveler();
    const experienceTitle = localite.experienceTitle;
    if (!experienceTitle) {
      throw new Error('No experience recorded for the mobile localite. Run mobile EXP-002 first.');
    }
    const booking = await readMobileBookingData();
    const pricePerPerson = Number((await readMobileExperienceData()).price);
    console.info(`[DATA] Traveler email: ${traveler.email}`);
    console.info(`[DATA] Experience: ${experienceTitle}`);

    const homePage = new MobileTravelerHomePage();
    const bookingSheet = new MobileBookingSheet();
    const paymentDialog = new MobilePaymentDialog();
    const bookingsPage = new MobileTravelerBookingsPage();

    const paid: MobileCreatedBooking[] = [];
    const pending: MobileCreatedBooking[] = [];

    // Step 1: Log in as the traveler (SKIP on "Share Your Travel Experience").
    await step('Log in as traveler', async () => {
      await loginAsTraveler(traveler);
    });

    /**
     * Book the experience once: open it from Experiences, fill in the Book Experience sheet, Book,
     * check the Payment prices, then pay or cancel Payment (pending). Then find the new booking's
     * id in Bookings and check its status.
     */
    const bookOnce = async (label: string, request: MobileBookingRequest, pay: boolean): Promise<void> => {
      const date = toAppDate(request.date);
      let startTime = '';

      await step(`${label}: open the experience and fill in the booking`, async () => {
        await homePage.experiencesTab.click();
        await bookingSheet.openExperience(experienceTitle);
        await bookingSheet.open();
        await bookingSheet.selectDate(request.date);
        startTime = await bookingSheet.selectFirstStartTime();
        await bookingSheet.fillGroupSizeAndNote(request.groupSize, request.note);
        console.info(`[DATA] ${label}: ${date} ${startTime}, ${request.groupSize} people`);
      });

      let totalAmountDue = 0;
      await step(`${label}: Book and verify the Payment prices`, async () => {
        await bookingSheet.book();
        await paymentDialog.waitForLoaded();
        const prices = await paymentDialog.readPrices();
        totalAmountDue = prices.totalAmountDue;
        expect(prices.people).toBe(request.groupSize);
        expect(prices.amount).toBe(toCents(pricePerPerson * request.groupSize));
        expect(prices.subTotal).toBe(prices.amount);
        expect(prices.platformFee).toBe(toCents((prices.platformFeePercent / 100) * prices.subTotal));
        expect(prices.totalAmountDue).toBe(toCents(prices.subTotal + prices.salesTax + prices.platformFee));
      });

      if (pay) {
        await step(`${label}: pay with card`, async () => {
          await paymentDialog.fillCard(booking.payment);
          await paymentDialog.fillBilling(booking.payment);
          await paymentDialog.payAndVerify();
        });
      } else {
        await step(`${label}: cancel Payment (booking stays pending)`, async () => {
          await paymentDialog.cancel();
        });
      }

      await step(`${label}: find the booking in Bookings`, async () => {
        // Cancelling Payment leaves the Book Experience sheet open over the experience; press Back
        // (closes the sheet, then the experience) until the home tabs show.
        for (let back = 0; back < 4 && !(await homePage.experiencesTab.isDisplayed().catch(() => false)); back += 1) {
          await browser.back();
          await browser.pause(2_000);
        }
        await homePage.experiencesTab.waitForDisplayed({ timeout: 30_000 });
        await bookingsPage.open();
        const bookingId = await bookingsPage.newestBookingId(date);
        const status = await bookingsPage.status(bookingId);
        console.info(`[DATA] ${label}: Booking ID ${bookingId}, status "${status}"`);
        if (pay) {
          await bookingsPage.expectStatus(bookingId, /^On Going$/);
        } else {
          await bookingsPage.expectStatus(bookingId, /pending/i);
        }
        const record: MobileCreatedBooking = {
          bookingId, experienceTitle, date, startTime,
          people: request.groupSize, note: request.note,
          ...(pay ? { totalAmountDue } : {}),
        };
        (pay ? paid : pending).push(record);
        // Save after every booking, so a later failure keeps the bookings made so far.
        await saveMobileCreatedBookings({ travelerEmail: traveler.email, localiteEmail: localite.email, paid, pending });
      });
    };

    // Steps 2-5: paid booking (today + 1).
    await bookOnce('Paid booking', booking.paid, true);
    // Steps 6-9: pending booking (today + 2).
    await bookOnce('Pending booking', booking.pending, false);
    // Steps 10-13: second paid booking (today + 3).
    await bookOnce('Paid booking 2', booking.paid2, true);
    // Steps 14-17: second pending booking (today + 4).
    await bookOnce('Pending booking 2', booking.pending2, false);
  });
});
