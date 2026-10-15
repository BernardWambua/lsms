// Form and table definitions for the organisation-structure pages, shared by
// the tenant admin pages and the super admin's read-only tenant view.
// Definitions that name a grade, job family or framework are functions of the
// organisation's wording (see utils/terms), so a ministry sees "Job Group".

import { DEFAULT_TERMS } from '../../utils/terms';

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

export const jobRoles = (terms) => ({
  title: 'Job roles',
  description: 'Positions in the organisation and the unit they belong to. Open a role to set the skills it requires.',
  endpoint: '/job-roles/',
  itemName: 'job role',
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'org_unit', label: 'Org unit', type: 'select', optionsFrom: '/org-units/' },
    { name: 'grade', label: terms.grade, type: 'select', optionsFrom: '/grades/', optionLabel: 'code' },
    { name: 'job_family', label: terms.job_family, type: 'select', optionsFrom: '/job-families/' },
    { name: 'description', label: 'Description', type: 'multiline' },
  ],
  columns: [
    { field: 'title', label: 'Title' },
    { field: 'org_unit', label: 'Org unit' },
    { field: 'grade', label: terms.grade },
    { field: 'job_family', label: terms.job_family },
  ],
});

export const JOB_ROLES = jobRoles(DEFAULT_TERMS);

export const SKILL_TYPES = [
  { value: 'core', label: 'Core' },
  { value: 'functional', label: 'Functional' },
  { value: 'technical', label: 'Technical' },
  { value: 'leadership', label: 'Leadership' },
  { value: 'soft', label: 'Soft' },
];

export const skills = (terms) => ({
  title: 'Skills',
  description: "The skills and competencies your roles need. A skill's scores are the default DIF (difficulty, importance, frequency) for every role that requires it.",
  endpoint: '/skills/',
  itemName: 'skill',
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'type', label: 'Category', type: 'select', required: true, default: 'technical', choices: SKILL_TYPES },
    { name: 'framework', label: terms.competency_framework, type: 'select', optionsFrom: '/competency-frameworks/' },
    { name: 'code', label: 'Code', help: "The competency's code in its framework." },
    { name: 'description', label: 'Description', type: 'multiline' },
    { name: 'difficulty', label: 'Difficulty', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
    { name: 'usage_frequency', label: 'Frequency of use', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
    { name: 'impact_if_missing', label: 'Importance (impact if missing)', type: 'number', required: true, min: 1, max: 5, default: 3, help: SCORE_HELP },
  ],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'code', label: 'Code' },
    { field: 'type', label: 'Category' },
    { field: 'framework', label: terms.competency_framework },
    { field: 'difficulty', label: 'Difficulty' },
    { field: 'impact_if_missing', label: 'Importance' },
    { field: 'usage_frequency', label: 'Frequency' },
  ],
});

export const SKILLS = skills(DEFAULT_TERMS);

export const grades = (terms) => ({
  title: terms.grades,
  description: `Salary grades from junior to senior. Rank orders them; aliases are other codes your HR system may use for the same ${terms.grade.toLowerCase()}.`,
  endpoint: '/grades/',
  itemName: terms.grade.toLowerCase(),
  fields: [
    { name: 'code', label: 'Code', required: true },
    { name: 'name', label: 'Name' },
    { name: 'rank', label: 'Rank', type: 'number', min: 0, default: 0, help: 'Higher is more senior.' },
  ],
  columns: [
    { field: 'code', label: 'Code' },
    { field: 'name', label: 'Name' },
    { field: 'rank', label: 'Rank' },
    { field: 'staff_count', label: 'Staff' },
  ],
});

export const jobFamilies = (terms) => ({
  title: terms.job_families,
  description: 'Occupational groups your staff belong to.',
  endpoint: '/job-families/',
  itemName: terms.job_family.toLowerCase(),
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'code', label: 'Code' },
    { name: 'description', label: 'Description', type: 'multiline' },
  ],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'code', label: 'Code' },
    { field: 'staff_count', label: 'Staff' },
  ],
});

export const frameworks = (terms) => ({
  title: terms.competency_frameworks,
  description: 'Published sets of competencies your skills come from. Load one, with each post\'s required levels, from the Import page.',
  endpoint: '/competency-frameworks/',
  itemName: terms.competency_framework.toLowerCase(),
  fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'issuer', label: 'Issued by' },
    { name: 'version', label: 'Version' },
    { name: 'description', label: 'Description', type: 'multiline' },
  ],
  columns: [
    { field: 'name', label: 'Name' },
    { field: 'issuer', label: 'Issued by' },
    { field: 'version', label: 'Version' },
    { field: 'skill_count', label: 'Competencies' },
  ],
});

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
