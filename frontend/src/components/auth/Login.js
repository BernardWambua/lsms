import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import { useAuth } from './authContext';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { user, login } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (error) {
      setError('Login failed. Please check your credentials.');
    }
  };

  return (
    <Box display="flex" alignItems="center" justifyContent="center" minHeight="80vh">
      <Paper elevation={3} sx={{ p: 4, width: 350 }}>
        <Typography variant="h5" component="h1" gutterBottom align="center">
          Login
        </Typography>
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Username"
            variant="outlined"
            margin="normal"
            fullWidth
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
            required
          />
          <TextField
            label="Password"
            variant="outlined"
            margin="normal"
            fullWidth
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 2 }}
          >
            Login
          </Button>
        </Box>
        {error && <Typography color="error" sx={{ mt: 2 }}>{error}</Typography>}
      </Paper>
    </Box>
  );
}

export default Login;
