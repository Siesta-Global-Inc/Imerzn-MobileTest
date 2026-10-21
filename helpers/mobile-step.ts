/**
 * Run a named test step: logs it to the terminal and prefixes any failure with the step name.
 */
export async function step<T>(title: string, action: () => Promise<T>): Promise<T> {
  console.info(`[STEP] ${title}`);
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[FAILED] ${title}: ${message}`);
    throw new Error(`Step "${title}" failed: ${message}`, { cause: error });
  }
}
