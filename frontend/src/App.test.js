import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from './api';
import App from './App';

jest.mock('./api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  clearTokens: jest.fn(),
}));

const TENANT = {
  id: 't1', name: 'Acme', industry: 'Retail', created_at: '2026-01-01T00:00:00Z',
  user_count: 3, org_unit_count: 2, job_role_count: 4, skill_count: 5, pending_invitation_count: 1,
};

function loggedInAs(me, routes = {}) {
  sessionStorage.setItem('access_token', 'token');
  api.get.mockImplementation((url) => {
    if (url === '/users/me/') return Promise.resolve({ data: me });
    return Promise.resolve({ data: routes[url] ?? [] });
  });
}

beforeEach(() => {
  sessionStorage.clear();
  window.history.pushState({}, '', '/');
  jest.clearAllMocks();
});

test('shows the welcome page with login, and no public sign up, to logged-out visitors', () => {
  render(<App />);
  expect(screen.getByText(/welcome to lsms/i)).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /login/i }).length).toBeGreaterThan(0);
  expect(screen.queryByRole('button', { name: /sign up/i })).not.toBeInTheDocument();
});

test('super admins land on the list of every organisation', async () => {
  loggedInAs({ id: 'u0', username: 'root', is_superuser: true, tenant: null, role: 'employee' }, { '/tenants/': [TENANT] });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Organisations' })).toBeInTheDocument();
  const row = (await screen.findByText('Acme')).closest('tr');
  expect(within(row).getByText('Retail')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /new organisation/i })).toBeInTheDocument();
  expect(screen.getByText('Super admin')).toBeInTheDocument();
});

test('tenant admins land on their organisation dashboard with setup links', async () => {
  loggedInAs({ id: 'u1', username: 'ada', is_superuser: false, tenant: 't1', role: 'admin' }, { '/tenants/t1/': TENANT });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Acme' })).toBeInTheDocument();
  expect(screen.getByText('Set up org units')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'People' })).toBeInTheDocument();
});

test('tenant admins can add org units', async () => {
  window.history.pushState({}, '', '/org-units');
  loggedInAs({ id: 'u1', username: 'ada', is_superuser: false, tenant: 't1', role: 'admin' }, {
    '/org-units/': [{ id: 'o1', name: 'Engineering', parent: null }, { id: 'o2', name: 'Platform', parent: 'o1' }],
  });
  render(<App />);
  expect(await screen.findByRole('button', { name: /add org unit/i })).toBeInTheDocument();
  const platform = (await screen.findByText('Platform')).closest('tr');
  expect(within(platform).getByText('Engineering')).toBeInTheDocument();
});

test('employees see org units read-only', async () => {
  window.history.pushState({}, '', '/org-units');
  loggedInAs({ id: 'u2', username: 'bob', is_superuser: false, tenant: 't1', role: 'employee' }, {
    '/org-units/': [{ id: 'o1', name: 'Engineering', parent: null }],
  });
  render(<App />);
  expect(await screen.findByText('Engineering')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /add org unit/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'People' })).not.toBeInTheDocument();
});

const STRUCTURE = {
  tenant: { id: 't1', name: 'Acme' },
  units: [{
    id: 'o1', name: 'Engineering', job_roles: [{ id: 'r1', title: 'CTO', description: '' }],
    children: [{ id: 'o2', name: 'Platform', job_roles: [{ id: 'r2', title: 'SRE', description: 'Keeps things up' }], children: [] }],
  }],
  unassigned_job_roles: [{ id: 'r3', title: 'Floating role', description: '' }],
};

test('tenant admins see the org structure as a tree and can switch to an org chart', async () => {
  window.history.pushState({}, '', '/org-structure');
  loggedInAs({ id: 'u1', username: 'ada', is_superuser: false, tenant: 't1', role: 'admin' }, { '/org-structure/': STRUCTURE });
  render(<App />);
  const tree = await screen.findByRole('list', { name: 'Org structure tree' });
  expect(within(tree).getByText('SRE')).toBeInTheDocument();
  expect(screen.getByText('Floating role')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  await waitFor(() => expect(within(tree).queryByText('Platform')).not.toBeInTheDocument());

  fireEvent.click(screen.getByRole('button', { name: 'Org chart view' }));
  const chart = screen.getByLabelText('Org chart');
  expect(within(chart).getByText('Platform')).toBeInTheDocument();
  expect(within(chart).getByText('CTO')).toBeInTheDocument();
  expect(window.location.search).toBe('?view=chart');
});

test('employees cannot open the org structure page', async () => {
  window.history.pushState({}, '', '/org-structure');
  loggedInAs({ id: 'u2', username: 'bob', is_superuser: false, tenant: 't1', role: 'employee' });
  render(<App />);
  expect(await screen.findByText(/don't have access/i)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith('/org-structure/');
});
