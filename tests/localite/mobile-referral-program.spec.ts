import { loginAsLocalite, loginAsTraveler } from '@pages/auth/mobile-session';
import { MobileLeftMenu } from '@pages/localite/mobile-left-menu';
import { MobileLocaliteBookingsPage } from '@pages/localite/mobile-localite-bookings-page';
import { MobileLocaliteTransactionsPage } from '@pages/localite/mobile-localite-transactions-page';
import { type MobileReferralHistoryRow, MobileReferralPage } from '@pages/localite/mobile-referral-page';
import { MobileBookingSheet } from '@pages/traveler/mobile-booking-sheet';
import { MobilePaymentDialog, toCents } from '@pages/traveler/mobile-payment-dialog';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { readMobileReferralData } from '@data/localite/mobile-referral-data';
import { readMobileBookingData } from '@data/traveler/mobile-booking-data';
import { step } from '@helpers/mobile-step';

/*
 * Uses the fixed referral-program accounts in testdata/localite/Referral-program.csv (same as the
 * web REF-001): the referrer, the referee who signed up with the referrer's code, and the traveler.
 * The referee completes a paid On Going booking, the referrer earns Referral % of its commission and
 * withdraws it, and at the end the traveler books and pays again, which the next run completes.
 * It changes that data on dev and makes a real (test card) payment.
 */
