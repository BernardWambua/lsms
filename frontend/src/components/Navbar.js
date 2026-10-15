import * as React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './auth/authContext';

const LINKS = {
  superadmin: [{ to: '/', label: 'Organisations' }],
  admin: [
    { to: '/', label: 'Dashboard' },
    { to: '/org-structure', label: 'Org structure' },
    { to: '/org-units', label: 'Org units' },
    { to: '/job-roles', label: 'Job roles' },
    { to: '/skills', label: 'Skills' },
    { to: '/questionnaires', label: 'Questionnaires' },
    { to: '/ratings', label: 'Ratings' },
    { to: '/reports/tna', label: 'TNA report' },
    { to: '/training-plans', label: 'Training plan' },
    { to: '/people', label: 'People' },
    { to: '/classification', label: 'Classification' },
    { to: '/imports', label: 'Import' },
  ],
  manager: [
    { to: '/', label: 'Home' },
    { to: '/my-skills', label: 'My skills' },
    { to: '/my-training', label: 'My training' },
    { to: '/questionnaires', label: 'Questionnaires' },
    { to: '/ratings', label: 'Staff ratings' },
    { to: '/reports/tna', label: 'TNA report' },
    { to: '/training-plans', label: 'Training plan' },
    { to: '/job-roles', label: 'Job roles' },
    { to: '/skills', label: 'Skills' },
    { to: '/org-units', label: 'Org units' },
  ],
  employee: [
    { to: '/', label: 'Home' },
    { to: '/my-skills', label: 'My skills' },
    { to: '/my-training', label: 'My training' },
    { to: '/questionnaires', label: 'Questionnaires' },
    { to: '/job-roles', label: 'Job roles' },
    { to: '/skills', label: 'Skills' },
    { to: '/org-units', label: 'Org units' },
  ],
};

const ROLE_LABELS = { superadmin: 'Super admin', admin: 'Admin', manager: 'Manager', employee: 'Employee' };

export default function Navbar() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" component="div" sx={{ cursor: 'pointer', mr: 2 }} onClick={() => navigate('/')}>
          LSMS
        </Typography>
        <Box sx={{ flexGrow: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(LINKS[role] || []).map((link) => (
            <Button
              key={link.to}
              component={NavLink}
              to={link.to}
              end={link.to === '/'}
              color="inherit"
              sx={{ '&.active': { bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              {link.label}
            </Button>
          ))}
        </Box>
        {user ? (
          <>
            <Typography variant="body1">{user.username}</Typography>
            <Chip size="small" label={ROLE_LABELS[role]} sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'inherit' }} />
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </>
        ) : (
          <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>
        )}
      </Toolbar>
    </AppBar>
  );
}
