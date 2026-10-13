import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Grid, Link, Tab, Tabs, Typography } from '@mui/material';
import api from '../../api';
import StatCard from '../common/StatCard';
import ResourcePage from '../common/ResourcePage';
import TenantFormDialog from '../common/TenantFormDialog';
import UsersTable from '../common/UsersTable';
import Invitations from '../Invitations';
import { JOB_ROLES, ORG_UNITS, SKILLS } from '../structure/resources';
import { errorMessage } from '../../utils/errors';

// A super admin's view of one organisation: its people and invitations
// (manageable) and its structure (read-only).
export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [tab, setTab] = useState('people');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/tenants/${id}/`);
      setTenant(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    const typed = window.prompt(`This permanently deletes ${tenant.name} and all of its users and data. Type the organisation's name to confirm.`);
    if (typed !== tenant.name) return;
    try {
      await api.delete(`/tenants/${id}/`);
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!tenant) return error ? <Typography color="error">{error}</Typography> : null;

  const params = { tenant: id };

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component="button" underline="hover" onClick={() => navigate('/')}>Organisations</Link>
        <Typography color="text.primary">{tenant.name}</Typography>
      </Breadcrumbs>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">{tenant.name}</Typography>
          <Typography color="text.secondary">
            {tenant.industry || 'No industry set'} · created {new Date(tenant.created_at).toLocaleDateString()}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" onClick={() => setEditing(true)}>Edit details</Button>
          <Button variant="outlined" color="error" onClick={remove}>Delete organisation</Button>
        </Box>
      </Box>
      {error && <Typography color="error" mb={2}>{error}</Typography>}

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Users" value={tenant.user_count} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Org units" value={tenant.org_unit_count} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Job roles" value={tenant.job_role_count} /></Grid>
        <Grid size={{ xs: 6, md: 2.4 }}><StatCard label="Skills" value={tenant.skill_count} /></Grid>
        <Grid size={{ xs: 12, md: 2.4 }}><StatCard label="Pending invites" value={tenant.pending_invitation_count} /></Grid>
      </Grid>

      <Tabs value={tab} onChange={(e, value) => setTab(value)} sx={{ mb: 2 }} variant="scrollable">
        <Tab value="people" label="People" />
        <Tab value="invitations" label="Invitations" />
        <Tab value="org-units" label="Org units" />
        <Tab value="job-roles" label="Job roles" />
        <Tab value="skills" label="Skills" />
      </Tabs>

      {tab === 'people' && <UsersTable tenantId={id} canManage />}
      {tab === 'invitations' && <Invitations tenantId={id} defaultRole={tenant.user_count === 0 ? 'admin' : 'employee'} />}
      {tab === 'org-units' && <ResourcePage {...ORG_UNITS} params={params} readOnly />}
      {tab === 'job-roles' && <ResourcePage {...JOB_ROLES} params={params} readOnly />}
      {tab === 'skills' && <ResourcePage {...SKILLS} params={params} readOnly />}

      <TenantFormDialog
        open={editing}
        tenant={tenant}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); load(); }}
      />
    </Box>
  );
}
