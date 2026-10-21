import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileAuthData, withEmailSuffix } from '@data/common/mobile-auth-data';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-login', () => {
  // Reset the app once for this file: restarting it is slow on an emulator.
  // Test 2 reuses the login screen left by Test 1, or opens it if Test 1 did not get there.
  before(async () => {
    await resetApp();
  });

  // Test 1: Verify that an unregistered email cannot log in.
  it('mobile AUTH-001 | Login fails with an unregistered email', async () => {
    // Preparation: Read the test account and add a random number to make an unregistered email.
    const { loginEmail, loginPassword } = await readMobileAuthData();
    const unregisteredEmail = withEmailSuffix(loginEmail, Math.floor(100000 + Math.random() * 900000));

    const loginPage = new MobileLoginPage();

    // Step 1: Open the login screen and submit the unregistered credentials.
    await step('Log in with an unregistered email', async () => {
      await loginPage.open();
      await loginPage.login(unregisteredEmail, loginPassword);
    });

    // Step 2: Verify that the app displays the expected error message.
    await step('Verify the login error message', async () => {
      await expect(loginPage.loginErrorMessage).toBeDisplayed();
    });
  });

  
  // Test 2: Verify that a registered user can log in successfully.
  it('mobile AUTH-002 | Registered user can access the Profile screen', async () => {
    // Read the registered user's credentials from auth.csv.
    const { loginEmail, loginPassword } = await readMobileAuthData();

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();

    // Step 1: On the login screen, replace the email with the registered one and log in.
    // The correct password is still in the form from Test 1.
    await step('Log in with a registered account', async () => {
      await loginPage.open();
      await loginPage.loginWithNewEmail(loginEmail, loginPassword);
    });

    // Step 2: Verify that the Profile screen is displayed after login.
    await step('Verify the Profile screen', async () => {
      await profilePage.waitForLoaded();
      await expect(profilePage.heading).toBeDisplayed();
    });
  });
});
