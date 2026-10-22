import { byLabel, byLabelContaining, byLabelStart, scrollFormTo } from '@helpers/mobile-elements';

/** "Profile" screen: first tab of the bottom bar, shown after a localite logs in. */
export class MobileProfilePage {
  get heading() {
    return byLabel('Profile');
  }

  /** "Profile" tab in the bottom bar (label "Profile\nTab 1 of 4", or "of 5" with Messages). */
  get profileTab() {
    return byLabelStart('Profile\nTab 1');
  }

  /** Button of the "Your profile has been updated!" popup shown after a new localite submits the profile. */
  get returnToHomeButton() {
    return byLabel('Return to Home');
  }

  get createExperienceButton() {
    return byLabel('Create Experience');
  }

  get createGalleryButton() {
    return byLabel('Create Gallery');
  }

  get previewProfileButton() {
    return byLabel('Preview Profile');
  }

  get editProfileButton() {
    return byLabel('Edit Profile');
  }

  get shareProfileButton() {
    return byLabel('Share profile');
  }

  get updatePasswordButton() {
    return byLabel('Update Password');
  }

  /** Profile details at the top: one label with name, email, hosted experiences, and bio. */
  profileDetails(email: string) {
    return byLabelContaining(email);
  }

  /** Experience or gallery card on the profile; its label includes the title. */
  card(title: string) {
    return byLabelContaining(title);
  }

  /** Link in Android's share sheet opened by Share profile, e.g. https://imerzn.com/local-guides/<name>. */
  get shareSheetLink() {
    return browser.$('//android.widget.TextView[starts-with(@text, "https://imerzn.com/local-guides/")]');
  }

  /** Close the "Your profile has been updated!" popup; it covers the Profile screen. */
  async closeProfileUpdatedPopup(): Promise<void> {
    await this.returnToHomeButton.waitForDisplayed({ timeout: 60_000 });
    // A tap while the popup is still opening can be ignored (seen locally); tap again until it closes.
    for (let tap = 1; tap <= 3; tap += 1) {
      await browser.pause(1_500);
      await this.returnToHomeButton.click().catch(() => {});
      if (await this.returnToHomeButton.waitForDisplayed({ reverse: true, timeout: 15_000 }).then(() => true, () => false)) {
        return;
      }
    }
    await this.returnToHomeButton.waitForDisplayed({ reverse: true });
  }

  /** Wait until the Profile screen is displayed. */
  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.profileTab.waitForDisplayed();
  }

  /** Scroll to a button of the profile (Create Experience, Edit Profile, ...) and tap it. */
  async tapButton(button: ReturnType<typeof byLabel>): Promise<void> {
    // On a tall screen the button is already shown once the profile has loaded; scrolling then
    // only slides past it. Scroll only when it is not shown, and come back up if a drag overshot.
    const shown = await button.waitForDisplayed({ timeout: 10_000 }).then(() => true, () => false);
    if (!shown) {
      await scrollFormTo(button).catch(() => scrollFormTo(button, 'up'));
    }
    await button.click();
  }

  /** Scroll back to the top of the profile. */
  async scrollToTop(email: string): Promise<void> {
    await scrollFormTo(this.profileDetails(email), 'up');
  }

  /** Check the name and bio shown at the top of the profile. */
  async verifyDetails(details: { email: string; firstName: string; lastName: string; bio: string }): Promise<void> {
    await this.scrollToTop(details.email);
    const label = this.profileDetails(details.email);
    await expect(label).toHaveAttribute('content-desc', expect.stringContaining(`${details.firstName} ${details.lastName}`));
    await expect(label).toHaveAttribute('content-desc', expect.stringContaining(details.bio));
  }

  /** Scroll down the profile until the experience or gallery card with this title is shown. */
  async verifyCardDisplayed(title: string): Promise<void> {
    await scrollFormTo(this.card(title), 'down', 15);
    await expect(this.card(title)).toBeDisplayed();
  }
}
