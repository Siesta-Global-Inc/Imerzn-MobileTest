import { chromium, type Browser, type Locator, type Page } from '@playwright/test';
import { mobileEnv } from '@config/mobile-env';

/**
 * Imerzn Admin portal (web only), used by the mobile tests for admin steps such as verifying
 * a new localite. Opens its own Chrome window with Playwright, next to the Appium session.
 */
export class MobileAdminPortalPage {
  private browser?: Browser;
  private page?: Page;

  /** Launch Chrome. Shown locally, hidden in CI or when MOBILE_ADMIN_HEADLESS=true. */
  async launch(): Promise<void> {
    this.browser = await chromium.launch({ headless: mobileEnv.adminHeadless });
    this.page = await this.browser.newPage();
    this.page.setDefaultTimeout(30_000);
  }

  async close(): Promise<void> {
    await this.browser?.close();
  }

  /** Sign in and wait until the portal leaves the login page. */
  async login(email: string, password: string): Promise<void> {
    const page = this.requirePage();
    await page.goto(`${mobileEnv.adminBaseURL}/login`);
    await page.getByRole('heading', { name: 'Sign in to Imerzn Admin' }).waitFor();

    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();

    await page.waitForURL((url) => !/\/login\/?$/.test(url.pathname), { timeout: 30_000 }).catch(() => {
      throw new Error('Admin login did not succeed; check "Admin Email" / "Admin Password" in testdata/common/auth.csv.');
    });
  }

  /** Users > role tab > search by email > row menu > View. */
  async openUser(role: string, email: string): Promise<void> {
    const page = this.requirePage();
    await page.getByRole('navigation').getByRole('link', { name: 'Users', exact: true }).click();
    await page.waitForURL(/\/dashboard\/users/);

    const roleTab = page.getByRole('tablist', { name: 'Users roles' }).getByRole('tab', { name: role, exact: true });
    await roleTab.click();
    await roleTab.and(page.locator('[aria-selected="true"]')).waitFor();

    const search = page.getByRole('textbox', { name: 'search' });
    await search.fill(email);
    await search.press('Enter');

    const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: email, exact: true }) });
    await row.waitFor({ timeout: 30_000 });
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: 'View', exact: true }).click();
  }

  /** Switch "Verified" on in the user detail view, then Save changes. */
  async markVerifiedAndSave(): Promise<void> {
    const page = this.requirePage();
    const verifiedToggle = this.verifiedToggle(page);
    await verifiedToggle.waitFor();
    if (!(await verifiedToggle.isChecked())) {
      await verifiedToggle.click();
    }
    // The switch updates a moment after the click.
    await verifiedToggle.and(page.locator(':checked')).waitFor({ state: 'attached', timeout: 10_000 }).catch(() => {
      throw new Error('The Verified switch did not turn on.');
    });
    await page.getByRole('button', { name: 'Save changes' }).click();
  }

  /** "Verified" switch: the innermost block containing both the text and a checkbox. */
  private verifiedToggle(page: Page): Locator {
    return page
      .locator('div')
      .filter({ has: page.getByText('Verified', { exact: true }) })
      .filter({ has: page.getByRole('checkbox') })
      .last()
      .getByRole('checkbox');
  }

  private requirePage(): Page {
    if (!this.page) {
      throw new Error('Call launch() before using the admin portal.');
    }
    return this.page;
  }
}
