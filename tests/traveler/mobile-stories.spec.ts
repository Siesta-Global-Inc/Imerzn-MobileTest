import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileShareStoryPage } from '@pages/traveler/mobile-share-story-page';
import { MobileStoriesPage } from '@pages/traveler/mobile-stories-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { readMobileStoryData } from '@data/traveler/mobile-traveler-data';
import { readMobileCreatedTraveler } from '@data/state/mobile-created-traveler';
import { step } from '@helpers/mobile-step';
import { appPackage, resetApp } from '@helpers/mobile-app';

describe('mobile-stories', () => {
  it('mobile STR-001 | Traveler shares a story after login and it appears in Stories', async function () {
    // The emulator is slow; uploading the picture and loading the lists can take a while.
    this.timeout(1_200_000);

    // Pre-setup: the traveler created by mobile AUTH-003, and story data from story.csv.
    const traveler = await readMobileCreatedTraveler();
    const story = await readMobileStoryData();
    console.info(`[DATA] Traveler email: ${traveler.email}`);
    console.info(`[DATA] Story title: ${story.title}`);

    const loginPage = new MobileLoginPage();
    const shareStoryPage = new MobileShareStoryPage();
    const storiesPage = new MobileStoriesPage();
    const homePage = new MobileTravelerHomePage();

    await resetApp();

    // Step 1: Log in as the traveler; the app shows "Share Your Travel Experience".
    await step('Log in as traveler', async () => {
      await loginPage.open();
      await loginPage.login(traveler.email, traveler.password);
      await shareStoryPage.waitForLoaded();
    });

    // Step 2: Add a picture, then enter the title, location, and description.
    await step('Fill in the story', async () => {
      await shareStoryPage.fillStory(story);
    });

    // Step 3: Submit Experience. App bug: the app then shows a red error screen instead of
    // Stories (the story is still saved), so close and reopen the app (still logged in).
    await step('Submit the story', async () => {
      await shareStoryPage.submit();
      await browser.saveScreenshot('mobile-test-results/STR-001-after-submit.png').catch(() => {});
      await browser.execute('mobile: terminateApp', { appId: appPackage });
      await browser.execute('mobile: activateApp', { appId: appPackage });
      await homePage.waitForLoaded();
    });

    // Step 4: Open the Stories tab.
    await step('Open Stories', async () => {
      await homePage.openStoriesTab();
      await storiesPage.waitForLoaded();
    });

    // Step 5: The story is listed in My Stories.
    await step('Verify the story in My Stories', async () => {
      await storiesPage.verifyInMyStories(story);
    });

    // Step 6: The story is listed in the public Stories.
    await step('Verify the story in public Stories', async () => {
      await storiesPage.verifyInPublicStories(story);
    });
  });
});
