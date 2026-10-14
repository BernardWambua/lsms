import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Grid, Paper } from '@mui/material';
import { useAuth } from './auth/authContext';

const SECTIONS = [
  { title: 'My skills', text: 'What your role requires, your self ratings and your skill gaps.', to: '/my-skills' },
  { title: 'Questionnaires', text: 'Skill assessments to fill in.', to: '/questionnaires' },
  { title: 'Staff ratings', text: 'Review your staff\'s self ratings and add your own.', to: '/ratings', roles: ['manager'] },
  { title: 'Job roles', text: 'Browse the roles in each unit and the skills they require.', to: '/job-roles' },
];

// Home for managers and employees.
export default function LandingPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  return (
    <Box>
      <Box sx={{ maxWidth: 900, mx: 'auto', textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          Welcome{user?.first_name ? `, ${user.first_name}` : ''}
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Unlock potential, bridge skill gaps, and drive growth with Learning & Skill Management.
        </Typography>
      </Box>
      <Grid container spacing={3} justifyContent="center">
        {SECTIONS.filter((section) => !section.roles || section.roles.includes(role)).map((section) => (
          <Grid key={section.to} size={{ xs: 12, md: 4 }}>
            <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>{section.title}</Typography>
              <Typography color="text.secondary" mb={2}>{section.text}</Typography>
              <Button onClick={() => navigate(section.to)}>Open</Button>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
