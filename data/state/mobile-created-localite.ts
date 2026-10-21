import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { testDataPath } from '@data/mobile-csv-loader';

// Local-only file that hands the localite created by mobile LOC-001 to the mobile Profile tests,
// and records what those tests changed or created (new password, name, bio, titles).
const createdLocalitePath = testDataPath('localite', 'mobile-created-localite.json');

export interface MobileLocaliteAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  bio: string;
  /** Latest experience published by mobile EXP-002. */
  experienceTitle?: string;
  /** Latest gallery created by mobile GAL-001. */
  galleryTitle?: string;
}

/** Save the localite created and verified by mobile LOC-001 (replaces any earlier one). */
export async function saveMobileCreatedLocalite(account: MobileLocaliteAccount): Promise<void> {
  await writeFile(createdLocalitePath, `${JSON.stringify(account, null, 2)}\n`, 'utf8');
}

/** Read the localite created by mobile LOC-001; fails if LOC-001 has not run yet. */
export async function readMobileCreatedLocalite(): Promise<MobileLocaliteAccount> {
  if (!existsSync(createdLocalitePath)) {
    throw new Error(
      `No created localite found (${createdLocalitePath}). ` +
      'Run the mobile localite signup test first: npm run mobile:localite-signup',
    );
  }

  const account = JSON.parse(await readFile(createdLocalitePath, 'utf8')) as Partial<MobileLocaliteAccount>;
  const { email, password, firstName, lastName, bio } = account;
  if (!email || !password || !firstName || !lastName || !bio) {
    throw new Error(`${createdLocalitePath} must contain email, password, firstName, lastName, and bio.`);
  }
  return { ...account, email, password, firstName, lastName, bio };
}

/** Record changes to the created localite, e.g. a new password or the title of a new gallery. */
export async function updateMobileCreatedLocalite(changes: Partial<MobileLocaliteAccount>): Promise<void> {
  await saveMobileCreatedLocalite({ ...(await readMobileCreatedLocalite()), ...changes });
}
