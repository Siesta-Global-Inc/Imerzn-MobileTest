import { loginAsLocalite, loginAsTraveler } from '@pages/auth/mobile-session';
import { MobileLocaliteBookingsPage } from '@pages/localite/mobile-localite-bookings-page';
import { MobileTravelerBookingsPage } from '@pages/traveler/mobile-traveler-bookings-page';
import { readMobileBookingData } from '@data/traveler/mobile-booking-data';
import { readMobileCreatedBookings } from '@data/state/mobile-created-bookings';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';

/*
 * Mobile booking flow step 4 of 5: the traveler cancels the last paid (On Going) and the last
 * pending booking from step 1; the localite then sees both as cancelled.
 */
describe('mobile-flow-traveler-cancel', () => {
  it('mobile CNL-001 | Traveler cancels an On Going and a pending booking; the localite sees them cancelled', async function () {
    this.timeout(1_200_000);

    // Pre-setup: the saved bookings and the cancel reason.
    const traveler = await readMobileCreatedTraveler();
    const localite = await readMobileCreatedLocalite();
    const { paid, pending } = await readMobileCreatedBookings();
    const { cancelReason } = await readMobileBookingData();
    const ongoingBooking = paid[paid.length - 1];
    const pendingBooking = pending[pending.length - 1];
    console.info(`[DATA] Traveler email: ${traveler.email}`);
    console.info(`[DATA] Cancel: ${ongoingBooking.bookingId} (On Going), ${pendingBooking.bookingId} (pending)`);

    const bookingsPage = new MobileTravelerBookingsPage();
    const localiteBookingsPage = new MobileLocaliteBookingsPage();
    // The app's word for a cancelled booking (accept "Cancelled" or "Canceled").
    const cancelled = /^Cancell?ed$/i;

    // Step 1: Log in as the traveler and open Bookings.
    await step('Log in as traveler and open Bookings', async () => {
      await loginAsTraveler(traveler);
      await bookingsPage.open();
    });

    // Step 2: Cancel Trip on the On Going booking (skipped if a previous run already cancelled it).
    await step('Cancel the On Going booking', async () => {
      if (cancelled.test(await bookingsPage.status(ongoingBooking.bookingId))) {
        console.info(`[INFO] Booking ${ongoingBooking.bookingId} was already cancelled.`);
        return;
      }
      await bookingsPage.cancel(ongoingBooking.bookingId, cancelReason);
      await bookingsPage.expectStatus(ongoingBooking.bookingId, cancelled);
    });

    // Step 3: Cancel the pending booking too.
    await step('Cancel the pending booking', async () => {
      if (cancelled.test(await bookingsPage.status(pendingBooking.bookingId))) {
        console.info(`[INFO] Booking ${pendingBooking.bookingId} was already cancelled.`);
        return;
      }
      await bookingsPage.cancel(pendingBooking.bookingId, cancelReason);
      await bookingsPage.expectStatus(pendingBooking.bookingId, cancelled);
    });

    // Step 4: Log in as the localite: both bookings show as cancelled.
    await step('Verify both bookings are cancelled for the localite', async () => {
      await loginAsLocalite(localite);
      await localiteBookingsPage.open();
      await localiteBookingsPage.expectStatus(ongoingBooking.bookingId, cancelled);
      await localiteBookingsPage.expectStatus(pendingBooking.bookingId, cancelled);
    });
  });
});
