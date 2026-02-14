export function logInfo(message, context = {}) {
  // eslint-disable-next-line no-console
  console.log(`[jukebox] ${message}`, context);
}

export function logError(message, error, context = {}) {
  // eslint-disable-next-line no-console
  console.error(`[jukebox] ${message}`, {
    ...context,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
  });
}
