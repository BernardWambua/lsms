import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import api from '../../api';
import { errorMessage } from '../../utils/errors';

// Admins and managers: everyone with a job role, how far their skills have been
// assessed, and a link to review each person's ratings.
export default function TeamRatingsPage() {
  const [institution, setInstitution] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/gaps/institution/')
      .then(({ data }) => setInstitution(data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  if (!institution) return error ? <Typography color="error">{error}</Typography> : null;

  return (
    <Box>
      <Typography variant="h5">Staff ratings</Typography>
      <Typography color="text.secondary" mb={2}>
        Review each person's self ratings and add your manager rating. Manager ratings count over self ratings in gap scores.
      </Typography>
      {institution.staff_without_role > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {institution.staff_without_role} {institution.staff_without_role === 1 ? 'person has' : 'people have'} no job role, so there is nothing to rate them against yet.
        </Alert>
      )}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Staff ratings">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Job role</TableCell>
              <TableCell>Org unit</TableCell>
              <TableCell align="center">Skills assessed</TableCell>
              <TableCell align="center">Skills with a gap</TableCell>
              <TableCell align="center">Gap score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {institution.people.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography color="text.secondary">Nobody to review yet.</Typography></TableCell></TableRow>
            )}
            {institution.people.map((p) => (
              <TableRow key={p.user.id} hover>
                <TableCell><Link component={RouterLink} to={`/ratings/${p.user.id}`}>{p.user.name || p.user.username}</Link></TableCell>
                <TableCell>{p.job_role?.title || '—'}</TableCell>
                <TableCell>{p.org_unit?.name || '—'}</TableCell>
                <TableCell align="center">{p.job_role ? `${p.skills_assessed} of ${p.skills_required}` : '—'}</TableCell>
                <TableCell align="center">{p.job_role ? p.skills_with_gap : '—'}</TableCell>
                <TableCell align="center">{p.gap_score === null ? '—' : `${p.gap_score}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
