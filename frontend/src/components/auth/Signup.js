import React, { useState } from 'react';
import api from '../../api';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';

const DEFAULT_TENANT_UUID = '526e1ad2-6f7b-4d31-8ff7-d7ba8f4d6865'; // Replace with your actual default tenant UUID

function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [newTenantName, setNewTenantName] = useState('');
  const [tenantCreated, setTenantCreated] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      // Create user in default tenant
      const userRes = await api.post('/users/', {
        username,
        email,
        password,
        tenant: DEFAULT_TENANT_UUID,
        role: 'employee'
      });
      setSuccess('Signup successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200); // Redirect to login after short delay
    } catch (err) {
      setError('Signup failed. ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const tenantRes = await api.post('/tenants/', { name: newTenantName });
      // Optionally, update user to belong to new tenant and become admin
      setTenantCreated(true);
      setSuccess('Tenant created! You now have access to advanced features.');
    } catch (err) {
      setError('Tenant creation failed. ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh" bgcolor="#f3f4f6">
      <Paper elevation={3} sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" gutterBottom align="center">Sign Up</Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField label="Username" variant="outlined" margin="normal" fullWidth value={username} onChange={e => setUsername(e.target.value)} required />
          <TextField label="Email" variant="outlined" margin="normal" fullWidth value={email} onChange={e => setEmail(e.target.value)} required />
          <TextField label="Password" variant="outlined" margin="normal" fullWidth type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>Sign Up</Button>
        </Box>
        {success && !showCreateTenant && (
          <Button variant="outlined" color="secondary" fullWidth sx={{ mt: 2 }} onClick={() => setShowCreateTenant(true)}>
            Create Organization (Tenant) for Advanced Features
          </Button>
        )}
        {showCreateTenant && !tenantCreated && (
          <Box component="form" onSubmit={handleCreateTenant} sx={{ mt: 2 }}>
            <TextField label="Organization Name" variant="outlined" margin="normal" fullWidth value={newTenantName} onChange={e => setNewTenantName(e.target.value)} required />
            <Button type="submit" variant="contained" color="secondary" fullWidth sx={{ mt: 2 }}>Create Tenant</Button>
          </Box>
        )}
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
        {success && <Typography color="primary" sx={{ mt: 2 }}>{success}</Typography>}
      </Paper>
    </Box>
  );
}

export default Signup;