import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { MobileWishlistPage } from '@pages/traveler/mobile-wishlist-page';
import { readMobileWishlistName } from '@data/traveler/mobile-traveler-data';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-wishlist', () => {
  it('mobile WSH-001 | Traveler creates a wishlist and saves an experience to it', async function () {
    // Pre-setup: the traveler created by mobile AUTH-003, and a unique name from wishlist.csv.
    const traveler = await readMobileCreatedTraveler();
    const wishlistName = await readMobileWishlistName();
    console.info(`[DATA] Traveler email: ${traveler.email}`);
    console.info(`[DATA] Wishlist name: ${wishlistName}`);

    const loginPage = new MobileLoginPage();
    const homePage = new MobileTravelerHomePage();
    const wishlistPage = new MobileWishlistPage();

    await resetApp();

    // Step 1: Log in as the traveler (opens the Experiences tab).
    await step('Log in as traveler', async () => {
      await loginPage.open();
      await loginPage.login(traveler.email, traveler.password);
      await homePage.waitForLoaded();
    });

    // Step 2: Left menu > Wishlist, then create a wishlist.
    await step('Create a wishlist', async () => {
      await homePage.openMenuItem('Wishlist');
      await wishlistPage.waitForLoaded();
      await wishlistPage.createWishlist(wishlistName);
    });

    // Step 3: Back to Experiences and pick the first experience; skip if there are none.
    const experienceTitle = await step('Open Experiences', async () => {
      await browser.back();
      return homePage.firstExperienceTitle().catch(() => '');
    });
    if (!experienceTitle) {
      console.info('[INFO] There are no experiences available; skipping.');
      this.skip();
    }
    console.info(`[DATA] Experience: ${experienceTitle}`);

    // Step 4: Tap the heart of the experience and save it to the new wishlist.
    await step('Save the experience to the wishlist', async () => {
      await homePage.firstSaveToWishlistButton.click();
      await wishlistPage.saveTo(wishlistName);
    });

    // Step 5: Left menu > Wishlist, open the wishlist, and check the saved experience.
    await step('Verify the experience in the wishlist', async () => {
      await homePage.openMenuItem('Wishlist');
      await wishlistPage.waitForLoaded();
      await wishlistPage.verifySavedExperience(wishlistName, experienceTitle);
    });
  });
});