describe('mobile-referral-program', () => {
  it('mobile REF-001 | Referral program: referrer earns Referral % of the commission and withdraws it', async function () {
    // Three logins, a payment, and a slow emulator.
    this.timeout(2_400_000);

    // Pre-setup: the referral accounts, and the card and billing address of booking.csv.
    const referral = await readMobileReferralData();
    const { payment } = await readMobileBookingData();
    const referrer = { email: referral.referrerEmail, password: referral.password };
    const referee = { email: referral.referee.email, password: referral.password };
    const traveler = { email: referral.traveler.email, password: referral.password };
    console.info(`[DATA] Referrer: ${referrer.email}, referee: ${referee.email}, traveler: ${traveler.email}`);

    const leftMenu = new MobileLeftMenu();
    const referralPage = new MobileReferralPage();
    const bookingsPage = new MobileLocaliteBookingsPage();
    const transactionsPage = new MobileLocaliteTransactionsPage();
    const homePage = new MobileTravelerHomePage();
    const bookingSheet = new MobileBookingSheet();
    const paymentDialog = new MobilePaymentDialog();

    // Some failures (no booking to complete, withdraw checks) are collected and reported at the end, so the booking steps
    // still run and the next run has a booking to complete (like the web test's soft checks).
    const softFailures: string[] = [];
    const report = (label: string, row: MobileReferralHistoryRow) => console.info(
      `[DATA] ${label}: Referral % ${row.referralPercent}, Total Earned $${row.totalEarned}, ` +
      `Withdrawable $${row.withdrawable}, Status ${row.status}, Withdraw button ${row.canWithdraw ? 'shown' : 'not shown'}`,
    );
    const openReferralAsReferrer = async (): Promise<void> => {
      await loginAsLocalite(referrer);
      await leftMenu.tap('Referral Program');
      await referralPage.waitForLoaded(referral.referralCode);
    };

    // Step 1: Referrer opens Referral Program and records the Referral History row.
    let before: MobileReferralHistoryRow | undefined;
    await step('Referrer: check Referral History', async () => {
      await openReferralAsReferrer();
      before = await referralPage.readHistoryRow(referral.referee.name);
      report('Referral History before', before);
      expect(before.referralPercent).toBe(referral.referralPercent);
      expect(before.status).toBe(referral.referralStatus);
    });

    // Step 2: Referee finds a paid On Going booking that shows "Complete Booking" (its start time
    // has passed) and records its Commission from Transactions > View.
    let bookingId = '';
    let commission = 0;
    await step('Referee: check a completable booking in Transactions', async () => {
      await loginAsLocalite(referee);
      await bookingsPage.open();
      bookingId = await bookingsPage.firstCompletableBookingId();
      if (!bookingId) {
        // Keep going to the traveler steps, so this run still books the slot the next run completes.
        softFailures.push(
          'No paid On Going booking could be completed yet ("Complete Booking" appears only after the ' +
          'booking\'s start time), so the referral steps were skipped. This run booked and paid the next one.',
        );
        return;
      }
      console.info(`[DATA] Booking to complete: ${bookingId}`);

      await transactionsPage.open();
      const paid = await transactionsPage.payment(bookingId);
      expect(paid.traveler).toBe(referral.traveler.name);
      const earnings = await transactionsPage.viewEarnings(bookingId);
      expect(earnings.amount).toBe(toCents(earnings.people * referral.experience.price));
      expect(earnings.commission).toBe(toCents((earnings.commissionPercent / 100) * earnings.subTotal));
      expect(earnings.localiteEarnings).toBe(toCents(earnings.subTotal - earnings.commission));
      commission = earnings.commission;
      console.info(`[DATA] Booking ${bookingId}: Commission (${earnings.commissionPercent}%) $${commission.toFixed(2)}`);
    });

    // Step 3: Referee completes the booking (Complete Booking has no confirmation).
    await step('Referee: complete the booking', async () => {
      if (!bookingId) return;
      await bookingsPage.open();
      await bookingsPage.complete(bookingId);
    });

    // Step 4: Referrer earns Referral % of the commission. The app shows whole dollars, so the
    // expected values are compared to the nearest dollar.
    let withdrawable = 0;
    await step('Referrer: verify the new Withdrawable and Total Earned', async () => {
      if (!bookingId) return;
      if (!before) throw new Error('Step 1 did not record the Referral History row.');
      await openReferralAsReferrer();
      const earned = toCents((Number(before.referralPercent.replace('%', '')) / 100) * commission);
      const after = await referralPage.readHistoryRow(referral.referee.name);
      report('Referral History after', after);
      console.info(`[DATA] Earned: ${before.referralPercent} x $${commission.toFixed(2)} = $${earned.toFixed(2)}`);
      expect(Math.abs(after.withdrawable - (before.withdrawable + earned))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.totalEarned - (before.totalEarned + earned))).toBeLessThanOrEqual(0.5);
      withdrawable = after.withdrawable;
    });

    // Step 5: Withdraw everything. If a withdrawal request is already pending, the app refuses it
    // ("You already have a pending withdrawal request for this referral") and nothing changes;
    // otherwise Withdrawable becomes $0 and the Withdraw button disappears.
    await step('Referrer: withdraw the earnings', async () => {
      if (!bookingId) return;
      const { amount, message } = await referralPage.withdraw(referral.referee.name);
      console.info(`[DATA] Withdraw dialog amount: $${amount}; message after Submit: ${message || '(none)'}`);
      if (amount !== withdrawable) {
        softFailures.push(`Withdraw dialog showed $${amount}, but Withdrawable was $${withdrawable}.`);
      }
      const alreadyPending = /pending withdrawal request/i.test(message);
      const afterWithdraw = await referralPage.readHistoryRow(referral.referee.name);
      report('Referral History after withdraw', afterWithdraw);
      if (alreadyPending) {
        console.info(`[INFO] Withdraw refused: a request is already pending ($${amount} not withdrawn).`);
        if (afterWithdraw.withdrawable !== withdrawable) {
          softFailures.push(`Withdrawable changed to $${afterWithdraw.withdrawable} although the request was refused (was $${withdrawable}).`);
        }
        if (!afterWithdraw.canWithdraw) {
          softFailures.push('The Withdraw button disappeared although the request was refused.');
        }
        return;
      }
      if (afterWithdraw.withdrawable !== 0) {
        softFailures.push(`Withdrawable is $${afterWithdraw.withdrawable} after Submit (expected $0)` +
          `${message ? `; the app said: "${message}"` : ''}.`);
      }
      if (afterWithdraw.canWithdraw) {
        softFailures.push('The Withdraw button is still shown after Submit.');
      }
    });

    // Step 6: Traveler opens the referee's experience (this booking is completed by the next run).
    await step(`Traveler: open "${referral.experience.title}"`, async () => {
      await loginAsTraveler(traveler);
      await homePage.experiencesTab.click();
      await bookingSheet.openExperience(referral.experience.title, 40);
    });

    // Step 7: Book for today; if today has no start time left, book tomorrow.
    await step('Traveler: book the experience', async () => {
      await bookingSheet.open();
      const today = new Date();
      await bookingSheet.selectDate(today);
      let date = today;
      if (!(await bookingSheet.hasStartTimes())) {
        date = new Date(today);
        date.setDate(today.getDate() + 1);
        await bookingSheet.selectDate(date);
      }
      const startTime = await bookingSheet.selectFirstStartTime();
      await bookingSheet.fillGroupSizeAndNote(referral.booking.groupSize, referral.booking.note);
      console.info(`[DATA] Booked: ${date.toDateString()} ${startTime}, ${referral.booking.groupSize} people`);
      await bookingSheet.book();
    });

    // Step 8: Pay for the booking.
    await step('Traveler: pay for the booking', async () => {
      await paymentDialog.waitForLoaded();
      await paymentDialog.fillCard(payment);
      await paymentDialog.fillBilling(payment);
      await paymentDialog.payAndVerify();
    });

    if (softFailures.length > 0) {
      throw new Error(`Withdraw checks failed:\n- ${softFailures.join('\n- ')}`);
    }
  });
});
