/**
 * Rich-text editors in the app ("Know Before You Go", "What's Included / Not Included",
 * "Description") are Summernote editors in a web view. Taps and typing do not reach them, so the
 * text is set with JavaScript in the editor's web page, and the app is told about the change the
 * same way the editor tells it while a person types.
 */

import { scrollFormTo } from '@helpers/mobile-elements';

type ChainablePromiseElement = ReturnType<typeof browser.$>;

interface WebViewPage {
  id: string;
  description: string;
}

interface WebViewContext {
  webviewName: string;
  pages?: WebViewPage[];
}

/**
 * Replace the text of the rich-text editor shown in `editor` (its EditText inside the web view).
 * Each line of `lines` becomes a paragraph. The editor must be on screen.
 */
export async function fillHtmlEditor(editor: ChainablePromiseElement, lines: string[]): Promise<void> {
  await editor.waitForDisplayed();
  const { y, height } = await editor.getElementRect(await editor.elementId);

  // Each editor is a separate page of the app's web view; pick the one that covers most of the
  // editor on screen. (When the editor is partly under the title bar, the page's top is above
  // the screen while the editor's visible top is not, so the tops alone do not match.)
  const [context] = (await browser.execute('mobile: getContexts')) as WebViewContext[];
  const overlap = (top: number, pageHeight: number) =>
    Math.min(top + pageHeight, y + height) - Math.max(top, y);
  // Hidden or emptied pages of editors that were scrolled away can still be listed; skip them.
  const page = (context?.pages ?? [])
    .map((candidate) => ({
      id: candidate.id,
      info: JSON.parse(candidate.description) as {
        attached?: boolean;
        visible?: boolean;
        empty?: boolean;
        screenY?: number;
        height?: number;
      },
    }))
    .filter(({ info }) => info.attached && info.visible && !info.empty && info.screenY !== undefined)
    .map((candidate) => ({ ...candidate, covered: overlap(candidate.info.screenY ?? 0, candidate.info.height ?? 0) }))
    .sort((one, two) => two.covered - one.covered)
    .find(({ covered }) => covered > height / 2);
  if (!context || !page) {
    throw new Error('Could not find the web page of the rich-text editor on screen.');
  }

  await browser.switchContext(context.webviewName);
  try {
    await browser.switchToWindow(page.id);
    // Empty the editor, then type real key presses into its text area, so the editor reports the
    // text to the app exactly as when a person types. (Setting the text with the editor's own
    // commands showed it on screen, but the app lost it once the editor was scrolled away.)
    await browser.execute(() => {
      const win = window as unknown as { $: (selector: string) => { summernote: (command: string, value?: string) => void } };
      win.$('#summernote-2').summernote('code', '');
    });
    const textArea = browser.$('.note-editable');
    await textArea.click();
    for (const [index, line] of lines.entries()) {
      if (index > 0) {
        await browser.keys('Enter');
      }
      await textArea.addValue(line);
    }
  } finally {
    await browser.switchContext('NATIVE_APP');
  }

  // Typing can make the form jump (e.g. when the keyboard opens), so scroll back up to the editor.
  await scrollFormTo(editor, 'up');

  // The editor's text as seen by Appium (paragraphs become line breaks).
  for (const line of lines) {
    await expect(editor).toHaveText(expect.stringContaining(line));
  }
}

