export function extractSongQuery(text, commandPrefix = 'play') {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  const prefixPattern = new RegExp(`^${escapeRegExp(commandPrefix)}\\s+`, 'i');
  if (prefixPattern.test(normalized)) {
    return normalized.replace(prefixPattern, '').trim() || null;
  }

  return null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}
