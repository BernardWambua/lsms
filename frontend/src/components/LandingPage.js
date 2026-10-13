import React from 'react';
import { Box, Typography, Button, Grid, Paper } from '@mui/material';

export default function LandingPage() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f5f6fa', py: 8 }}>
      <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center', mb: 8 }}>
        <Typography variant="h2" fontWeight="bold" gutterBottom>
          Empower Your Team with <span style={{ color: '#1976d2' }}>Learning & Skill Management</span>
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Unlock potential, bridge skill gaps, and drive growth with our all-in-one platform for organizations.
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          sx={{ mt: 4, px: 6, py: 1.5, fontSize: '1.2rem' }}
          href="/register"
        >
          Get Started
        </Button>
      </Box>
      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 4, minHeight: 220 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>
              Skill Tracking
            </Typography>
            <Typography color="text.secondary">
              Monitor employee skills, certifications, and progress in real time. Identify strengths and areas for improvement.
            </Typography>
          </Paper>
        </Grid>
        
      </Grid>
      <Box sx={{ mt: 10, textAlign: 'center' }}>
        <Typography variant="body1" color="text.secondary">
          © {new Date().getFullYear()} Learning and Skill Management System. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}