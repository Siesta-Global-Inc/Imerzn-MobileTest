import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileLeftMenu } from '@pages/localite/mobile-left-menu';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-left-menu', () => {
  it('mobile MENU-001 | Localite opens each item of the left menu', async function () {
    // Two web pages open in Chrome and the emulator is slow, so allow more than 10 minutes.
    this.timeout(1_200_000);

    // Pre-setup: the localite created by mobile LOC-001.
    const localite = await readMobileCreatedLocalite();
    console.info(`[DATA] Localite email: ${localite.email}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const leftMenu = new MobileLeftMenu();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Sync Calendar opens the "Choose Calendar" dialog.
    await step('Sync Calendar shows the Choose Calendar dialog', async () => {
      await leftMenu.tap('Sync Calendar');
      await leftMenu.verifyChooseCalendarDialogAndClose();
    });

    // Step 3: Experiences opens the Experiences screen.
    await step('Experiences shows the Experiences screen', async () => {
      await leftMenu.tap('Experiences');
      await leftMenu.verifyScreenAndGoBack('Experiences');
    });

    // Step 4: Localites opens the Localites screen.
    await step('Localites shows the Localites screen', async () => {
      await leftMenu.tap('Localites');
      await leftMenu.verifyScreenAndGoBack('Localites');
    });

    // Step 5: Referral Program opens the Referral Program screen.
    await step('Referral Program shows the Referral Program screen', async () => {
      await leftMenu.tap('Referral Program');
      await leftMenu.verifyScreenAndGoBack('Referral Program');
    });

    // Step 6: Premium Placement opens its web page in Chrome.
    await step('Premium Placement opens the web page', async () => {
      await leftMenu.tap('Premium Placement');
      await leftMenu.verifyWebPageAndReturn('imerzn.com/premiumplacement');
    });

    // Step 7: Affiliate Partner opens its web page in Chrome.
    await step('Affiliate Partner opens the web page', async () => {
      await leftMenu.tap('Affiliate Partner');
      await leftMenu.verifyWebPageAndReturn('imerzn.com/affiliate');
    });

    // Step 8: Payouts opens the Payouts dialog.
    await step('Payouts shows the Payouts dialog', async () => {
      await leftMenu.tap('Payouts');
      await leftMenu.verifyPayoutsDialogAndClose();
    });

    // Step 9: About Us opens the About Us screen.
    await step('About Us shows the About Us screen', async () => {
      await leftMenu.tap('About Us');
      await leftMenu.verifyScreenAndGoBack('About Us');
    });
  });
});
