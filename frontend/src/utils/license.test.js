import { bannerFor, formatDate } from './license';

const LICENSE = {
  plan: 'standard', state: 'active', ends_on: '2027-06-30', grace_ends_on: '2027-07-30', days_left: 200, suspended_reason: '',
};

test('formats dates the way the reports do', () => {
  expect(formatDate('2027-06-30')).toBe('30 Jun 2027');
});

test('no banner while the licence has plenty of time left, or before it loads', () => {
  expect(bannerFor(LICENSE, 'admin')).toBeNull();
  expect(bannerFor(null, 'admin')).toBeNull();
  expect(bannerFor([], 'admin')).toBeNull();
});

test('admins are reminded before the licence ends, more urgently in the last 30 days', () => {
  expect(bannerFor({ ...LICENSE, days_left: 45 }, 'admin')).toEqual({
    severity: 'info', text: 'Your licence ends in 45 days, on 30 Jun 2027. Send the renewal LPO to keep full access.',
  });
  expect(bannerFor({ ...LICENSE, days_left: 7, plan: 'pilot' }, 'admin').text).toMatch(/^Your pilot ends in 7 days/);
  expect(bannerFor({ ...LICENSE, days_left: 7 }, 'admin').severity).toBe('warning');
  expect(bannerFor({ ...LICENSE, days_left: 7 }, 'employee')).toBeNull();
});

test('the grace period warns admins only', () => {
  const grace = { ...LICENSE, state: 'grace', days_left: -5 };
  expect(bannerFor(grace, 'admin').text).toMatch(/Full access continues until 30 Jul 2027/);
  expect(bannerFor(grace, 'manager')).toBeNull();
});

test('everyone is told when LSMS is read-only or suspended', () => {
  expect(bannerFor({ ...LICENSE, state: 'read_only' }, 'employee')).toMatchObject({ severity: 'error' });
  expect(bannerFor({ ...LICENSE, state: 'suspended', suspended_reason: 'invoice overdue' }, 'manager').text)
    .toMatch(/suspended \(invoice overdue\)/);
});
