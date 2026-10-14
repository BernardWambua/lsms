import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, Grid, Typography } from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import StatCard from '../common/StatCard';
import TenantFormDialog from '../common/TenantFormDialog';
import { errorMessage } from '../../utils/errors';

const NEXT_STEPS = [
  { label: 'Set up org units', help: 'Departments and teams, nested as deep as you need.', to: '/org-units' },
  { label: 'Define job roles', help: 'The positions people hold, placed in an org unit.', to: '/job-roles' },
  { label: 'List skills', help: 'What your roles need, scored for difficulty, use and impact.', to: '/skills' },
  { label: 'Build role profiles', help: 'Open a job role to set the skills it requires and at what level.', to: '/job-roles' },
  { label: 'Invite your team', help: 'Send invitations by email, then place each person in a job role.', to: '/people' },
  { label: 'Run a questionnaire', help: 'Collect self ratings with rating questions linked to skills.', to: '/questionnaires' },
  { label: 'Review ratings', help: 'Add manager ratings, which count over self ratings in gap scores.', to: '/ratings' },
];

// A tenant admin's home: their organisation at a glance and where to go next.
export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tenants/${user.tenant}/`);
      setTenant(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user.tenant]);

  useEffect(() => { load(); }, [load]);

  if (!tenant) return error ? <Typography color="error">{error}</Typography> : null;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">{tenant.name}</Typography>
          <Typography color="text.secondary">{tenant.industry || 'Add your industry in the organisation settings.'}</Typography>
        </Box>
        <Button variant="outlined" onClick={() => setEditing(true)}>Organisation settings</Button>
      </Box>

      <Grid container spacing={2} mb={4}>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="People" value={tenant.user_count} to="/people" /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Org units" value={tenant.org_unit_count} to="/org-units" /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Job roles" value={tenant.job_role_count} to="/job-roles" /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Skills" value={tenant.skill_count} to="/skills" /></Grid>
        <Grid size={{ xs: 12, md: 2.4 }}><StatCard label="Pending invites" value={tenant.pending_invitation_count} to="/people" /></Grid>
      </Grid>

      <Typography variant="h6" mb={2}>Set up your organisation</Typography>
      <Grid container spacing={2}>
        {NEXT_STEPS.map((step) => (
          <Grid key={step.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography fontWeight="bold">{step.label}</Typography>
                <Typography color="text.secondary" mb={2}>{step.help}</Typography>
                <Button size="small" onClick={() => navigate(step.to)}>Open</Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <TenantFormDialog
        open={editing}
        tenant={tenant}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />
    </Box>
  );
}
