import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  IconButton, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import { errorMessage } from '../../utils/errors';
import { useTerms } from '../../utils/terms';
import StaffRecordDialog from './StaffRecordDialog';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'employee', label: 'Employee' },
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Never';
}

// People in one organisation. Admins (and super admins) can change roles,
// deactivate and remove people, but never their own account.
export default function UsersTable({ tenantId, canManage }) {
  const { user: me } = useAuth();
  const terms = useTerms();
  const [users, setUsers] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [grades, setGrades] = useState([]);
  const [jobFamilies, setJobFamilies] = useState([]);
  const [recordOf, setRecordOf] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const params = tenantId ? { tenant: tenantId } : undefined;
      const [usersRes, rolesRes, gradesRes, familiesRes] = await Promise.all([
        api.get('/users/', { params }), api.get('/job-roles/', { params }),
        api.get('/grades/', { params }), api.get('/job-families/', { params }),
      ]);
      setUsers(usersRes.data);
      setJobRoles(rolesRes.data);
      setGrades(gradesRes.data);
      setJobFamilies(familiesRes.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const update = async (user, changes) => {
    setError('');
    try {
      await api.patch(`/users/${user.id}/`, changes);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Remove ${user.username}? This deletes their account and ratings.`)) return;
    try {
      await api.delete(`/users/${user.id}/`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <>
      {error && <Typography color="error" mb={2}>{error}</Typography>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{terms.staff_number}</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Job role</TableCell>
              <TableCell>{terms.grade}</TableCell>
              <TableCell>{terms.job_family}</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Last login</TableCell>
              {canManage && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 && (
              <TableRow><TableCell colSpan={10}><Typography color="text.secondary">No people yet.</Typography></TableCell></TableRow>
            )}
            {users.map((u) => {
              const editable = canManage && u.id !== me?.id;
              return (
                <TableRow key={u.id} hover>
                  <TableCell>{u.staff_number || '—'}</TableCell>
                  <TableCell>
                    {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                    <Typography variant="caption" color="text.secondary" display="block">{[u.username, u.email].filter(Boolean).join(' · ')}</Typography>
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <TextField select size="small" value={u.role} onChange={(e) => update(u, { role: e.target.value })} variant="standard">
                        {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                      </TextField>
                    ) : ROLES.find((r) => r.value === u.role)?.label}
                  </TableCell>
                  <TableCell>
                    {editable ? (
                      <TextField
                        select size="small" variant="standard" value={u.job_role || ''}
                        onChange={(e) => update(u, { job_role: e.target.value || null })}
                        slotProps={{ select: { displayEmpty: true }, htmlInput: { 'aria-label': `Job role for ${u.username}` } }}
                      >
                        <MenuItem value=""><em>None</em></MenuItem>
                        {jobRoles.map((r) => <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>)}
                      </TextField>
                    ) : jobRoles.find((r) => r.id === u.job_role)?.title || '—'}
                  </TableCell>
                  <TableCell>{grades.find((g) => g.id === u.grade)?.code || '—'}</TableCell>
                  <TableCell>{jobFamilies.find((f) => f.id === u.job_family)?.name || '—'}</TableCell>
                  <TableCell>
                    <Switch size="small" checked={u.is_active} disabled={!editable} onChange={(e) => update(u, { is_active: e.target.checked })} />
                  </TableCell>
                  <TableCell>{formatDate(u.last_login)}</TableCell>
                  {canManage && (
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Staff record"><IconButton size="small" onClick={() => setRecordOf(u)}><BadgeIcon fontSize="small" /></IconButton></Tooltip>
                      {editable && <Tooltip title="Remove"><IconButton size="small" onClick={() => remove(u)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
      {canManage && (
        <StaffRecordDialog
          person={recordOf} people={users} grades={grades} jobFamilies={jobFamilies}
          onClose={() => setRecordOf(null)} onSaved={() => { setRecordOf(null); load(); }}
        />
      )}
    </>
  );
}

UsersTable.propTypes = {
  tenantId: PropTypes.string,
  canManage: PropTypes.bool,
};
