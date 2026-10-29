// Licence states and wording, matching backend/app/licensing.py.
export const LICENSE_STATES = {
  active: { label: 'Active', color: 'success' },
  grace: { label: 'Grace period', color: 'warning' },
  read_only: { label: 'Read-only', color: 'error' },
  suspended: { label: 'Suspended', color: 'error' },
};

// Admins are warned this many days before the licence ends.
const WARN_DAYS = 60;

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// The banner to show above every page, or null. Everyone is told when LSMS is
// read-only (so failed saves make sense); only admins get renewal reminders.
export function bannerFor(license, role) {
  if (!license?.state) return null;
  const ends = formatDate(license.ends_on);
  if (license.state === 'suspended') {
    const reason = license.suspended_reason ? ` (${license.suspended_reason})` : '';
    return { severity: 'error', text: `Your organisation's licence is suspended${reason}. You can view and download everything, but nothing can be changed.` };
  }
  if (license.state === 'read_only') {
    return { severity: 'error', text: `Your organisation's licence ended on ${ends}. LSMS is read-only until it is renewed: you can view and download everything, but nothing can be changed.` };
  }
  if (role !== 'admin') return null;
  if (license.state === 'grace') {
    return { severity: 'warning', text: `Your licence ended on ${ends}. Full access continues until ${formatDate(license.grace_ends_on)} while it is renewed; after that LSMS becomes read-only.` };
  }
  if (license.days_left <= WARN_DAYS) {
    const when = license.days_left === 0 ? 'today' : `in ${license.days_left} day${license.days_left === 1 ? '' : 's'}, on ${ends}`;
    const text = license.plan === 'pilot'
      ? `Your pilot ends ${when}. Send an LPO to move to a paid licence and keep full access.`
      : `Your licence ends ${when}. Send the renewal LPO to keep full access.`;
    return { severity: license.days_left <= 30 ? 'warning' : 'info', text };
  }
  return null;
}
