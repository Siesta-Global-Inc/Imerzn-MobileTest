import { loginAsTraveler } from '@pages/auth/mobile-session';
import { MobileTravelerBookingsPage } from '@pages/traveler/mobile-traveler-bookings-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { MobileTravelerProfilePage } from '@pages/traveler/mobile-traveler-profile-page';
import { MobileTravelerTransactionsPage } from '@pages/traveler/mobile-traveler-transactions-page';
import { readMobileCreatedBookings } from '@data/state/mobile-created-bookings';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';

/*
 * Mobile booking flow step 2 of 5: the traveler's Bookings and Transaction History show the
 * bookings made in step 1. (The app has no traveler dashboard with Total Trips, unlike the web.)
 */
describe('mobile-flow-traveler-bookings', () => {
  it('mobile DSH-002 | Bookings and Transaction History show the paid and pending bookings', async function () {
    this.timeout(1_200_000);

    // Pre-setup: the bookings made by mobile BKG-001.
    const traveler = await readMobileCreatedTraveler();
    const { paid, pending } = await readMobileCreatedBookings();
    console.info(`[DATA] Traveler email: ${traveler.email}`);
    console.info(`[DATA] Paid: ${paid.map((b) => b.bookingId).join(', ')}; pending: ${pending.map((b) => b.bookingId).join(', ')}`);

    const homePage = new MobileTravelerHomePage();
    const bookingsPage = new MobileTravelerBookingsPage();
    const profilePage = new MobileTravelerProfilePage();
    const transactionsPage = new MobileTravelerTransactionsPage();

    // Step 1: Log in as the traveler.
    await step('Log in as traveler', async () => {
      await loginAsTraveler(traveler);
    });

    // Step 2: Bookings: paid bookings are "On Going" with Cancel Trip; unpaid ones are pending.
    await step('Verify all bookings in Bookings', async () => {
      await bookingsPage.open();
      for (const booking of paid) {
        await bookingsPage.expectStatus(booking.bookingId, /^On Going$/);
        await expect(bookingsPage.cancelTripButton(booking.bookingId)).toBeDisplayed();
      }
      for (const booking of pending) {
        await bookingsPage.expectStatus(booking.bookingId, /pending/i);
      }
    });

    // Step 3: The first paid booking's Details show the experience, people, date, time, and note.
    await step('Verify the On Going booking Details', async () => {
      await bookingsPage.verifyDetails(paid[0]);
    });

    // Step 4: Transaction History (left menu > Profile) lists each paid booking.
    const amounts: number[] = [];
    await step('Verify the transactions', async () => {
      await homePage.openMenuItem('Profile');
      await profilePage.waitForLoaded();
      await transactionsPage.open();
      for (const booking of paid) {
        amounts.push(await transactionsPage.amount(booking.bookingId));
      }
      console.info(`[DATA] Transaction amounts: ${amounts.join(', ')}`);
    });

    // Step 5: View shows each payment as Completed with the listed amount.
    await step('Verify the payments in View', async () => {
      for (const [index, booking] of paid.entries()) {
        await transactionsPage.verifyPaymentView(booking.bookingId, amounts[index]);
      }
    });

    // Step 6: The amount charged equals the Total Amount Due shown in the Payment dialog.
    // Known difference (2026-10-21): the dialog adds a 2.15% Platform Fee but the payment uses 2%.
    await step('Verify the charged amounts match the Payment dialog', async () => {
      for (const [index, booking] of paid.entries()) {
        if (amounts[index] !== booking.totalAmountDue) {
          throw new Error(
            `Booking ${booking.bookingId}: charged $${amounts[index].toFixed(2)}, but the Payment dialog ` +
            `showed Total Amount Due $${booking.totalAmountDue?.toFixed(2)}.`,
          );
        }
      }
    });
  });
});
