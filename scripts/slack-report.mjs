// Posts the CI test result to Slack. On failure, each failed test gets a reply in the message's
// thread with its error and screenshot(s), and the full test log is attached to the thread.
// Passwords and OTPs from testdata are masked in every message and in the log.
//
// Slack setup (Slack app with a bot user):
//   SLACK_BOT_TOKEN   Bot token (xoxb-...) with the chat:write and files:write scopes.
//   SLACK_CHANNEL_ID  Channel ID (e.g. C0123456789); invite the bot to the channel (/invite @bot).
// Without them, SLACK_WEBHOOK_URL is used instead (summary text only: webhooks cannot send images).
//
// Usage: node scripts/slack-report.mjs --name "Mobile tests" --outcome success|failure
//          --summary "<counts line>" [--failures <file.json|file.jsonl>] [--log <file>]
//          [--run-url <url>] [--report-url <url>] [--branch <name>] [--actor <name>]
// Failures file: a JSON array, or one JSON object per line, of
//   { "title": "...", "file": "...", "error": "...", "images": ["path/to/screenshot.png"] }
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: {
    name: { type: 'string', default: 'Tests' },
    outcome: { type: 'string', default: 'failure' },
    summary: { type: 'string', default: '' },
    failures: { type: 'string' },
    log: { type: 'string' },
    'run-url': { type: 'string', default: '' },
    'report-url': { type: 'string', default: '' },
    branch: { type: 'string', default: '' },
    actor: { type: 'string', default: '' },
  },
});

/** Slack replies posted per run; the rest are listed in the log and the run's artifact. */
const MAX_FAILURE_REPLIES = 15;
const MAX_ERROR_CHARS = 2500;

const { SLACK_BOT_TOKEN: botToken, SLACK_CHANNEL_ID: channel, SLACK_WEBHOOK_URL: webhookUrl } = process.env;

/** Values that must never be sent to Slack: passwords and OTPs from testdata. */
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
  // Accounts the tests create: testdata/<folder>/[mobile-]created-*.json
  for (const folder of ['common', 'localite', 'traveler'].map((name) => join('testdata', name))) {
    if (!existsSync(folder)) continue;
    for (const file of readdirSync(folder).filter((name) => /created-.*\.json$/.test(name))) {
      try { addPasswords(JSON.parse(readFileSync(join(folder, file), 'utf8'))); } catch { /* not JSON */ }
    }
  }
  if (process.env.IMERZN_PASSWORD) secrets.add(process.env.IMERZN_PASSWORD);
  // Longest first, so a password containing another one is masked whole.
  return [...secrets].filter((secret) => secret.length >= 4).sort((a, b) => b.length - a.length);
}

const secrets = collectSecrets();
const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*m/g, '');
const mask = (text) => secrets.reduce((masked, secret) => masked.split(secret).join('***'), stripAnsi(text ?? ''));
const truncate = (text, max) => (text.length > max ? `${text.slice(0, max)}\n… (truncated, see the log)` : text);

function readFailures(path) {
  if (!path || !existsSync(path)) return [];
  const content = readFileSync(path, 'utf8').trim();
  if (!content) return [];
  if (content.startsWith('[')) return JSON.parse(content);
  return content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function slack(method, body) {
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(`Slack ${method} failed: ${json.error}`);
  return json;
}

/** Uploads files (path + bytes) into the thread, with a message shown above them. */
async function uploadFiles(threadTs, files, comment) {
  const uploaded = [];
  for (const { name, bytes } of files) {
    // files.getUploadURLExternal only accepts form-encoded parameters.
    const response = await fetch('https://slack.com/api/files.getUploadURLExternal', {
      method: 'POST',
      headers: { Authorization: `Bearer ${botToken}` },
      body: new URLSearchParams({ filename: name, length: String(bytes.length) }),
    });
    const target = await response.json();
    if (!target.ok) throw new Error(`Slack files.getUploadURLExternal failed: ${target.error}`);
    const upload = await fetch(target.upload_url, { method: 'POST', body: bytes });
    if (!upload.ok) throw new Error(`Slack file upload failed: HTTP ${upload.status}`);
    uploaded.push({ id: target.file_id, title: name });
  }
  await slack('files.completeUploadExternal', {
    files: uploaded, channel_id: channel, thread_ts: threadTs, initial_comment: comment,
  });
}

const passed = args.outcome === 'success';
const failures = readFailures(args.failures);
const runUrl = args['run-url'];
const reportUrl = args['report-url'];

let text = `${passed ? ':white_check_mark:' : ':x:'} *${args.name} — ${passed ? 'All tests passed' : 'Tests failed'}*`;
if (args.branch) text += ` (branch \`${args.branch}\`${args.actor ? `, by ${args.actor}` : ''})`;
if (args.summary) text += `\n${mask(args.summary)}`;
if (!passed && failures.length) {
  const titles = [...new Set(failures.map((f) => `• ${mask(f.title)}`))];
  text += `\n*Failed tests:*\n${titles.slice(0, MAX_FAILURE_REPLIES).join('\n')}`;
  if (titles.length > MAX_FAILURE_REPLIES) text += `\n…and ${titles.length - MAX_FAILURE_REPLIES} more`;
}
const links = [];
if (reportUrl) links.push(`<${reportUrl}|Open failed tests with screenshots>`);
if (runUrl) links.push(`<${runUrl}|View run>`);
if (links.length) text += `\n${links.join('  |  ')}`;
if (!passed && botToken && channel) text += '\n_Screenshots, errors and the log are in the thread :thread:_';

if (botToken && channel) {
  const { ts } = await slack('chat.postMessage', { channel, text, unfurl_links: false });
  if (!passed) {
    for (const [index, failure] of failures.slice(0, MAX_FAILURE_REPLIES).entries()) {
      const error = truncate(mask(failure.error || 'No error message.'), MAX_ERROR_CHARS);
      const comment = `:x: *${index + 1}. ${mask(failure.title)}*${failure.file ? `\n_${failure.file}_` : ''}\n\`\`\`${error}\`\`\``;
      const images = (failure.images ?? []).filter((path) => existsSync(path) && statSync(path).size > 0);
      try {
        if (images.length) {
          await uploadFiles(ts, images.map((path, i) => ({
            name: `${index + 1}-${i + 1}-${basename(path)}`, bytes: readFileSync(path),
          })), comment);
        } else {
          await slack('chat.postMessage', { channel, thread_ts: ts, text: `${comment}\n_No screenshot._` });
        }
      } catch (error) {
        console.log(`::warning::Could not post failure "${failure.title}" to Slack: ${error.message}`);
      }
    }
    if (args.log && existsSync(args.log)) {
      const log = Buffer.from(mask(readFileSync(args.log, 'utf8')), 'utf8');
      await uploadFiles(ts, [{ name: basename(args.log), bytes: log }], ':page_facing_up: Full test log (passwords masked)')
        .catch((error) => console.log(`::warning::Could not upload the log to Slack: ${error.message}`));
    }
  }
  console.log(`Posted to Slack: ${passed ? 'passed' : `${failures.length} failure(s)`}, ${secrets.length} secret value(s) masked.`);
} else if (webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Slack webhook failed: HTTP ${response.status}`);
  console.log('Posted the summary to Slack with the webhook (set SLACK_BOT_TOKEN and SLACK_CHANNEL_ID to also send screenshots and logs).');
} else {
  console.log('No Slack secrets set (SLACK_BOT_TOKEN + SLACK_CHANNEL_ID, or SLACK_WEBHOOK_URL); skipping Slack.');
}
