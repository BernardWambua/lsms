import { useMemo } from 'react';
import { useAuth } from '../components/auth/authContext';

// LSMS's generic wording. The organisation's own words (e.g. "Job Group" for
// grade) come from the server with the logged-in user and override these.
export const DEFAULT_TERMS = {
  organisation: 'Organisation',
  org_unit: 'Department',
  staff_number: 'Staff number',
  grade: 'Grade',
  grades: 'Grades',
  job_family: 'Job family',
  job_families: 'Job families',
  competency_framework: 'Competency framework',
  competency_frameworks: 'Competency frameworks',
};

export function useTerms() {
  const { user } = useAuth() || {};
  const own = user?.terms;
  return useMemo(() => ({ ...DEFAULT_TERMS, ...(own || {}) }), [own]);
}
