import { byLabelStart, scrollTo, xpathString } from '@helpers/mobile-elements';

/** Traveler "Stories" tab, with its "Stories" (public) and "My Stories" tabs. */
export class MobileStoriesPage {
  /** Screen title: a plain view (the bottom tab "Stories" is an image). */
  get heading() {
    return browser.$('//android.view.View[@content-desc="Stories"]');
  }

  /** "Stories" tab at the top (public stories); label "Stories\nTab 1 of 2". */
  get publicStoriesTab() {
    return byLabelStart('Stories\nTab 1 of 2');
  }

  /** "My Stories" tab at the top; label "My Stories\nTab 2 of 2". */
  get myStoriesTab() {
    return byLabelStart('My Stories\nTab');
  }

  /**
   * Story card on the open tab; its label lists the author, date, title, location, and
   * description. The other tab stays loaded off screen and can list the same story, so only the
   * card that is displayed counts.
   */
  storyCard(title: string) {
    return browser.$(`(//*[contains(@content-desc, ${xpathString(title)}) and @displayed="true"])[1]`);
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
    await this.myStoriesTab.waitForDisplayed();
  }

  /** Open My Stories and check the story is listed with its title, location, and description. */
  async verifyInMyStories(story: { title: string; location: string; description: string }): Promise<void> {
    await this.myStoriesTab.click();
    await this.verifyStoryCard(story);
  }

  /** Open the public Stories tab and check the story is listed. */
  async verifyInPublicStories(story: { title: string; location: string; description: string }): Promise<void> {
    await this.publicStoriesTab.click();
    await this.verifyStoryCard(story);
  }

  /** Scroll down the list until the story's card is shown, then check its details. */
  private async verifyStoryCard(story: { title: string; location: string; description: string }): Promise<void> {
    const card = this.storyCard(story.title);
    await card.waitForExist({ timeout: 60_000 }).catch(() => {});
    await scrollTo(card, 'down', 10);
    await expect(card).toHaveAttribute('content-desc', expect.stringContaining(story.location));
    await expect(card).toHaveAttribute('content-desc', expect.stringContaining(story.description));
  }
}
