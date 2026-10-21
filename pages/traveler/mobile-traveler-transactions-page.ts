import { byLabel, byLabelContaining, byLabelStart, scrollTo, xpathString } from '@helpers/mobile-elements';
import { toAmount } from '@pages/traveler/mobile-payment-dialog';

/**
 * Traveler "Transaction History" (left menu > Profile > Transactions History). Each payment row's
 * label lists the localite, "Booking id: <id>", the payment id, date, and "$ <amount>".
 */
export class MobileTravelerTransactionsPage {
  /** Tile on the traveler Profile screen. */
  get transactionsTile() {
    return byLabel('Transactions History');
  }

  get heading() {
    return byLabel('Transaction History');
  }

  row(bookingId: string) {
    return byLabelContaining(`Booking id: ${bookingId}\n`);
  }

  /** "View" button inside the payment row. */
  viewButton(bookingId: string) {
    return browser.$(`//*[contains(@content-desc, ${xpathString(`Booking id: ${bookingId}\n`)})]//*[@content-desc="View"]`);
  }

  async open(): Promise<void> {
    await this.transactionsTile.click();
    await this.heading.waitForDisplayed({ timeout: 60_000 });
  }

  /** Scroll to the payment of the booking and return its amount (e.g. 183.6). */
  async amount(bookingId: string): Promise<number> {
    await this.row(bookingId).waitForExist({ timeout: 60_000 }).catch(() => {});
    await scrollTo(this.row(bookingId), 'down', 10);
    const label = (await this.row(bookingId).getAttribute('content-desc')) ?? '';
    return toAmount(/\$\s*([\d,.]+)/.exec(label)?.[1] ?? '');
  }

  /** View the payment: it shows "Payment: $<amount>" and "Completed"; close it with Back. */
  async verifyPaymentView(bookingId: string, amount: number): Promise<void> {
    await this.viewButton(bookingId).click();
    const payment = byLabelStart('Payment: ');
    await payment.waitForDisplayed({ timeout: 30_000 });
    await expect(payment).toHaveAttribute('content-desc', expect.stringContaining(`$${amount.toFixed(2)}`));
    await expect(payment).toHaveAttribute('content-desc', expect.stringContaining('Completed'));
    await browser.back();
    await payment.waitForDisplayed({ reverse: true, timeout: 10_000 });
  }
}
