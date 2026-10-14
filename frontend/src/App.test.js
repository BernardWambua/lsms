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

const ADMIN = { id: 'u1', username: 'ada', is_superuser: false, tenant: 't1', role: 'admin' };
const EMPLOYEE = { id: 'u2', username: 'bob', first_name: 'Bob', is_superuser: false, tenant: 't1', role: 'employee', job_role: 'r1' };
const MANAGER = { id: 'u3', username: 'meg', is_superuser: false, tenant: 't1', role: 'manager' };

// Like loggedInAs, but also answers requests that carry query parameters, keyed as 'url?name=value'.
function withParams(me, routes) {
  sessionStorage.setItem('access_token', 'token');
  api.get.mockImplementation((url, config) => {
    if (url === '/users/me/') return Promise.resolve({ data: me });
    const query = new URLSearchParams(config?.params || {}).toString();
    const key = query ? `${url}?${query}` : url;
    return Promise.resolve({ data: routes[key] ?? routes[url] ?? [] });
  });
}

const PYTHON = { id: 's1', name: 'Python', type: 'technical', difficulty: 3, impact_if_missing: 5, usage_frequency: 4 };
const EXCEL = { id: 's2', name: 'Excel', type: 'technical', difficulty: 2, impact_if_missing: 2, usage_frequency: 2 };

test('job roles link to a role profile that shows required levels and DIF', async () => {
  window.history.pushState({}, '', '/job-roles/r1');
  withParams(ADMIN, {
    '/job-roles/r1/': { id: 'r1', title: 'Data Officer', org_unit: null, description: '' },
    '/job-role-skills/?job_role=r1': [{ id: 'p1', job_role: 'r1', skill: 's1', required_level: 4, difficulty: null, importance: 2, frequency: null, importance_score: 3 }],
    '/skills/': [PYTHON, EXCEL],
    '/users/': [EMPLOYEE],
  });
  render(<App />);
  const table = await screen.findByRole('table', { name: 'Skill profile' });
  const row = within(table).getByText('Python').closest('tr');
  expect(within(row).getByText('4 · Advanced')).toBeInTheDocument();
  expect(within(row).getByText('2')).toBeInTheDocument();
  expect(screen.getByText('Bob')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /add skill/i }));
  fireEvent.mouseDown(await screen.findByRole('combobox', { name: /^skill/i }));
  const listbox = await screen.findByRole('listbox');
  expect(within(listbox).getByText('Excel')).toBeInTheDocument();
  expect(within(listbox).queryByText('Python')).not.toBeInTheDocument();
});

test('employees see role profiles read-only', async () => {
  window.history.pushState({}, '', '/job-roles/r1');
  withParams(EMPLOYEE, {
    '/job-roles/r1/': { id: 'r1', title: 'Data Officer', org_unit: null, description: '' },
    '/skills/': [PYTHON],
  });
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Data Officer' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /add skill/i })).not.toBeInTheDocument();
});

test('employees rate themselves on My skills', async () => {
  window.history.pushState({}, '', '/my-skills');
  withParams(EMPLOYEE, {
    '/gaps/me/': {
      user: { id: 'u2', username: 'bob', name: 'Bob' }, job_role: { id: 'r1', title: 'Data Officer' }, org_unit: null,
      gap_score: null, skills_required: 1, skills_assessed: 0, skills_with_gap: 0, high_priority_gaps: 0,
      skills: [{ skill: { id: 's1', name: 'Python', type: 'technical' }, required_level: 4, current_level: null, self_rating: null, manager_rating: null, gap: null, priority: 'not_assessed' }],
    },
  });
  api.post.mockResolvedValue({ data: {} });
  render(<App />);
  const table = await screen.findByRole('table', { name: 'My skills' });
  expect(within(table).getByText('Not assessed')).toBeInTheDocument();
  fireEvent.mouseDown(within(table).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: '3 · Intermediate' }));
  fireEvent.click(screen.getByRole('button', { name: /save my ratings/i }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ratings/', expect.objectContaining({ skill: 's1', self_rating: 3 })));
});

