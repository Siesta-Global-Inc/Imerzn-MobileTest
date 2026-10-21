/**
 * Element with the given accessibility label. Flutter exposes button and text labels
 * as content-desc, so this finds e.g. the "Log In" button.
 */
export function byLabel(label: string) {
  return browser.$(`~${label}`);
}

/**
 * Element whose accessibility label starts with the given text. Use it for labels that have
 * extra lines, e.g. "Profile\nTab 1 of 5".
 */
export function byLabelStart(label: string) {
  return browser.$(`//*[starts-with(@content-desc, ${xpathString(label)})]`);
}

/** Empty text field whose placeholder (hint) starts with the given text. */
export function inputByHint(hint: string) {
  return browser.$(`//android.widget.EditText[starts-with(@hint, ${xpathString(hint)})]`);
}

/**
 * Tap a text field and type the value. The config types with Appium's hidden keyboard,
 * so no on-screen keyboard covers the fields below.
 */
export async function fillField(field: ChainablePromiseElement, value: string): Promise<void> {
  await field.waitForDisplayed();
  await field.click();
  await field.setValue(value);
}

/**
 * Scroll the screen until the element is displayed.
 * Flutter only exposes elements that are on screen, so a field further down the form
 * does not exist until it is scrolled into view.
 */
export async function scrollTo(
  element: ChainablePromiseElement,
  direction: 'down' | 'up' = 'down',
  maxSwipes = 6,
): Promise<void> {
  for (let swipe = 0; swipe < maxSwipes; swipe += 1) {
    if (await element.isDisplayed()) {
      return;
    }
    await swipeScreen(direction);
  }
  await element.waitForDisplayed({ timeout: 5_000 });
}

/** Swipe the middle of the screen to scroll the content down or up. */
export async function swipeScreen(direction: 'down' | 'up'): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  await browser.execute('mobile: scrollGesture', {
    left: Math.round(width * 0.1),
    top: Math.round(height * 0.25),
    width: Math.round(width * 0.8),
    height: Math.round(height * 0.5),
    direction,
    percent: 0.8,
  });
}

/**
 * Scroll a form until the element is displayed, by dragging along the left edge of the screen.
 * Use it on forms with rich-text editors or videos: a drag that starts on those is taken by them
 * and does not scroll the form, but the left edge is always the form itself.
 */
export async function scrollFormTo(
  element: ChainablePromiseElement,
  direction: 'down' | 'up' = 'down',
  maxDrags = 12,
): Promise<void> {
  for (let drag = 0; drag < maxDrags; drag += 1) {
    if (await element.isDisplayed()) {
      return;
    }
    await dragFormEdge(direction);
  }
  await element.waitForDisplayed({ timeout: 5_000 });
}

/** Drag the left edge of the screen to scroll the form down or up by about half a screen. */
export async function dragFormEdge(direction: 'down' | 'up', ratio = 0.5): Promise<void> {
  const { height } = await browser.getWindowSize();
  const low = Math.round(height * 0.78);
  const high = Math.round(height * (0.78 - ratio));
  const [from, to] = direction === 'down' ? [low, high] : [high, low];
  await browser
    .action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x: 20, y: from })
    .down()
    .pause(100)
    .move({ duration: 600, x: 20, y: to })
    // Hold still before lifting, so Android does not turn the drag into a fling that keeps the
    // form sliding past the target (on tall screens it slid fields under the title bar).
    .pause(400)
    .up()
    .perform();
  // The form keeps sliding for a moment after the drag; wait so element positions are final.
  await browser.pause(1_000);
}

/**
 * Move the element into the upper part of the screen, so a suggestion list that opens below it
 * is on screen (Flutter only exposes elements that are on screen).
 */
export async function moveToUpperScreen(element: ChainablePromiseElement): Promise<void> {
  const { height } = await browser.getWindowSize();
  for (let drag = 0; drag < 4; drag += 1) {
    // The screen may be redrawing (e.g. a suggestion list closing); wait for the element first.
    // If the last drag slid it up under the title bar, scroll back a little to bring it back.
    if (drag > 0 && !(await element.waitForDisplayed({ timeout: 5_000 }).then(() => true, () => false))) {
      await dragFormEdge('up', 0.25);
    }
    await element.waitForDisplayed({ timeout: 10_000 });
    const { y } = await element.getLocation();
    if (y < height * 0.4) {
      return;
    }
    await dragFormEdge('down', Math.min(0.5, (y - height * 0.2) / height));
  }
}

