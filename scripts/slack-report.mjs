// Posts the CI test result to Slack: pass/fail, the counts, the failed tests' names and a link to
// the report page (screenshots, errors and the log; built by scripts/failure-report.mjs).
//
// Slack: SLACK_BOT_TOKEN (xoxb-..., chat:write scope) and SLACK_CHANNEL_ID (the bot must be in
// the channel), or SLACK_WEBHOOK_URL (an Incoming Webhook). Without them, Slack is skipped.
//
// Usage: node scripts/slack-report.mjs --name "Mobile tests" --outcome success|failure
//          --summary "<counts line>" [--failures <failures.jsonl>]
//          [--run-url <url>] [--report-url <url>] [--branch <name>] [--actor <name>]
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { mask } from './mask-secrets.mjs';

const { values: args } = parseArgs({
  options: {
    name: { type: 'string', default: 'Tests' },
    outcome: { type: 'string', default: 'failure' },
    summary: { type: 'string', default: '' },
    failures: { type: 'string' },
    'run-url': { type: 'string', default: '' },
    'report-url': { type: 'string', default: '' },
    branch: { type: 'string', default: '' },
    actor: { type: 'string', default: '' },
  },
});

/** Failed test names listed in the message; the report page has all of them. */
const MAX_LISTED = 15;
const { SLACK_BOT_TOKEN: botToken, SLACK_CHANNEL_ID: channel, SLACK_WEBHOOK_URL: webhookUrl } = process.env;

const failures = args.failures && existsSync(args.failures)
  ? readFileSync(args.failures, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  : [];
const passed = args.outcome === 'success';

let text = `${passed ? ':white_check_mark:' : ':x:'} *${args.name} — ${passed ? 'All tests passed' : 'Tests failed'}*`;
if (args.branch) text += ` (branch \`${args.branch}\`${args.actor ? `, by ${args.actor}` : ''})`;
if (args.summary) text += `\n${mask(args.summary)}`;
if (!passed && failures.length) {
  const titles = [...new Set(failures.map((f) => `• ${mask(f.title)}`))];
  text += `\n*Failed tests:*\n${titles.slice(0, MAX_LISTED).join('\n')}`;
  if (titles.length > MAX_LISTED) text += `\n…and ${titles.length - MAX_LISTED} more`;
}
const links = [];
if (args['report-url']) links.push(`<${args['report-url']}|Open the report (screenshots, errors, log)>`);
if (args['run-url']) links.push(`<${args['run-url']}|View run>`);
if (links.length) text += `\n${links.join('  |  ')}`;

if (botToken && channel) {
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const json = await response.json();
  if (!json.ok) throw new Error(`Slack chat.postMessage failed: ${json.error}`);
  console.log('Posted the result to Slack.');
} else if (webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Slack webhook failed: HTTP ${response.status}`);
  console.log('Posted the result to Slack.');
} else {
  console.log('No Slack secrets set (SLACK_BOT_TOKEN + SLACK_CHANNEL_ID, or SLACK_WEBHOOK_URL); skipping Slack.');
}
