export function parseExpectedCodes(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed
    .split(',')
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 100 && n <= 599);
}

export function emptyHeaderRow() {
  return { key: '', value: '' };
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
