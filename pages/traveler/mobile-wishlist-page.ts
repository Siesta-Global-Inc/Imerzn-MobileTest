import { byLabel, byLabelStart, fillField, inputByHint, xpathString } from '@helpers/mobile-elements';

/**
 * "My Wishlists" screen (left menu > Wishlist), its "New Wishlist" dialog, and the
 * "Save to wishlist" sheet opened by the heart of an experience card.
 */
export class MobileWishlistPage {
  get heading() {
    return byLabel('My Wishlists');
  }

  /** "+" button at the top right of My Wishlists. */
  get createWishlistButton() {
    return byLabel('Create Wishlist');
  }

  get nameInput() {
    return inputByHint('Wishlist name');
  }

  get createButton() {
    return byLabel('Create');
  }

  /** Wishlist card or row; its label is "<name>\n<count> item(s)". */
  wishlist(name: string) {
    return byLabelStart(`${name}\n`);
  }

  /** Title of an opened wishlist (a plain view). */
  openedWishlistTitle(name: string) {
    return browser.$(`//android.view.View[@content-desc=${xpathString(name)}]`);
  }

  /** Experience listed in an opened wishlist, by title. */
  savedExperience(title: string) {
    return byLabel(title);
  }

  /** "Done" button of the Save to wishlist sheet. */
  get doneButton() {
    return byLabel('Done');
  }

  async waitForLoaded(): Promise<void> {
    await this.heading.waitForDisplayed({ timeout: 60_000 });
  }

  /** Create a wishlist with this name and check it is listed. */
  async createWishlist(name: string): Promise<void> {
    await this.createWishlistButton.click();
    await this.nameInput.waitForDisplayed({ timeout: 30_000 });
    await fillField(this.nameInput, name);
    await this.createButton.click();
    await this.wishlist(name).waitForDisplayed({ timeout: 60_000 });
  }

  /** In the Save to wishlist sheet: tap the wishlist (saves at once, its count becomes 1), then Done. */
  async saveTo(name: string): Promise<void> {
    await this.wishlist(name).waitForDisplayed({ timeout: 30_000 });
    await this.wishlist(name).click();
    await expect(this.wishlist(name)).toHaveAttribute('content-desc', expect.stringContaining('1 item'));
    await this.doneButton.click();
    await this.doneButton.waitForDisplayed({ reverse: true });
  }

  /** Open the wishlist and check the experience is listed in it. */
  async verifySavedExperience(name: string, experienceTitle: string): Promise<void> {
    await this.wishlist(name).waitForDisplayed({ timeout: 60_000 });
    await this.wishlist(name).click();
    await this.openedWishlistTitle(name).waitForDisplayed({ timeout: 30_000 });
    await expect(this.savedExperience(experienceTitle)).toBeDisplayed();
  }
}
