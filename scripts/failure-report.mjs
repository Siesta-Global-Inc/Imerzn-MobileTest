// Builds the report page CI publishes to GitHub Pages and links from Slack: each failed test with
// its error and screenshot, and the full test log. The page is public (the repo is public), so
// passwords and OTPs from testdata are masked.
//
// Usage: node scripts/failure-report.mjs <failures.jsonl> <test log> <output folder> [<summary>]
// failures.jsonl is written by afterTest in mobile-wdio.conf.ts.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mask, secrets } from './mask-secrets.mjs';

const [failuresPath, logPath, outDir = 'public-report', summary = ''] = process.argv.slice(2);
const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const failures = failuresPath && existsSync(failuresPath)
  ? readFileSync(failuresPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  : [];

mkdirSync(join(outDir, 'img'), { recursive: true });
const sections = failures.map((failure, index) => {
  const images = (failure.images ?? [])
    .filter((path) => existsSync(path) && statSync(path).size > 0)
    .map((path, i) => {
      const name = `${index + 1}-${i + 1}.png`;
      copyFileSync(path, join(outDir, 'img', name));
      return `<a href="img/${name}"><img src="img/${name}" alt="Screenshot of ${escapeHtml(failure.title)}"></a>`;
    });
  return `
  <section>
    <h2>${index + 1}. ${escapeHtml(mask(failure.title))}</h2>
    ${failure.file ? `<p class="meta">${escapeHtml(failure.file)}</p>` : ''}
    <pre>${escapeHtml(mask(failure.error || 'No error message.'))}</pre>
    ${images.join('\n    ') || '<p class="meta">No screenshot.</p>'}
  </section>`;
});

const hasLog = logPath && existsSync(logPath);
if (hasLog) writeFileSync(join(outDir, 'test-log.txt'), mask(readFileSync(logPath, 'utf8')));

writeFileSync(join(outDir, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Mobile Test Report</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0 auto; max-width: 1100px; padding: 16px; color: #1f2328; background: #fff; }
  h1 { font-size: 22px; } h2 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #59636e; font-size: 13px; margin-top: 0; }
  section { border-top: 1px solid #d1d9e0; padding-top: 12px; margin-top: 20px; }
  pre { background: #f6f8fa; padding: 12px; overflow-x: auto; white-space: pre-wrap; font-size: 13px; }
  img { max-width: 360px; width: 100%; border: 1px solid #d1d9e0; margin-top: 8px; }
</style>
</head>
<body>
<h1>Mobile test report</h1>
<p>${escapeHtml(mask(summary))}</p>
<p class="meta">${hasLog ? '<a href="test-log.txt">Full test log</a> · ' : ''}Passwords are masked. Element trees and the Appium log are in the run's mobile-test-results artifact.</p>
${sections.join('\n') || '<p>No failed tests.</p>'}
</body>
</html>
`);
console.log(`Wrote ${join(outDir, 'index.html')}: ${failures.length} failed test(s), ${secrets.length} secret value(s) masked.`);
