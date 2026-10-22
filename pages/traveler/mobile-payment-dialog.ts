import type { MobilePaymentDetails } from '@data/traveler/mobile-booking-data';
import { byLabel, byLabelStart, fillField, inputByHint, xpathString } from '@helpers/mobile-elements';

/** Prices shown at the top of the Payment dialog. */
export interface MobilePaymentPrices {
  people: number;
  amount: number;
  subTotal: number;
  salesTaxPercent: number;
  salesTax: number;
  platformFeePercent: number;
  platformFee: number;
  totalAmountDue: number;
}

/** "Payment" dialog shown after Book on the Book Experience sheet. */
export class MobilePaymentDialog {
  get heading() {
    return byLabel('Payment');
  }

  get cardNumberInput() {
    return browser.$('//*[@resource-id="com.app.siestaglobal:id/card_number_edit_text"]');
  }

  get expiryInput() {
    return browser.$('//*[@resource-id="com.app.siestaglobal:id/expiry_date_edit_text"]');
  }

  get cvcInput() {
    return browser.$('//*[@resource-id="com.app.siestaglobal:id/cvc_edit_text"]');
  }

  get nameInput() {
    return inputByHint('Name');
  }

  get addressInput() {
    return inputByHint('Address');
  }

  get postalCodeInput() {
    return inputByHint('Postal Code');
  }

  /** Country, State, and City fields (views whose hint is the field name; text is the picked value). */
  pickerField(name: 'Country' | 'State' | 'City') {
    return browser.$(`//*[@hint=${xpathString(name)}]`);
  }

  /** Empty search box of a just-opened Country/State/City list ("Search country...", ...). */
  get pickerSearchPlaceholder() {
    return browser.$('//android.widget.EditText[starts-with(@hint, "Search")]');
  }

  /** While a list is open its search box is the only text field (its hint clears once typed in). */
  get pickerSearchInput() {
    return browser.$('(//android.widget.EditText)[1]');
  }

  pickerOption(value: string) {
    return browser.$(`//android.widget.Button[@content-desc=${xpathString(value)}]`);
  }

  get payButton() {
    return browser.$('//android.widget.Button[@content-desc="Pay"]');
  }

  get cancelButton() {
    return browser.$('//android.widget.Button[@content-desc="Cancel"]');
  }

  /** Message shown after a successful payment. */
  get paymentSuccessfulMessage() {
    return byLabel('Payment Successful');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 120_000 });
    await byLabel('Total Amount Due').waitForDisplayed({ timeout: 60_000 });
  }

  /** Read the price lines: each value is the view right after its label. */
  async readPrices(): Promise<MobilePaymentPrices> {
    const label = async (start: string) => (await byLabelStart(start).getAttribute('content-desc')) ?? '';
    const value = async (start: string) => toAmount(
      (await browser.$(`//*[starts-with(@content-desc, ${xpathString(start)})]/following-sibling::*[1]`)
        .getAttribute('content-desc')) ?? '',
    );
    const percent = (text: string) => Number(/\(([\d.]+)%\)/.exec(text)?.[1] ?? NaN);

    const amountLabel = await label('Amount');
    return {
      people: Number(/\((\d+) people?\)/.exec(amountLabel)?.[1] ?? NaN),
      amount: await value('Amount'),
      subTotal: await value('Sub Total'),
      salesTaxPercent: percent(await label('Sales Tax')),
      salesTax: await value('Sales Tax'),
      platformFeePercent: percent(await label('Platform Fee')),
      platformFee: await value('Platform Fee'),
      totalAmountDue: await value('Total Amount Due'),
    };
  }

  /** Type the card number, expiry (digits only), and CVC into the card field. */
  async fillCard(details: MobilePaymentDetails): Promise<void> {
    await this.cardNumberInput.click();
    await this.cardNumberInput.setValue(details.cardNumber);
    await this.expiryInput.setValue(details.cardExpiry.replace(/\D/g, ''));
    await this.cvcInput.waitForDisplayed({ timeout: 10_000 });
    await this.cvcInput.setValue(details.cardCvv);
    await expect(this.cvcInput).toHaveText(expect.stringContaining(details.cardCvv));
  }

  /** Fill the billing address: Name, Address, then Country, State, City from their lists, and Postal Code. */
  async fillBilling(details: MobilePaymentDetails): Promise<void> {
    // On a shorter screen the lower fields are below the dialog's edge (CI's screen ends at City).
    await this.swipeDialogTo(this.nameInput);
    await fillField(this.nameInput, details.billingName);
    await this.swipeDialogTo(this.addressInput);
    await fillField(this.addressInput, details.billingAddress);
    await this.pickFromList('Country', details.billingCountry);
    await this.pickFromList('State', details.billingState);
    await this.pickFromList('City', details.billingCity);
    await this.swipeDialogTo(this.postalCodeInput);
    await fillField(this.postalCodeInput, details.billingZip);
  }

  /** Tap Pay and wait for "Payment Successful" (the app then goes back to Experiences). */
  async payAndVerify(): Promise<void> {
    await this.swipeDialogTo(this.payButton);
    await this.payButton.click();
    await this.paymentSuccessfulMessage.waitForDisplayed({ timeout: 120_000 });
  }

  /** Tap Cancel (at the bottom of the dialog): the booking is kept but stays unpaid. */
  async cancel(): Promise<void> {
    await this.swipeDialogTo(this.cancelButton);
    await this.cancelButton.click();
    await this.heading.waitForDisplayed({ reverse: true, timeout: 60_000 });
  }

  /** Swipe up in the middle of the dialog until the element is on screen. */
  private async swipeDialogTo(element: ReturnType<typeof browser.$>): Promise<void> {
    const { width, height } = await browser.getWindowSize();
    for (let swipe = 0; swipe < 5 && !(await element.isDisplayed().catch(() => false)); swipe += 1) {
      await browser
        .action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x: Math.round(width / 2), y: Math.round(height * 0.75) })
        .down()
        .pause(100)
        .move({ duration: 800, x: Math.round(width / 2), y: Math.round(height * 0.35) })
        .pause(400)
        .up()
        .perform();
      await browser.pause(1_000);
    }
    await element.waitForDisplayed({ timeout: 10_000 });
  }

  /** Open a Country/State/City list, search the value, and pick it. */
  private async pickFromList(name: 'Country' | 'State' | 'City', value: string): Promise<void> {
    await this.swipeDialogTo(this.pickerField(name));
    await this.pickerField(name).click();
    await this.pickerSearchPlaceholder.waitForDisplayed({ timeout: 30_000 });
    await fillField(this.pickerSearchInput, value);
    await this.pickerOption(value).waitForDisplayed({ timeout: 30_000 });
    await this.pickerOption(value).click();
    await expect(this.pickerField(name)).toHaveText(value);
  }
}

/** "$1,234.50" -> 1234.5 */
export function toAmount(text: string): number {
  return Number(text.replace(/[^\d.]/g, ''));
}

/** Round to cents, to compare money without floating-point noise. */
export function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}
