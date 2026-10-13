import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../../api';
import StatCard from '../common/StatCard';
import TenantFormDialog from '../common/TenantFormDialog';
import { errorMessage } from '../../utils/errors';

const sum = (tenants, field) => tenants.reduce((total, t) => total + (t[field] || 0), 0);

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/tenants/');
      setTenants(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = tenants.filter((t) => `${t.name} ${t.industry}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h4">Organisations</Typography>
          <Typography color="text.secondary">Every organisation on the platform.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>New organisation</Button>
      </Box>

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Organisations" value={tenants.length} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Users" value={sum(tenants, 'user_count')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Skills defined" value={sum(tenants, 'skill_count')} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Pending invitations" value={sum(tenants, 'pending_invitation_count')} /></Grid>
      </Grid>

      {error && <Typography color="error" mb={2}>{error}</Typography>}
      {notice && <Typography color="primary" mb={2}>{notice}</Typography>}

      <TextField size="small" placeholder="Search organisations" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 2, width: 300, maxWidth: '100%' }} />
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Industry</TableCell>
              <TableCell align="right">Users</TableCell>
              <TableCell align="right">Org units</TableCell>
              <TableCell align="right">Job roles</TableCell>
              <TableCell align="right">Skills</TableCell>
              <TableCell align="right">Pending invites</TableCell>
              <TableCell>Created</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={8}><Typography color="text.secondary">No organisations yet.</Typography></TableCell></TableRow>
            )}
            {visible.map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/tenants/${t.id}`)}>
                <TableCell><strong>{t.name}</strong></TableCell>
                <TableCell>{t.industry || '—'}</TableCell>
                <TableCell align="right">{t.user_count}</TableCell>
                <TableCell align="right">{t.org_unit_count}</TableCell>
                <TableCell align="right">{t.job_role_count}</TableCell>
                <TableCell align="right">{t.skill_count}</TableCell>
                <TableCell align="right">{t.pending_invitation_count}</TableCell>
                <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <TenantFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(tenant) => {
          setCreating(false);
          setNotice(`Created ${tenant.name}.`);
          load();
        }}
      />
    </Box>
  );
}
