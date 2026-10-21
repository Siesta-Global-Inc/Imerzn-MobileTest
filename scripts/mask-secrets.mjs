// Masks passwords and OTPs from testdata in text that is published (the CI report page and Slack).
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Values that must never be published: passwords and OTPs from testdata. */
function collectSecrets() {
  const secrets = new Set();
  const authCsv = join('testdata', 'common', 'auth.csv');
  if (existsSync(authCsv)) {
    for (const line of readFileSync(authCsv, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^"?([^",]+)"?\s*,\s*"?(.*?)"?\s*$/);
      if (match && /password|otp/i.test(match[1])) secrets.add(match[2]);
    }
  }
  const addPasswords = (value) => {
    if (Array.isArray(value)) value.forEach(addPasswords);
    else if (value && typeof value === 'object') {
      for (const [key, inner] of Object.entries(value)) {
        if (/password|otp/i.test(key) && typeof inner === 'string') secrets.add(inner);
        else addPasswords(inner);
      }
    }
  };
  // Accounts the tests create: testdata/<folder>/mobile-created-*.json
  for (const folder of ['common', 'localite', 'traveler'].map((name) => join('testdata', name))) {
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder).filter((name) => /created-.*\.json$/.test(name))) {
      try { addPasswords(JSON.parse(readFileSync(join(folder, file), 'utf8'))); } catch { /* not JSON */ }
    }
  }
  // Longest first, so a password containing another one is masked whole.
  return [...secrets].filter((secret) => secret.length >= 4).sort((a, b) => b.length - a.length);
}

export const secrets = collectSecrets();
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');

/** The text without colour codes, with every password and OTP replaced by ***. */
export const mask = (text) => secrets.reduce((masked, secret) => masked.split(secret).join('***'), stripAnsi(text ?? ''));
