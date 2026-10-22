import { byLabel, byLabelContaining, scrollFormTo } from '@helpers/mobile-elements';

/** "Preview Profile" screen: the localite's profile as travelers see it. */
export class MobilePreviewProfilePage {
  /** Screen title: a plain view (the Profile's "Preview Profile" button is an image). */
  get heading() {
    return browser.$('//android.view.View[@content-desc="Preview Profile"]');
  }

  /** Back arrow in the top bar. */
  get backButton() {
    return browser.$('(//android.widget.Button)[1]');
  }

  /** Profile details at the top: one label with name, hosted experiences, and bio. */
  details(firstName: string, lastName: string) {
    return byLabelContaining(`${firstName} ${lastName}`);
  }

  get followButton() {
    return byLabel('Follow');
  }

  get messageButton() {
    return byLabel('Message/Plan My Trip');
  }

  get shareProfileButton() {
    return byLabel('Share profile');
  }

  /** Experience or gallery card; its label includes the title. */
  card(title: string) {
    return byLabelContaining(title);
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
  }

  /** Check name, bio, and the traveler buttons (Follow, Message/Plan My Trip, Share profile). */
  async verifyDetails(details: { firstName: string; lastName: string; bio: string }): Promise<void> {
    const label = this.details(details.firstName, details.lastName);
    await label.waitForDisplayed({ timeout: 60_000 });
    await expect(label).toHaveAttribute('content-desc', expect.stringContaining(details.bio));

    for (const button of [this.followButton, this.messageButton, this.shareProfileButton]) {
      await scrollFormTo(button);
      await expect(button).toBeDisplayed();
    }
  }

  /** Scroll down until the experience or gallery card with this title is shown. */
  async verifyCardDisplayed(title: string): Promise<void> {
    await scrollFormTo(this.card(title), 'down', 20);
    await expect(this.card(title)).toBeDisplayed();
  }
}
