import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from './authContext';

// Renders children only for logged-in users with one of the given roles
// (any role when `roles` is omitted).
export default function RequireRole({ roles, children }) {
  const { user, role, loading } = useAuth();
  if (loading) {
    return <Box textAlign="center" mt={8}><CircularProgress /></Box>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(role)) {
    return <Typography sx={{ m: 4 }}>You don't have access to this page.</Typography>;
  }
  return children;
}

RequireRole.propTypes = {
  roles: PropTypes.arrayOf(PropTypes.string),
  children: PropTypes.node.isRequired,
};
