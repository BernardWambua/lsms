// Form and table definitions for the organisation-structure pages, shared by
// the tenant admin pages and the super admin's read-only tenant view.

const SCORE_HELP = '1 (low) to 5 (high)';

export const ORG_UNITS = {
  title: 'Org units',
  description: 'Departments and teams. Nest units by picking a parent.',
  endpoint: '/org-units/',
  itemName: 'org unit',
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'parent', label: 'Parent unit', type: 'select', optionsFrom: '/org-units/', excludeSelf: true },
  ],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'parent', label: 'Parent unit' },
  ],
};

export const JOB_ROLES = {
  title: 'Job roles',
  description: 'Positions in the organisation and the unit they belong to. Open a role to set the skills it requires.',
  endpoint: '/job-roles/',
  itemName: 'job role',
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'org_unit', label: 'Org unit', type: 'select', optionsFrom: '/org-units/' },
    { name: 'description', label: 'Description', type: 'multiline' },
  ],
  columns: [
    { field: 'title', label: 'Title' },
    { field: 'org_unit', label: 'Org unit' },
    { field: 'description', label: 'Description' },
  ],
};

export const SKILLS = {
  title: 'Skills',
  description: "The skills your roles need. A skill's scores are the default DIF (difficulty, importance, frequency) for every role that requires it.",
  endpoint: '/skills/',
  itemName: 'skill',
  fields: [
    { name: 'name', label: 'Name', required: true },
    {
      name: 'type', label: 'Type', type: 'select', required: true, default: 'technical',
      choices: [{ value: 'technical', label: 'Technical' }, { value: 'soft', label: 'Soft' }],
    },
    { name: 'description', label: 'Description', type: 'multiline' },
    { name: 'difficulty', label: 'Difficulty', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
    { name: 'usage_frequency', label: 'Frequency of use', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
    { name: 'impact_if_missing', label: 'Importance (impact if missing)', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
  ],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'type', label: 'Type' },
    { field: 'difficulty', label: 'Difficulty' },
    { field: 'impact_if_missing', label: 'Importance' },
    { field: 'usage_frequency', label: 'Frequency' },
  ],
};

export const QUESTIONNAIRES = {
  title: 'Questionnaires',
  description: 'Skill assessments for your staff. Rating questions linked to a skill record each person\'s self rating.',
  endpoint: '/questionnaires/',
  itemName: 'questionnaire',
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'org_unit', label: 'For org unit', type: 'select', optionsFrom: '/org-units/', help: 'Leave blank for everyone.' },
  ],
  columns: [
    { field: 'title', label: 'Title' },
    { field: 'org_unit', label: 'For org unit' },
  ],
};
