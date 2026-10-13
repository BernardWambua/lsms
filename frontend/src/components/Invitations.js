import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import api from '../api';
import { errorMessage } from '../utils/errors';

// Invite people into an organisation and revoke pending invitations.
// Tenant admins manage their own; super admins pass `tenantId` to manage any.
function Invitations({ tenantId, defaultRole }) {
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(defaultRole || 'employee');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/invitations/', { params: tenantId ? { tenant: tenantId } : undefined });
      setInvitations(res.data);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Only organisation admins can manage invitations.' : errorMessage(err));
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await api.post('/invitations/', { email, role, ...(tenantId ? { tenant: tenantId } : {}) });
      setNotice(`Invitation sent to ${email}.`);
      setEmail('');
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const revoke = async (id) => {
    try {
      await api.delete(`/invitations/${id}/`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box component="form" onSubmit={invite} display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required sx={{ flex: 1, minWidth: 220 }} />
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value)} sx={{ width: 160 }}>
            <MenuItem value="employee">Employee</MenuItem>
            <MenuItem value="manager">Manager</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
          <Button type="submit" variant="contained">Send invite</Button>
        </Box>
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
        {notice && <Typography color="primary" sx={{ mt: 2 }}>{notice}</Typography>}
      </Paper>
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">No invitations yet.</Typography></TableCell></TableRow>
            )}
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.email}</TableCell>
                <TableCell>{inv.role}</TableCell>
                <TableCell>{inv.status}</TableCell>
                <TableCell>{new Date(inv.expires_at).toLocaleDateString()}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {inv.accept_url && (
                    <Button size="small" onClick={() => navigator.clipboard.writeText(inv.accept_url)}>Copy link</Button>
                  )}
                  {inv.status === 'pending' && <Button size="small" color="error" onClick={() => revoke(inv.id)}>Revoke</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

Invitations.propTypes = {
  tenantId: PropTypes.string,
  defaultRole: PropTypes.string,
};

export default Invitations;
