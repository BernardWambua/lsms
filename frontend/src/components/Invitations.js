import React, { useCallback, useEffect, useState } from 'react';
import {
  Box, Button, MenuItem, Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import api from '../api';

function firstError(data) {
  if (!data) return '';
  if (data.detail) return data.detail;
  const messages = Object.values(data)[0];
  return Array.isArray(messages) ? messages[0] : String(messages);
}

// Tenant admins invite people to their organisation and revoke pending invitations.
function Invitations() {
  const [invitations, setInvitations] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('employee');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/invitations/');
      setInvitations(res.data);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Only organisation admins can manage invitations.' : firstError(err.response?.data) || err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      await api.post('/invitations/', { email, role });
      setNotice(`Invitation sent to ${email}.`);
      setEmail('');
      load();
    } catch (err) {
      setError(firstError(err.response?.data) || err.message);
    }
  };

  const revoke = async (id) => {
    await api.delete(`/invitations/${id}/`);
    load();
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', py: 4 }}>
      <Typography variant="h4" gutterBottom>Invite people</Typography>
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
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Link</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell>{inv.email}</TableCell>
                <TableCell>{inv.role}</TableCell>
                <TableCell>{inv.status}</TableCell>
                <TableCell>
                  {inv.accept_url && (
                    <Button size="small" onClick={() => navigator.clipboard.writeText(inv.accept_url)}>Copy link</Button>
                  )}
                </TableCell>
                <TableCell>
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

export default Invitations;
