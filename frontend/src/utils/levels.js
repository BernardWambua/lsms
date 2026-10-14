// Proficiency levels and DIF scores share one 1 (low) to 5 (high) scale,
// matching PROFICIENCY_LEVELS in backend/app/models.py.
export const LEVELS = [
  { value: 1, label: 'Awareness' },
  { value: 2, label: 'Basic' },
  { value: 3, label: 'Intermediate' },
  { value: 4, label: 'Advanced' },
  { value: 5, label: 'Expert' },
];

export function levelLabel(value) {
  const level = LEVELS.find((l) => l.value === value);
  return level ? `${level.value} · ${level.label}` : '—';
}

// Gap engine priority bands (backend/app/gaps.py).
export const PRIORITIES = {
  high: { label: 'High', color: 'error' },
  medium: { label: 'Medium', color: 'warning' },
  low: { label: 'Low', color: 'info' },
  none: { label: 'Met', color: 'success' },
  not_assessed: { label: 'Not assessed', color: 'default' },
};

export function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function fullName(user) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
}
