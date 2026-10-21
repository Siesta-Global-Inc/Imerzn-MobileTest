import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { MobileTravelerHomePage } from '@pages/traveler/mobile-traveler-home-page';
import { resetApp } from '@helpers/mobile-app';

// Both start from a fresh app (resetApp clears it, so any earlier user is logged out).

/** Log in as a traveler; ends on the Experiences tab (SKIP is tapped on "Share Your Travel Experience"). */
export async function loginAsTraveler(account: { email: string; password: string }): Promise<void> {
  await resetApp();
  const loginPage = new MobileLoginPage();
  await loginPage.open();
  await loginPage.login(account.email, account.password);
  await new MobileTravelerHomePage().waitForLoaded();
}

/** Log in as a localite; ends on the Profile tab. */
export async function loginAsLocalite(account: { email: string; password: string }): Promise<void> {
  await resetApp();
  const loginPage = new MobileLoginPage();
  await loginPage.open();
  await loginPage.login(account.email, account.password);
  await new MobileProfilePage().waitForLoaded();
}
