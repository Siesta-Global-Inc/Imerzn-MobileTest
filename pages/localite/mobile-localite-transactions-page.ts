import { byLabelContaining, byLabelStart, openTab, scrollTo, xpathString } from '@helpers/mobile-elements';
import { toAmount } from '@pages/traveler/mobile-payment-dialog';

/** Earnings breakdown shown by View on a localite payment. */
export interface MobileLocaliteEarnings {
  people: number;
  amount: number;
  credits: number;
  subTotal: number;
  feePercent: number;
  fee: number;
  total: number;
  commissionPercent: number;
  commission: number;
  localiteEarnings: number;
}

/**
 * Localite "Transactions" tab ("Transactions History"): the wallet balance, and a row per payment
 * whose label lists the traveler, "Booking id: <id>", the payment id, date, and "$ <amount>".
 */
export class MobileLocaliteTransactionsPage {
  get transactionsTab() {
    return byLabelStart('Transactions\nTab');
  }

  get heading() {
    return browser.$('//android.view.View[@content-desc="Transactions History"]');
  }

  /** Wallet balance button, e.g. "$ 151.20". */
  get walletBalance() {
    return browser.$('(//android.widget.Button[starts-with(@content-desc, "$")])[1]');
  }

  row(bookingId: string) {
    return byLabelContaining(`Booking id: ${bookingId}\n`);
  }

  viewButton(bookingId: string) {
    return browser.$(`//*[contains(@content-desc, ${xpathString(`Booking id: ${bookingId}\n`)})]//*[@content-desc="View"]`);
  }

  async open(): Promise<void> {
    await openTab(this.transactionsTab, this.heading);
  }

  /** Scroll to the payment of the booking; return the traveler name and amount on the row. */
  async payment(bookingId: string): Promise<{ traveler: string; amount: number }> {
    await this.row(bookingId).waitForExist({ timeout: 60_000 }).catch(() => {});
    await scrollTo(this.row(bookingId), 'down', 10);
    const label = (await this.row(bookingId).getAttribute('content-desc')) ?? '';
    return {
      traveler: label.split('\n')[0].trim(),
      amount: toAmount(/\$\s*([\d,.]+)/.exec(label)?.[1] ?? ''),
    };
  }

  /** Open View on the payment, read the breakdown, and close it with Back. */
  async viewEarnings(bookingId: string): Promise<MobileLocaliteEarnings> {
    await this.viewButton(bookingId).click();
    const breakdown = byLabelStart('Amount (x ');
    await breakdown.waitForDisplayed({ timeout: 30_000 });
    const lines = ((await breakdown.getAttribute('content-desc')) ?? '').split('\n').map((line) => line.trim());
    await browser.back();
    await breakdown.waitForDisplayed({ reverse: true, timeout: 10_000 });

    // Lines come in label/value pairs: "Amount (x 4 people)", "$180.00", "Credits", "$0.00", ...
    const valueAfter = (start: string) => toAmount(lines[lines.findIndex((line) => line.startsWith(start)) + 1] ?? '');
    const percentIn = (start: string) => Number(/\(([\d.]+)%/.exec(lines.find((line) => line.startsWith(start)) ?? '')?.[1] ?? NaN);
    return {
      people: Number(/x (\d+) people?/.exec(lines[0])?.[1] ?? NaN),
      amount: valueAfter('Amount'),
      credits: valueAfter('Credits'),
      subTotal: valueAfter('Sub Total'),
      feePercent: percentIn('Tax / Fees'),
      fee: valueAfter('Tax / Fees'),
      total: valueAfter('Total'),
      commissionPercent: percentIn('Commission'),
      commission: valueAfter('Commission'),
      localiteEarnings: valueAfter('Localite Earnings'),
    };
  }
}
