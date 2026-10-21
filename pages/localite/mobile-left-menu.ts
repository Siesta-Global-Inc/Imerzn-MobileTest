import { appPackage } from '@helpers/mobile-app';
import { byLabel, byLabelStart, xpathString } from '@helpers/mobile-elements';

/** Items of the left menu, as labelled in the app. */
export type MobileMenuItem =
  | 'Sync Calendar'
  | 'Experiences'
  | 'Localites'
  | 'Referral Program'
  | 'Premium Placement'
  | 'Affiliate Partner'
  | 'Payouts'
  | 'About Us';

/** Android package of Chrome, where the app opens its web pages. */
const chromePackage = 'com.android.chrome';

/** Left menu, opened with the ☰ button at the top left of the Profile screen. */
export class MobileLeftMenu {
  /**
   * ☰ button: the first button without a label. (Some menu items, e.g. Referral Program, are
   * labelled buttons too, so "the first button" alone can hit a menu item.)
   */
  get menuButton() {
    return browser.$('(//android.widget.Button[not(@content-desc) or @content-desc=""])[1]');
  }

  item(name: MobileMenuItem) {
    return byLabel(name);
  }

  /**
   * Title of a screen or dialog. Titles are plain views, while the menu items with the same
   * label are buttons or images, so this does not match the menu item.
   */
  title(name: string) {
    return browser.$(`//android.view.View[@content-desc=${xpathString(name)}]`);
  }

  /** "Choose Calendar" dialog opened by Sync Calendar. */
  get chooseCalendarDialog() {
    return byLabelStart('Choose Calendar');
  }

  /** Message of the Payouts dialog. */
  get payoutsMessage() {
    return byLabelStart('Please log in through the web browser');
  }

  get okayButton() {
    return byLabel('Okay');
  }

  /** Address bar of Chrome. */
  get chromeAddressBar() {
    return browser.$('//*[@resource-id="com.android.chrome:id/url_bar"]');
  }

  /** Open the menu unless it is already open (Back from a menu screen returns to the open menu). */
  async open(): Promise<void> {
    // After Back the menu may still be sliding in; give it a moment before deciding it is closed.
    if (await this.item('Sync Calendar').waitForDisplayed({ timeout: 5_000 }).then(() => true, () => false)) {
      return;
    }
    await this.menuButton.click();
    await this.item('Sync Calendar').waitForDisplayed({ timeout: 30_000 });
  }

  /** Open the menu and tap one of its items. */
  async tap(name: MobileMenuItem): Promise<void> {
    await this.open();
    await this.item(name).click();
  }

  /** Check that the screen with this title is shown, then go back to the menu. */
  async verifyScreenAndGoBack(name: string): Promise<void> {
    await this.title(name).waitForDisplayed({ timeout: 60_000 });
    await expect(this.title(name)).toBeDisplayed();
    await browser.back();
  }

  /** Check that the "Choose Calendar" dialog is shown, then close it (this also closes the menu). */
  async verifyChooseCalendarDialogAndClose(): Promise<void> {
    await this.chooseCalendarDialog.waitForDisplayed({ timeout: 30_000 });
    await expect(this.chooseCalendarDialog).toBeDisplayed();
    await browser.back();
    await this.chooseCalendarDialog.waitForDisplayed({ reverse: true });
  }

  /** Check that the Payouts dialog is shown, then close it with Okay. */
  async verifyPayoutsDialogAndClose(): Promise<void> {
    await this.title('Payouts').waitForDisplayed({ timeout: 30_000 });
    await expect(this.payoutsMessage).toBeDisplayed();
    await this.okayButton.click();
    await this.okayButton.waitForDisplayed({ reverse: true });
  }

  /**
   * Check that Chrome opened the web page (its address contains `path`, e.g.
   * "imerzn.com/premiumplacement"), then switch back to the app.
   */
  async verifyWebPageAndReturn(path: string): Promise<void> {
    await browser.waitUntil(async () => (await browser.getCurrentPackage()) === chromePackage, {
      timeout: 60_000,
      timeoutMsg: 'The web page did not open in Chrome.',
    });
    await this.closeChromeWelcome();
    await this.chromeAddressBar.waitForDisplayed({ timeout: 60_000 });
    await expect(this.chromeAddressBar).toHaveText(expect.stringContaining(path));
    await browser.execute('mobile: activateApp', { appId: appPackage });
    await this.item('Sync Calendar').waitForDisplayed({ timeout: 30_000 }).catch(() => {});
  }

  /**
   * Chrome shows a welcome screen and a notifications question the first time it opens on a
   * device. Skip them when they appear.
   */
  private async closeChromeWelcome(): Promise<void> {
    const useWithoutAccount = browser.$('//*[@text="Use without an account"]');
    if (await useWithoutAccount.waitForDisplayed({ timeout: 10_000 }).then(() => true, () => false)) {
      await useWithoutAccount.click();
    }
    const noThanks = browser.$('//*[@resource-id="com.android.chrome:id/negative_button"]');
    if (await noThanks.waitForDisplayed({ timeout: 10_000 }).then(() => true, () => false)) {
      await noThanks.click();
    }
  }
}
