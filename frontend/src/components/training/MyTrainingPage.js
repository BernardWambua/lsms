import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import EvaluationDialog from './EvaluationDialog';
import { errorMessage } from '../../utils/errors';
import { levelLabel } from '../../utils/levels';
import { ATTENDANCE, NOMINATION_STATUSES, QUARTERS, dateRange, label } from '../../utils/training';

// Everyone: the training they are nominated to, and an evaluation form for
// the training they attended.
export default function MyTrainingPage() {
  const { user } = useAuth();
  const [nominations, setNominations] = useState(null);
  const [error, setError] = useState('');
  const [evaluating, setEvaluating] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/training-nominations/', { params: { user: user.id } });
      setNominations(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Typography variant="h5">My training</Typography>
      <Typography color="text.secondary" mb={2}>
        Training you are nominated to in the annual training plan. After attending, tell HR how it went.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="My training">
          <TableHead>
            <TableRow>
              <TableCell>Programme</TableCell>
              <TableCell>When</TableCell>
              <TableCell>Why</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Attendance</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {nominations?.length === 0 && (
              <TableRow><TableCell colSpan={6}><Typography color="text.secondary">You are not nominated to any training yet.</Typography></TableCell></TableRow>
            )}
            {nominations?.map((n) => {
              const p = n.programme_detail;
              const attended = ['attended', 'partial'].includes(n.attendance);
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    {p.title}
                    <Typography variant="caption" color="text.secondary" display="block">{[p.provider, p.venue].filter(Boolean).join(' · ') || `FY ${p.period}`}</Typography>
                  </TableCell>
                  <TableCell>{p.start_date ? dateRange(p.start_date, p.end_date) : `${label(QUARTERS, p.quarter)} ${p.period}`}</TableCell>
                  <TableCell>{n.gap ? `${p.skill?.name || 'Skill'}: ${levelLabel(n.current_level)} → ${levelLabel(n.required_level)}` : 'Nominated'}</TableCell>
                  <TableCell>{label(NOMINATION_STATUSES, n.status)}</TableCell>
                  <TableCell>{n.status === 'approved' ? label(ATTENDANCE, n.attendance) : '—'}</TableCell>
                  <TableCell align="right">
                    {attended && (
                      <Button size="small" onClick={() => setEvaluating(n)}>
                        {n.evaluation?.participant_submitted_at ? 'Edit evaluation' : 'Evaluate'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
      {evaluating && <EvaluationDialog nomination={evaluating} mode="participant" onClose={() => setEvaluating(null)} onSaved={() => { setEvaluating(null); load(); }} />}
    </Box>
  );
}
