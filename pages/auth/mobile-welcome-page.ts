import { keepAppRunning } from '@helpers/mobile-app';
import { byLabel } from '@helpers/mobile-elements';

/** First screen of the app: "Travel That Hits Different" with Create Account and Log In. */
export class MobileWelcomePage {
  get createAccountButton() {
    return byLabel('Create Account');
  }

  get logInButton() {
    return byLabel('Log In');
  }

  /**
   * Wait for the welcome screen. The debug build can take minutes to start on a slow emulator,
   * and while it starts the device may not answer Appium or may report the app as not
   * responding; keep the app open and keep asking until the screen shows.
   */
  async waitForLoaded(): Promise<void> {
    await browser.waitUntil(async () => {
      if (await this.createAccountButton.isDisplayed().catch(() => false)) {
        return true;
      }
      await keepAppRunning();
      return false;
    }, {
      timeout: 180_000,
      interval: 3_000,
      timeoutMsg: 'The app did not show its welcome screen (Create Account) within 3 minutes.',
    });
  }

  async openLogin(): Promise<void> {
    await this.waitForLoaded();
    await this.logInButton.click();
  }

  async openSignup(): Promise<void> {
    await this.waitForLoaded();
    await this.createAccountButton.click();
  }
}