/**
 * Location field with suggestions: type the first part of the location (before the first comma),
 * then tap the suggestion that matches the whole location, e.g. "Addison, New York, United States".
 * A location typed without picking a suggestion is not kept.
 */
export async function selectLocation(field: ChainablePromiseElement, location: string): Promise<void> {
  await moveToUpperScreen(field);

  // The same text can be listed by several open suggestion lists; the newest one is last.
  const suggestion = browser.$(`(//*[@content-desc=${xpathString(location)}])[last()]`);
  // The location search sometimes never answers; then clear the field and type again.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await field.clearValue();
    await fillField(field, location.split(',')[0].trim());
    if (await suggestion.waitForDisplayed({ timeout: 20_000 }).then(() => true, () => false)) {
      break;
    }
    if (attempt === 3) {
      throw new Error(`The location suggestion "${location}" was not shown.`);
    }
  }
  await suggestion.click();
  await expect(field).toHaveText(location);

  // The app leaves a grey layer over the screen after the pick, and the next tap only closes it
  // (on a field, that tap would be lost and the next key presses would go to this field).
  await tapTitleBar();
}

/**
 * Tap the middle of the title bar, which does nothing by itself: it closes the grey layer the app
 * leaves after a location is picked, and releases the keyboard focus from the last text field.
 */
export async function tapTitleBar(): Promise<void> {
  const { width, height } = await browser.getWindowSize();
  // 8% of the screen height is inside the title bar on every screen size tried (a fixed y hit
  // the status bar above it on taller screens).
  await browser.execute('mobile: clickGesture', { x: Math.round(width / 2), y: Math.round(height * 0.08) });
  await browser.pause(1_000);
}

/** Tap a point given as a fraction of the element's size, e.g. (0.5, 0.5) is its center. */
export async function tapInside(
  element: ChainablePromiseElement,
  xRatio: number,
  yRatio: number,
): Promise<void> {
  const { x, y, width, height } = await element.getElementRect(await element.elementId);
  await browser.execute('mobile: clickGesture', {
    x: Math.round(x + width * xRatio),
    y: Math.round(y + height * yRatio),
  });
}

/** Element whose accessibility label contains the given text, e.g. a card that lists its title. */
export function byLabelContaining(text: string) {
  return browser.$(`//*[contains(@content-desc, ${xpathString(text)})]`);
}

/** All labels currently exposed on screen, e.g. to spot a message the app shows after a tap. */
export async function screenLabels(): Promise<string[]> {
  const source = await browser.getPageSource().catch(() => '');
  return [...source.matchAll(/content-desc="([^"]+)"/g)].map((match) => match[1].replace(/&#10;/g, ' '));
}

/** Quote text for use inside an XPath expression. */
export function xpathString(value: string): string {
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  return `concat("${value.split('"').join('", \'"\', "')}")`;
}

type ChainablePromiseElement = ReturnType<typeof browser.$>;

/**
 * Tap a bottom-bar tab until its screen shows: right after the app changes screens (e.g. after a
 * payment message), a tap on a tab can be ignored.
 */
export async function openTab(tab: ChainablePromiseElement, screen: ChainablePromiseElement): Promise<void> {
  for (let tap = 1; tap <= 3; tap += 1) {
    await tab.click();
    if (await screen.waitForDisplayed({ timeout: 20_000 }).then(() => true, () => false)) {
      return;
    }
  }
  await screen.waitForDisplayed({ timeout: 20_000 });
}

/**
 * Move a list card (already on screen) into the middle part of the screen, so a card cut off at
 * the top or bottom shows all its lines (Flutter only exposes what is on screen).
 */
export async function centerOnScreen(element: ChainablePromiseElement): Promise<void> {
  const { height } = await browser.getWindowSize();
  for (let drag = 0; drag < 3; drag += 1) {
    const { y } = await element.getLocation();
    if (y < height * 0.15) {
      await dragFormEdge('up', 0.25);
    } else if (y > height * 0.55) {
      await dragFormEdge('down', 0.3);
    } else {
      return;
    }
  }
}
