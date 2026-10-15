// Labels for the training plan, matching backend/app/models.py.
export const QUARTERS = [
  { value: 1, label: 'Q1 (Jul–Sep)' },
  { value: 2, label: 'Q2 (Oct–Dec)' },
  { value: 3, label: 'Q3 (Jan–Mar)' },
  { value: 4, label: 'Q4 (Apr–Jun)' },
];

export const DELIVERY_MODES = [
  { value: 'in_house', label: 'In-house' },
  { value: 'local', label: 'External (local)' },
  { value: 'foreign', label: 'External (foreign)' },
  { value: 'online', label: 'Online' },
];

export const PLAN_STATUSES = {
  draft: { label: 'Draft', color: 'default' },
  submitted: { label: 'Submitted', color: 'info' },
  approved: { label: 'Approved', color: 'success' },
};

export const NOMINATION_STATUSES = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const ATTENDANCE = [
  { value: 'not_recorded', label: 'Not recorded' },
  { value: 'attended', label: 'Attended' },
  { value: 'partial', label: 'Partly attended' },
  { value: 'absent', label: 'Absent' },
];

export function label(options, value) {
  return options.find((o) => o.value === value)?.label || '—';
}

const KES = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 0 });

export function kes(value) {
  return value === null || value === undefined || value === '' ? '—' : `KES ${KES.format(Number(value))}`;
}

// The Kenyan government financial year (July to June) that `date` falls in, e.g. '2026/27'.
export function financialYear(date = new Date()) {
  const start = date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`;
}

export function dateRange(start, end) {
  if (start && end) return `${start} – ${end}`;
  return start || '—';
}
