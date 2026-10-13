import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, CircularProgress } from '@mui/material';
import api from '../../api';
import { errorMessage } from '../../utils/errors';

function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({ username: '', first_name: '', last_name: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get(`/invitations/accept/${token}/`)
      .then((res) => setInvitation(res.data))
      .catch((err) => setLoadError(
        err.response?.status === 404 ? 'This invitation link is not valid.' : errorMessage(err)
      ));
  }, [token]);

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/invitations/accept/${token}/`, form);
      setSuccess('Your account is ready. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="80vh">
      <Paper elevation={3} sx={{ p: 4, width: 380 }}>
        <Typography variant="h5" gutterBottom align="center">Join your organisation</Typography>
        {!invitation && !loadError && <Box textAlign="center"><CircularProgress /></Box>}
        {loadError && <Typography color="error">{loadError}</Typography>}
        {invitation && (
          <>
            <Typography color="text.secondary" align="center">
              You've been invited to <strong>{invitation.tenant_name}</strong> as {invitation.role}.
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <TextField label="Email" margin="normal" fullWidth value={invitation.email} disabled />
              <TextField label="Username" margin="normal" fullWidth value={form.username} onChange={update('username')} required />
              <TextField label="First name" margin="normal" fullWidth value={form.first_name} onChange={update('first_name')} />
              <TextField label="Last name" margin="normal" fullWidth value={form.last_name} onChange={update('last_name')} />
              <TextField label="Password" margin="normal" fullWidth type="password" value={form.password} onChange={update('password')} required />
              <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={!!success}>Create account</Button>
            </Box>
          </>
        )}
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
        {success && <Typography color="primary" sx={{ mt: 2 }}>{success}</Typography>}
      </Paper>
    </Box>
  );
}

export default AcceptInvite;
