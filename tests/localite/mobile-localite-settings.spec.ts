import { MobileLoginPage } from '@pages/auth/mobile-login-page';
import { MobileChangePasswordSheet } from '@pages/localite/mobile-change-password-sheet';
import { MobileProfilePage } from '@pages/localite/mobile-profile-page';
import { readMobileAuthData } from '@data/common/mobile-auth-data';
import { readMobileCreatedLocalite, updateMobileCreatedLocalite } from '@data/state/mobile-created-localite';
import { step } from '@helpers/mobile-step';
import { resetApp } from '@helpers/mobile-app';

describe('mobile-localite-settings', () => {
  it('mobile SET-002 | Localite changes the password and logs in with it', async () => {
    // Pre-setup: only the localite created by mobile LOC-001 (never the shared Login account,
    // whose password other tests read from auth.csv).
    const localite = await readMobileCreatedLocalite();
    const authData = await readMobileAuthData();
    // If a previous run already set Localite New Password, switch back to Signup Password,
    // so the new password always differs from the current one.
    const newPassword = localite.password === authData.localiteNewPassword
      ? authData.signupPassword
      : authData.localiteNewPassword;
    console.info(`[DATA] Localite email: ${localite.email}`);

    const loginPage = new MobileLoginPage();
    const profilePage = new MobileProfilePage();
    const changePasswordSheet = new MobileChangePasswordSheet();

    await resetApp();

    // Step 1: Log in as the localite (opens the Profile screen).
    await step('Log in as localite', async () => {
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      await profilePage.waitForLoaded();
    });

    // Step 2: Update Password > enter the current and new password > Update Password.
    let appMessage = '';
    await step('Change password', async () => {
      await profilePage.tapButton(profilePage.updatePasswordButton);
      appMessage = await changePasswordSheet.changePassword(localite.password, newPassword);
      console.info(`[INFO] App message after Update Password: ${appMessage || '(none)'}`);
    });

    // Save the new password right away so the other localite tests can still log in.
    await updateMobileCreatedLocalite({ password: newPassword });

    // Step 3: Start the app again (logged out) and log in with the new password. If that fails,
    // check whether the old password still works: then the app did not save the change (and the
    // old password is recorded again, so the other localite tests can still log in).
    await step('Log in with the new password', async () => {
      await resetApp();
      await loginPage.open();
      await loginPage.login(localite.email, newPassword);
      if (await profilePage.waitForLoaded().then(() => true, () => false)) {
        return;
      }
      await resetApp();
      await loginPage.open();
      await loginPage.login(localite.email, localite.password);
      if (await profilePage.waitForLoaded().then(() => true, () => false)) {
        await updateMobileCreatedLocalite({ password: localite.password });
        throw new Error('The password was not changed: logging in with the new password failed, but the old ' +
          `password still works (app message after Update Password: ${appMessage ? `"${appMessage}"` : 'none'}).`);
      }
      throw new Error('Logging in failed with both the new and the old password.');
    });
  });
});
