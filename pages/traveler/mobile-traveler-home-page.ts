import { byLabel, byLabelStart, tapInside } from '@helpers/mobile-elements';

/** Items of the traveler's left menu, as labelled in the app. */
export type MobileTravelerMenuItem =
  | 'Profile'
  | 'Wishlist'
  | 'Elite Membership'
  | 'Affiliate Partner'
  | 'Notifications'
  | 'About Us';

/**
 * Traveler home: the screen shown after a traveler logs in, with the bottom tabs (Experiences,
 * Localites, Bookings, Stories) and the left menu (☰ at the top left).
 */
export class MobileTravelerHomePage {
  /** "Experiences" tab in the bottom bar (label "Experiences\nTab 1 of 4"). */
  get experiencesTab() {
    return byLabelStart('Experiences\nTab 1');
  }

  /** "Stories" tab in the bottom bar ("Stories\nTab 4 of 4", or "5 of 5" once Messages shows). */
  get storiesTab() {
    return byLabelStart('Stories\nTab');
  }

  /**
   * ☰ button: the first button without a label. (Some menu items are labelled buttons too, so
   * "the first button" alone can hit a menu item.)
   */
  get menuButton() {
    return browser.$('(//android.widget.Button[not(@content-desc) or @content-desc=""])[1]');
  }

  menuItem(name: MobileTravelerMenuItem) {
    return byLabel(name);
  }

  /** First experience card of the Experiences tab; its label starts with the title. */
  get firstExperienceCard() {
    return browser.$('(//*[contains(@content-desc, "Price / person")])[1]');
  }

  /** Heart button of the first experience card. */
  get firstSaveToWishlistButton() {
    return browser.$('(//*[@content-desc="Save to Wishlist"])[1]');
  }

  /**
   * Wait until the traveler home is displayed. Right after login the app may first show
   * "Share Your Travel Experience"; tap SKIP there to go on to the home.
   */
  async waitForLoaded(): Promise<void> {
    const shareStoryHeading = byLabel('Share Your Travel Experience');
    await browser.waitUntil(
      async () => (await this.experiencesTab.isDisplayed().catch(() => false))
        || (await shareStoryHeading.isDisplayed().catch(() => false)),
      { timeout: 60_000, timeoutMsg: 'Neither the traveler home nor "Share Your Travel Experience" was shown.' },
    );
    if (await shareStoryHeading.isDisplayed().catch(() => false)) {
      // SKIP spans the whole width, but only the word at its right end reacts to a tap.
      await tapInside(byLabel('SKIP'), 0.95, 0.5);
      await shareStoryHeading.waitForDisplayed({ reverse: true, timeout: 30_000 });
    }
    await this.experiencesTab.waitForDisplayed({ timeout: 60_000 });
  }

  /** Open the left menu and tap one of its items. */
  async openMenuItem(name: MobileTravelerMenuItem): Promise<void> {
    // After Back the menu may still be sliding in; give it a moment before opening it.
    if (!(await this.menuItem(name).waitForDisplayed({ timeout: 5_000 }).then(() => true, () => false))) {
      await this.menuButton.click();
      await this.menuItem(name).waitForDisplayed({ timeout: 30_000 });
    }
    await this.menuItem(name).click();
  }

  /**
   * Tap the Stories tab until the Stories screen opens: right after the app starts, a tap can be
   * ignored while the home is still loading.
   */
  async openStoriesTab(): Promise<void> {
    const storiesHeading = browser.$('//android.view.View[@content-desc="Stories"]');
    for (let tap = 1; tap <= 3; tap += 1) {
      await this.storiesTab.click();
      if (await storiesHeading.waitForDisplayed({ timeout: 20_000 }).then(() => true, () => false)) {
        return;
      }
    }
    await storiesHeading.waitForDisplayed({ timeout: 20_000 });
  }

  /** Open the Experiences tab and return the title of the first experience (first line of its card). */
  async firstExperienceTitle(): Promise<string> {
    await this.experiencesTab.click();
    await this.firstExperienceCard.waitForDisplayed({ timeout: 60_000 });
    const label = await this.firstExperienceCard.getAttribute('content-desc');
    return (label ?? '').split('\n')[0].trim();
  }
}
