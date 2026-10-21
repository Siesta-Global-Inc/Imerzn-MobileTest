import { byLabel, centerOnScreen, screenLabels, scrollTo, xpathString } from '@helpers/mobile-elements';
import { toAmount } from '@pages/traveler/mobile-payment-dialog';

/** Column headers of the Referral History table. */
const historyColumns = ['Localite', 'Referral %', 'Total Earned', 'Withdrawable', 'Status'];

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

  /**
   * Read the referee's row: the columns on screen, then (scrolled sideways) the rest. Each cell is
   * matched to its column by the header above it, since how many columns fit depends on the
   * screen width (on CI's narrower screen Withdrawable is off screen at first).
   */
  async readHistoryRow(refereeName: string): Promise<MobileReferralHistoryRow> {
    await scrollTo(this.historyHeading, 'down', 6);
    await scrollTo(this.nameCell(refereeName), 'down', 6);
    // Keep the row away from the bottom edge, where its cells can be cut off.
    await centerOnScreen(this.nameCell(refereeName));
    const { y, height } = await this.nameCell(refereeName).getElementRect(await this.nameCell(refereeName).elementId);
    const row = { top: y, bottom: y + height };

    const cells = await this.rowCells(row);
    await this.scrollTable('left', row);
    Object.assign(cells, { ...(await this.rowCells(row)), ...cells });
    const canWithdraw = await this.withdrawButton.isDisplayed().catch(() => false);
    await this.scrollTable('right', row);
    return {
      referralPercent: cells['Referral %'] ?? '',
      totalEarned: toAmount(cells['Total Earned'] ?? ''),
      withdrawable: toAmount(cells.Withdrawable ?? ''),
      status: cells.Status ?? '',
      canWithdraw,
    };
  }

  /**
   * Cells of the row between the given heights that are on screen, by column name: each label in
   * the row goes to the column header whose left and right edges are around it.
   */
  private async rowCells(row: { top: number; bottom: number }): Promise<Record<string, string>> {
    const nodes = [...(await browser.getPageSource()).matchAll(
      /content-desc="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g,
    )].map(([, label, x1, y1, x2, y2]) => ({
      label: label.replace(/&#10;/g, '\n').replace(/&amp;/g, '&'),
      left: Number(x1), right: Number(x2), middleY: (Number(y1) + Number(y2)) / 2,
    }));
    const headers = nodes.filter((node) => historyColumns.includes(node.label));
    const cells: Record<string, string> = {};
    for (const node of nodes) {
      if (node.middleY < row.top || node.middleY > row.bottom || node.label === 'Withdraw') {
        continue;
      }
      const middleX = (node.left + node.right) / 2;
      const header = headers.find((h) => middleX >= h.left - 20 && middleX <= h.right + 20);
      if (header && !(header.label in cells)) {
        cells[header.label] = node.label;
      }
    }
    return cells;
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
    const labelsBefore = new Set(await screenLabels());
    await this.submitButton.click();
    // Collect any new message (snackbar/toast) for a few seconds after Submit.
    let message = '';
    await browser.waitUntil(async () => {
      message = (await screenLabels()).find((label) => !labelsBefore.has(label)
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


  /**
   * Swipe the Referral History table sideways ('left' shows the right-hand columns), along the
   * given row or, without one, about 480px below the "Referral History" heading (the heading
   * stays put while the table scrolls).
   */
  private async scrollTable(direction: 'left' | 'right', rowBounds?: { top: number; bottom: number }): Promise<void> {
    await this.historyHeading.waitForDisplayed({ timeout: 30_000 });
    const { y, height } = await this.historyHeading.getElementRect(await this.historyHeading.elementId);
    const { width } = await browser.getWindowSize();
    const row = Math.round(rowBounds ? (rowBounds.top + rowBounds.bottom) / 2 : y + height + 480);
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
