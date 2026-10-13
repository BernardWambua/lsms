import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#e3eafc', py: 8 }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mb: 8 }}>
        <Paper elevation={3} sx={{ p: 5 }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Welcome to LSMS
          </Typography>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            The Learning and Skill Management Solution for Modern Organizations
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            Track skills, manage training, and empower your team. Accounts are by invitation: use the link
            your organisation's admin sent you, or log in if you already have an account.
          </Typography>
          <Box sx={{ mt: 4 }}>
            <Button variant="contained" color="primary" onClick={() => navigate('/login')}>
              Login
            </Button>
          </Box>
        </Paper>
      </Box>
      <Box sx={{ textAlign: 'center', mt: 10 }}>
        <Typography variant="body2" color="text.secondary">
          © {new Date().getFullYear()} LSMS. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
