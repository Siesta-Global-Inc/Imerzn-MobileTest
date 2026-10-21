import { loginAsLocalite, loginAsTraveler } from '@pages/auth/mobile-session';
import { MobileLocaliteBookingsPage } from '@pages/localite/mobile-localite-bookings-page';
import { MobileTravelerBookingsPage } from '@pages/traveler/mobile-traveler-bookings-page';
import { readMobileBookingData } from '@data/traveler/mobile-booking-data';
import { readMobileCreatedBookings } from '@data/state/mobile-created-bookings';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';

/*
 * Mobile booking flow step 5 of 5: the localite cancels the first paid (On Going) and the first
 * pending booking from step 1 (step 4 cancels the last ones); the traveler then sees both cancelled.
 */
describe('mobile-flow-localite-cancel', () => {
  it('mobile LCN-001 | Localite cancels an On Going and a pending booking; the traveler sees them cancelled', async function () {
    this.timeout(1_200_000);

    // Pre-setup: the saved bookings and the localite's cancel reason.
    const localite = await readMobileCreatedLocalite();
    const traveler = await readMobileCreatedTraveler();
    const { paid, pending } = await readMobileCreatedBookings();
    const { localiteCancelReason } = await readMobileBookingData();
    const ongoingBooking = paid[0];
    const pendingBooking = pending[0];
    console.info(`[DATA] Localite email: ${localite.email}`);
    console.info(`[DATA] Cancel: ${ongoingBooking.bookingId} (On Going), ${pendingBooking.bookingId} (pending)`);

    const bookingsPage = new MobileLocaliteBookingsPage();
    const travelerBookingsPage = new MobileTravelerBookingsPage();
    const cancelled = /^Cancell?ed$/i;

    // Step 1: Log in as the localite and open Bookings.
    await step('Log in as localite and open Bookings', async () => {
      await loginAsLocalite(localite);
      await bookingsPage.open();
    });

    // Step 2: Cancel Booking on the On Going booking (skipped if a previous run already cancelled it).
    await step('Cancel the On Going booking', async () => {
      if (cancelled.test((await bookingsPage.travelerAndStatusOf(ongoingBooking.bookingId)).status)) {
        console.info(`[INFO] Booking ${ongoingBooking.bookingId} was already cancelled.`);
        return;
      }
      await bookingsPage.cancel(ongoingBooking.bookingId, localiteCancelReason);
      await bookingsPage.expectStatus(ongoingBooking.bookingId, cancelled);
    });

    // Step 3: Cancel the pending booking too.
    await step('Cancel the pending booking', async () => {
      if (cancelled.test((await bookingsPage.travelerAndStatusOf(pendingBooking.bookingId)).status)) {
        console.info(`[INFO] Booking ${pendingBooking.bookingId} was already cancelled.`);
        return;
      }
      await bookingsPage.cancel(pendingBooking.bookingId, localiteCancelReason);
      await bookingsPage.expectStatus(pendingBooking.bookingId, cancelled);
    });

    // Step 4: Log in as the traveler: both bookings show as cancelled.
    await step('Verify both bookings are cancelled for the traveler', async () => {
      await loginAsTraveler(traveler);
      await travelerBookingsPage.open();
      await travelerBookingsPage.expectStatus(ongoingBooking.bookingId, cancelled);
      await travelerBookingsPage.expectStatus(pendingBooking.bookingId, cancelled);
    });
  });
});
