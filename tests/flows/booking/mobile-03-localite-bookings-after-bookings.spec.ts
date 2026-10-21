import { loginAsLocalite } from '@pages/auth/mobile-session';
import { MobileLocaliteBookingsPage } from '@pages/localite/mobile-localite-bookings-page';
import { MobileLocaliteTransactionsPage } from '@pages/localite/mobile-localite-transactions-page';
import { toCents } from '@pages/traveler/mobile-payment-dialog';
import { readMobileExperienceData } from '@data/localite/mobile-localite-data';
import { readMobileCreatedBookings } from '@data/state/mobile-created-bookings';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';

/*
 * Mobile booking flow step 3 of 5: the localite's view of the traveler's bookings from step 1:
 * Bookings, Transactions, and the earnings breakdown.
 */
describe('mobile-flow-localite-bookings', () => {
  it('mobile LBK-001 | Localite sees the traveler bookings, transactions, and earnings', async function () {
    this.timeout(1_200_000);

    // Pre-setup: the bookings made by mobile BKG-001 for the localite's experience.
    const localite = await readMobileCreatedLocalite();
    const traveler = await readMobileCreatedTraveler();
    const { paid, pending } = await readMobileCreatedBookings();
    const travelerName = `${traveler.firstName} ${traveler.lastName}`;
    const durationHours = Number((await readMobileExperienceData()).duration);
    console.info(`[DATA] Localite email: ${localite.email}`);
    console.info(`[DATA] Traveler: ${travelerName}`);

    const bookingsPage = new MobileLocaliteBookingsPage();
    const transactionsPage = new MobileLocaliteTransactionsPage();

    // Step 1: Log in as the localite.
    await step('Log in as localite', async () => {
      await loginAsLocalite(localite);
    });

    // Step 2: Bookings: paid = "On Going" with Chat and Cancel Booking; unpaid = "Pending" with
    // Cancel Booking. (Unlike the web, the app also shows Chat on pending bookings.)
    await step('Verify all bookings in Bookings', async () => {
      await bookingsPage.open();
      for (const booking of paid) {
        await bookingsPage.expectStatus(booking.bookingId, /^On Going$/);
        expect((await bookingsPage.travelerAndStatusOf(booking.bookingId)).traveler).toBe(travelerName);
        await bookingsPage.verifyCardDetails(booking.bookingId, {
          date: booking.date, startTime: booking.startTime.replace(/^(\d):/, '0$1:'), durationHours,
        });
        await expect(bookingsPage.button(booking.bookingId, 'Chat')).toBeDisplayed();
        await expect(bookingsPage.button(booking.bookingId, 'Cancel Booking')).toBeDisplayed();
      }
      for (const booking of pending) {
        await bookingsPage.expectStatus(booking.bookingId, /pending/i);
        await expect(bookingsPage.button(booking.bookingId, 'Cancel Booking')).toBeDisplayed();
      }
    });

    // Step 3: Transactions lists each paid booking with the traveler's name.
    await step('Verify the transactions', async () => {
      await transactionsPage.open();
      await expect(transactionsPage.walletBalance).toBeDisplayed();
      for (const booking of paid) {
        const payment = await transactionsPage.payment(booking.bookingId);
        expect(payment.traveler).toBe(travelerName);
        console.info(`[DATA] Booking ${booking.bookingId}: $${payment.amount.toFixed(2)}`);
      }
    });

    // Step 4: View: Commission = % x Sub Total, Localite Earnings = Sub Total - Commission,
    // Total = Sub Total + Tax / Fees.
    await step('Verify the earnings in View', async () => {
      for (const booking of paid) {
        const earnings = await transactionsPage.viewEarnings(booking.bookingId);
        expect(earnings.people).toBe(booking.people);
        expect(earnings.subTotal).toBe(toCents(earnings.amount - earnings.credits));
        expect(earnings.total).toBe(toCents(earnings.subTotal + earnings.fee));
        expect(earnings.commission).toBe(toCents((earnings.commissionPercent / 100) * earnings.subTotal));
        expect(earnings.localiteEarnings).toBe(toCents(earnings.subTotal - earnings.commission));
        console.info(
          `[DATA] Booking ${booking.bookingId}: Commission ${earnings.commissionPercent}% = $${earnings.commission.toFixed(2)}, ` +
          `Localite Earnings = $${earnings.localiteEarnings.toFixed(2)}`,
        );
      }
    });
  });
});
