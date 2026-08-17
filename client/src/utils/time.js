export function formatRelative(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const s = Math.round(diffMs / 1000);

  if (s < 45) return 'just now';
  if (s < 90) return '1m ago';

  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;

  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;

  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatTime(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDate(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatInterval(intervalMs) {
  const s = intervalMs / 1000;
  if (s < 60) return `${s}s`;
  const m = s / 60;
  if (m < 60) return `${m} min`;
  const h = m / 60;
  return `${h} hr`;
}

export function groupByDay(items, getTime) {
  const groups = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const map = new Map();

  for (const item of items) {
    const t = getTime(item);
    if (!t) continue;
    const date = new Date(t);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);

    let label;
    const diffDays = Math.round((today - dayStart) / 86400000);
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays < 7) label = date.toLocaleDateString([], { weekday: 'long' });
    else label = date.toLocaleDateString([], { month: 'long', day: 'numeric' });

    if (!map.has(label)) {
      map.set(label, []);
      groups.push({ label, items: map.get(label) });
    }
    map.get(label).push(item);
  }

  return groups;
}
