import { byLabel, scrollTo, xpathString } from '@helpers/mobile-elements';
import { toAmount } from '@pages/traveler/mobile-payment-dialog';

/** One row of the Referral History table. Amounts are whole dollars in the app, e.g. "$72". */
export interface MobileReferralHistoryRow {
  referralPercent: string;
  totalEarned: number;
  withdrawable: number;
  status: string;
  canWithdraw: boolean;
}

/**
 * "Referral Program" screen (left menu > Referral Program). Its Referral History table scrolls
 * sideways: Localite, Referral %, Total Earned, Withdrawable (+ Withdraw button), Status. Flutter
 * only exposes the cells on screen, so the table is read in two parts.
 */
export class MobileReferralPage {
  get heading() {
    return browser.$('//android.view.View[@content-desc="Referral Program"]');
  }

  referralCode(code: string) {
    return byLabel(code);
  }

  get historyHeading() {
    return byLabel('Referral History');
  }

  /** First cell of the referee's row: "<initial>\n<name>". */
  nameCell(refereeName: string) {
    return browser.$(`//*[contains(@content-desc, ${xpathString(`\n${refereeName}`)})]`);
  }

  get withdrawButton() {
    return browser.$('//android.widget.Button[@content-desc="Withdraw"]');
  }

  /** Status badge of the row (shown after scrolling the table sideways). */
  get statusCell() {
    return browser.$('//*[@content-desc="Active" or @content-desc="Inactive" or @content-desc="Pending"]');
  }

  /** "Withdraw Payment" dialog: one label with "Name\n...\nAmount\n$<amount>". */
  get withdrawDialog() {
    return browser.$('//*[starts-with(@content-desc, "Withdraw Payment")]');
  }

  get submitButton() {
    return browser.$('//android.widget.Button[@content-desc="Submit"]');
  }

  async waitForLoaded(referralCode: string): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await expect(this.referralCode(referralCode)).toBeDisplayed();
  }

  /** Read the referee's row: the first columns, then (scrolled sideways) the status and Withdraw. */
  async readHistoryRow(refereeName: string): Promise<MobileReferralHistoryRow> {
    await scrollTo(this.historyHeading, 'down', 6);
    await scrollTo(this.nameCell(refereeName), 'down', 6);
    // Appium searches from an element only look inside it, so find the neighbours from the root.
    const cell = (index: number) => browser.$(
      `//*[contains(@content-desc, ${xpathString(`\n${refereeName}`)})]/following-sibling::*[${index}]`,
    );
    const referralPercent = (await cell(1).getAttribute('content-desc')) ?? '';
    const totalEarned = toAmount((await cell(2).getAttribute('content-desc')) ?? '');
    const withdrawable = toAmount((await cell(3).getAttribute('content-desc')) ?? '');

    await this.scrollTable('left');
    const status = (await this.statusCell.getAttribute('content-desc').catch(() => '')) ?? '';
    const canWithdraw = await this.withdrawButton.isDisplayed().catch(() => false);
    await this.scrollTable('right');
    return { referralPercent, totalEarned, withdrawable, status, canWithdraw };
  }

  /**
   * Withdraw: open the dialog, read its amount, and Submit. Returns the dialog amount and any
   * message the app shows after Submit (e.g. a request already pending). The table is left
   * scrolled back to its first columns.
   */
  async withdraw(refereeName: string): Promise<{ amount: number; message: string }> {
    await scrollTo(this.nameCell(refereeName), 'down', 6);
    await this.scrollTable('left');
    await this.withdrawButton.click();
    await this.withdrawDialog.waitForDisplayed({ timeout: 30_000 });
    const label = (await this.withdrawDialog.getAttribute('content-desc')) ?? '';
    const amount = toAmount(/Amount\n([^\n]+)/.exec(label)?.[1] ?? '');
    const labelsBefore = new Set(await this.screenLabels());
    await this.submitButton.click();
    // Collect any new message (snackbar/toast) for a few seconds after Submit.
    let message = '';
    await browser.waitUntil(async () => {
      message = (await this.screenLabels()).find((label) => !labelsBefore.has(label)
        && /withdraw|request|pending|success|fail|error|insufficient/i.test(label)) ?? message;
      return message !== '';
    }, { timeout: 10_000, interval: 1_000 }).catch(() => {});
    await this.submitButton.waitForDisplayed({ reverse: true, timeout: 60_000 }).catch(() => {});
    if (await this.withdrawDialog.isDisplayed().catch(() => false)) {
      await browser.back();
    }
    // The page reloads after Submit and the table jumps back to its first columns.
    await browser.pause(2_000);
    return { amount, message };
  }

  /** All labels currently exposed on screen. */
  private async screenLabels(): Promise<string[]> {
    const source = await browser.getPageSource();
    return [...source.matchAll(/content-desc="([^"]+)"/g)].map((match) => match[1]);
  }

  /** Swipe the Referral History table sideways ('left' shows the right-hand columns). */
  private async scrollTable(direction: 'left' | 'right'): Promise<void> {
    // The "Referral History" heading stays put while the table scrolls; the row is about 480px
    // below it (the column headers in between change as the table scrolls).
    await this.historyHeading.waitForDisplayed({ timeout: 30_000 });
    const { y, height } = await this.historyHeading.getElementRect(await this.historyHeading.elementId);
    const { width } = await browser.getWindowSize();
    const row = Math.round(y + height + 480);
    const [from, to] = direction === 'left' ? [width * 0.82, width * 0.15] : [width * 0.15, width * 0.82];
    await browser
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(from), y: row })
      .down()
      .pause(100)
      .move({ duration: 700, x: Math.round(to), y: row })
      .pause(300)
      .up()
      .perform();
    await browser.pause(1_000);
  }
}