test('managers add a manager rating to a self rating', async () => {
  window.history.pushState({}, '', '/ratings/u2');
  withParams(MANAGER, {
    '/gaps/people/u2/': {
      user: { id: 'u2', username: 'bob', name: 'Bob' }, job_role: { id: 'r1', title: 'Data Officer' }, org_unit: null,
      gap_score: 25, skills_required: 1, skills_assessed: 1, skills_with_gap: 1, high_priority_gaps: 0,
      skills: [{ skill: { id: 's1', name: 'Python', type: 'technical' }, required_level: 4, current_level: 3, self_rating: 3, manager_rating: null, gap: 1, priority: 'low' }],
    },
    '/ratings/?user=u2': [{ id: 'rt1', user: 'u2', skill: 's1', self_rating: 3, manager_rating: null, survey_date: '2026-10-01' }],
  });
  api.patch.mockResolvedValue({ data: {} });
  render(<App />);
  const table = await screen.findByRole('table', { name: 'Skill ratings' });
  expect(within(table).getByText('3 · Intermediate')).toBeInTheDocument();
  fireEvent.mouseDown(within(table).getByRole('combobox'));
  fireEvent.click(await screen.findByRole('option', { name: '2 · Basic' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/ratings/rt1/', { manager_rating: 2 }));
});

test('employees cannot open staff ratings', async () => {
  window.history.pushState({}, '', '/ratings');
  loggedInAs(EMPLOYEE);
  render(<App />);
  expect(await screen.findByText(/don't have access/i)).toBeInTheDocument();
});

test('employees answer a questionnaire', async () => {
  window.history.pushState({}, '', '/questionnaires/q1/answer');
  withParams(EMPLOYEE, {
    '/questionnaires/q1/': { id: 'q1', title: 'Annual TNA', org_unit: null },
    '/questions/?questionnaire=q1': [
      { id: 'qa', questionnaire: 'q1', text: 'Rate your Python', question_type: 'rating', skill: 's1' },
      { id: 'qb', questionnaire: 'q1', text: 'Preferred format', question_type: 'choice', skill: null },
    ],
    '/question-choices/?question__questionnaire=q1': [{ id: 1, question: 'qb', text: 'Online' }],
  });
  api.post.mockResolvedValue({ data: {} });
  render(<App />);
  expect(await screen.findByText('1. Rate your Python')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));
  expect(await screen.findByText(/2 still need/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('radio', { name: '4 Advanced' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Online' }));
  fireEvent.click(screen.getByRole('button', { name: /submit answers/i }));
  expect(await screen.findByText(/your answers are saved/i)).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/question-responses/', { question: 'qa', response_rating: 4 });
  expect(api.post).toHaveBeenCalledWith('/question-responses/', { question: 'qb', response_choice: 'Online' });
});

test('admins add questions to a questionnaire', async () => {
  window.history.pushState({}, '', '/questionnaires/q1');
  withParams(ADMIN, {
    '/questionnaires/q1/': { id: 'q1', title: 'Annual TNA', org_unit: null },
    '/skills/': [PYTHON],
  });
  api.post.mockResolvedValue({ data: {} });
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: /add question/i }));
  fireEvent.change(screen.getByRole('textbox', { name: /question/i }), { target: { value: 'Rate your Python' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/questions/', {
    text: 'Rate your Python', question_type: 'rating', skill: null, questionnaire: 'q1',
  }));
});

const TNA_REPORT = {
  title: 'Training Needs Assessment Report',
  institution: { id: 't1', name: 'Acme' },
  scope: { type: 'institution', org_unit: null },
  period: '2026/27',
  generated_at: '2026-10-14T10:00:00+00:00',
  summary: {
    staff: 3, staff_assessed: 2, staff_with_gaps: 1, staff_without_role: 1, assessment_coverage: 75,
    gap_score: 36.4, skills_with_gaps: 1, officers_to_train: 1, high_priority_gaps: 1,
  },
  methodology: ['Gap = required level minus current level.'],
  organisational: [{ org_unit: { id: 'o1', name: 'Finance' }, depth: 0, staff: 2, staff_assessed: 2, staff_with_gaps: 1, assessment_coverage: 75, gap_score: 36.4 }],
  occupational: [{ job_role: { id: 'r1', title: 'Accountant' }, org_unit: { id: 'o1', name: 'Finance' }, staff: 2, staff_assessed: 2, staff_with_gaps: 1, assessment_coverage: 75, gap_score: 36.4, priority_needs: ['IFMIS'] }],
  training_needs: [{ skill: { id: 's1', name: 'IFMIS', type: 'technical' }, staff_requiring: 2, staff_assessed: 2, officers_to_train: 1, high_priority: 1, average_gap: 1, priority_total: 9.34, priority: 'medium' }],
  individuals: [{
    user: { id: 'u2', username: 'alice', name: 'Alice Wanjiku' }, job_role: { id: 'r1', title: 'Accountant' }, org_unit: { id: 'o1', name: 'Finance' },
    gap_score: 36.4, skills_required: 2, skills_assessed: 2, skills_with_gap: 1, high_priority_gaps: 1,
    gaps: [{ skill: { id: 's1', name: 'IFMIS' }, gap: 2 }], not_assessed: [],
  }],
  projections: [{
    skill: { id: 's1', name: 'IFMIS' }, officer: { id: 'u2', username: 'alice', name: 'Alice Wanjiku' }, job_role: { id: 'r1', title: 'Accountant' },
    org_unit: { id: 'o1', name: 'Finance' }, required_level: 4, current_level: 2, rating_source: 'manager', gap: 2, priority_score: 9.34, priority: 'high',
  }],
  recommendations: ['Prioritise training in IFMIS (1 officer) in the training projections for this period.'],
};

test('managers preview the TNA report and can download it', async () => {
  window.history.pushState({}, '', '/reports/tna');
  loggedInAs({ id: 'u1', username: 'mo', is_superuser: false, tenant: 't1', role: 'manager' }, { '/reports/tna/': TNA_REPORT });
  render(<App />);
  expect(await screen.findByRole('heading', { name: '1. Executive summary' })).toBeInTheDocument();
  expect(screen.getByLabelText('Financial year')).toHaveValue('2026/27');
  const projections = screen.getByRole('table', { name: 'Annex: Training projections' });
  expect(within(projections).getByText('Alice Wanjiku')).toBeInTheDocument();
  expect(within(projections).getByText('4 · Advanced')).toBeInTheDocument();
  expect(screen.getByText(/Prioritise training in IFMIS/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Excel' })).toBeEnabled();
});

test('employees cannot open the TNA report', async () => {
  window.history.pushState({}, '', '/reports/tna');
  loggedInAs({ id: 'u3', username: 'eve', is_superuser: false, tenant: 't1', role: 'employee' });
  render(<App />);
  await waitFor(() => expect(screen.queryByRole('heading', { name: /Training Needs Assessment report/ })).not.toBeInTheDocument());
  expect(api.get).not.toHaveBeenCalledWith('/reports/tna/', expect.anything());
});

const PLAN = {
  id: 'p1', period: '2026/27', status: 'draft', budget: '80000.00', title: 'Annual Training Plan 2026/27',
  institution: { id: 't1', name: 'Ministry' },
  summary: { programmes: 1, participants: 2, officers: 2, approved_participants: 1, total_cost: 90000, budget: 80000, balance: -10000 },
  by_quarter: [
    { quarter: 1, label: 'Q1 (Jul-Sep)', programmes: 1, participants: 2, cost: 90000 },
    { quarter: 2, label: 'Q2 (Oct-Dec)', programmes: 0, participants: 0, cost: 0 },
  ],
  by_priority: [],
  by_department: [{ org_unit: { id: 'o1', name: 'Finance' }, participants: 2, cost: 90000 }],
  attendance: { attended: 1, partial: 0, absent: 0, not_recorded: 0, attendance_rate: 100 },
  evaluation: { participant_responses: 1, average_reaction: 4.5, average_relevance: 4, tested: 0, average_learning_gain: null, supervisor_evaluations: 1, gaps_closed: 1 },
  programmes: [{
    id: 'g1', title: 'IFMIS', skill: { id: 's1', name: 'IFMIS' }, provider: 'Kenya School of Government', delivery_mode: 'local', quarter: 1,
    start_date: null, end_date: null, venue: '', duration_days: 5, fee: 20000, allowance_per_day: 5000, fixed_cost: 0, priority: 'high',
    participants: 2, cost_per_participant: 45000, total_cost: 90000, approved: 1, attended: 1,
  }],
};

test('admins see the costed training plan against its budget', async () => {
  window.history.pushState({}, '', '/training-plans/p1');
  loggedInAs({ id: 'u1', username: 'hr', is_superuser: false, tenant: 't1', role: 'admin' }, { '/training-plans/p1/': PLAN });
  render(<App />);
  expect(await screen.findByText(/over the approved budget/)).toHaveTextContent('KES 10,000');
  const programmes = screen.getByRole('table', { name: 'Programmes' });
  expect(within(programmes).getByText('IFMIS')).toBeInTheDocument();
  expect(within(programmes).getByText('KES 45,000')).toBeInTheDocument();
  expect(within(screen.getByRole('table', { name: 'Cost by department' })).getByText('Finance')).toBeInTheDocument();
  expect(screen.getByText('1 of 1 evaluated')).toBeInTheDocument();

  api.post.mockResolvedValueOnce({ data: { ...PLAN, created: { programmes: 0, nominations: 1 } } });
  fireEvent.click(screen.getByRole('button', { name: 'Add from latest gaps' }));
  expect(await screen.findByText(/Added 0 programmes and 1 nomination/)).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/training-plans/p1/generate/');
  expect(screen.getByRole('button', { name: 'Submit for approval' })).toBeInTheDocument();
});

test('managers can read the plan but not change it', async () => {
  window.history.pushState({}, '', '/training-plans/p1');
  loggedInAs({ id: 'u2', username: 'mo', is_superuser: false, tenant: 't1', role: 'manager' }, { '/training-plans/p1/': PLAN });
  render(<App />);
  expect(await screen.findByRole('table', { name: 'Programmes' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add from latest gaps' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add programme' })).not.toBeInTheDocument();
});

test('officers evaluate training they attended on My training', async () => {
  window.history.pushState({}, '', '/my-training');
  const nomination = {
    id: 'n1', user: 'u3', status: 'approved', attendance: 'attended', gap: 2, current_level: 2, required_level: 4, evaluation: null,
    officer: { id: 'u3', username: 'eve', name: 'Eve Achieng' },
    programme_detail: { id: 'g1', title: 'IFMIS', period: '2026/27', quarter: 1, provider: 'KSG', venue: '', skill: { id: 's1', name: 'IFMIS' } },
  };
  sessionStorage.setItem('access_token', 'token');
  api.get.mockImplementation((url) => {
    if (url === '/users/me/') return Promise.resolve({ data: { id: 'u3', username: 'eve', is_superuser: false, tenant: 't1', role: 'employee' } });
    if (url === '/training-nominations/') return Promise.resolve({ data: [nomination] });
    return Promise.resolve({ data: [] });
  });
  api.post.mockResolvedValue({ data: {} });
  render(<App />);
  const table = await screen.findByRole('table', { name: 'My training' });
  expect(await within(table).findByText('IFMIS: 2 · Basic → 4 · Advanced')).toBeInTheDocument();
  fireEvent.click(within(table).getByRole('button', { name: 'Evaluate' }));
  fireEvent.click(await screen.findByLabelText('5 Stars', { selector: 'input[name="How good was the training overall?"]' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/training-nominations/n1/evaluation/', expect.objectContaining({ reaction_rating: 5 })));
});

test('employees cannot open training plans', async () => {
  window.history.pushState({}, '', '/training-plans');
  loggedInAs({ id: 'u3', username: 'eve', is_superuser: false, tenant: 't1', role: 'employee' });
  render(<App />);
  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Training plans' })).not.toBeInTheDocument());
  expect(api.get).not.toHaveBeenCalledWith('/training-plans/');
});
