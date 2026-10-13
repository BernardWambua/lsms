import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  IconButton, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import { errorMessage } from '../../utils/errors';

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
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/', { params: tenantId ? { tenant: tenantId } : undefined });
      setUsers(data);
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
              <TableCell>Username</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Active</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Last login</TableCell>
              {canManage && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 && (
              <TableRow><TableCell colSpan={8}><Typography color="text.secondary">No people yet.</Typography></TableCell></TableRow>
            )}
            {users.map((u) => {
              const editable = canManage && u.id !== me?.id;
              return (
                <TableRow key={u.id} hover>
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}</TableCell>
                  <TableCell>{u.email || '—'}</TableCell>
                  <TableCell>
                    {editable ? (
                      <TextField select size="small" value={u.role} onChange={(e) => update(u, { role: e.target.value })} variant="standard">
                        {ROLES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                      </TextField>
                    ) : ROLES.find((r) => r.value === u.role)?.label}
                  </TableCell>
                  <TableCell>
                    <Switch size="small" checked={u.is_active} disabled={!editable} onChange={(e) => update(u, { is_active: e.target.checked })} />
                  </TableCell>
                  <TableCell>{formatDate(u.date_joined)}</TableCell>
                  <TableCell>{formatDate(u.last_login)}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      {editable && <Tooltip title="Remove"><IconButton size="small" onClick={() => remove(u)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </>
  );
}

UsersTable.propTypes = {
  tenantId: PropTypes.string,
  canManage: PropTypes.bool,
};
