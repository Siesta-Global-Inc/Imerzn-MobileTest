import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { testDataPath } from '@data/mobile-csv-loader';

// Local-only file that hands the traveler created by mobile AUTH-003 to the mobile traveler
// tests, and records what those tests changed (e.g. a new name).
const createdTravelerPath = testDataPath('traveler', 'mobile-created-traveler.json');

export interface MobileTravelerAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

/** Save the traveler created by mobile AUTH-003 (replaces any earlier one). */
export async function saveMobileCreatedTraveler(account: MobileTravelerAccount): Promise<void> {
  await writeFile(createdTravelerPath, `${JSON.stringify(account, null, 2)}\n`, 'utf8');
}

/** Read the traveler created by mobile AUTH-003; fails if AUTH-003 has not run yet. */
export async function readMobileCreatedTraveler(): Promise<MobileTravelerAccount> {
  if (!existsSync(createdTravelerPath)) {
    throw new Error(
      `No created traveler found (${createdTravelerPath}). ` +
      'Run the mobile traveler signup test first: RUN_SIGNUP_TEST=true npm run mobile:signup',
    );
  }

  const account = JSON.parse(await readFile(createdTravelerPath, 'utf8')) as Partial<MobileTravelerAccount>;
  const { email, password, firstName, lastName } = account;
  if (!email || !password || !firstName || !lastName) {
    throw new Error(`${createdTravelerPath} must contain email, password, firstName, and lastName.`);
  }
  return { ...account, email, password, firstName, lastName };
}

/** Record changes to the created traveler, e.g. a new name. */
export async function updateMobileCreatedTraveler(changes: Partial<MobileTravelerAccount>): Promise<void> {
  await saveMobileCreatedTraveler({ ...(await readMobileCreatedTraveler()), ...changes });
}
