import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Autocomplete, Box, Breadcrumbs, Button, Grid, IconButton, Link, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import PriorityChip from '../common/PriorityChip';
import StatCard from '../common/StatCard';
import EvaluationDialog from './EvaluationDialog';
import ProgrammeDialog from './ProgrammeDialog';
import { errorMessage } from '../../utils/errors';
import { fullName, levelLabel } from '../../utils/levels';
import { ATTENDANCE, DELIVERY_MODES, NOMINATION_STATUSES, QUARTERS, dateRange, kes, label } from '../../utils/training';

// One programme: its details and cost, the officers nominated to it, their
// attendance, and the evaluation of the training.
export default function ProgrammePage() {
  const { id } = useParams();
  const { user: me, role } = useAuth();
  const isAdmin = role === 'admin';
  const [programme, setProgramme] = useState(null);
  const [nominations, setNominations] = useState([]);
  const [people, setPeople] = useState([]);
  const [nominee, setNominee] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [evaluating, setEvaluating] = useState(null);

  const load = useCallback(async () => {
    try {
      const [programmeRes, nominationsRes] = await Promise.all([
        api.get(`/training-programmes/${id}/`),
        api.get('/training-nominations/', { params: { programme: id } }),
      ]);
      setProgramme(programmeRes.data);
      setNominations(nominationsRes.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/users/').then(({ data }) => setPeople(data)).catch(() => setPeople([]));
  }, []);

  const act = async (request) => {
    setError('');
    try {
      await request();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const update = (nomination, changes) => act(() => api.patch(`/training-nominations/${nomination.id}/`, changes));
  const nominate = () => act(async () => {
    await api.post('/training-nominations/', { programme: id, user: nominee.id });
    setNominee(null);
  });
  const approveAll = () => act(() => Promise.all(
    nominations.filter((n) => n.status === 'proposed').map((n) => api.patch(`/training-nominations/${n.id}/`, { status: 'approved' })),
  ));

  if (!programme) return error ? <Alert severity="error">{error}</Alert> : null;
  const nominated = new Set(nominations.map((n) => n.user));
  const candidates = people.filter((p) => p.is_active && !nominated.has(p.id));
  const proposed = nominations.filter((n) => n.status === 'proposed').length;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/training-plans">Training plans</Link>
        <Link component={RouterLink} to={`/training-plans/${programme.plan}`}>{programme.plan_period}</Link>
        <Typography color="text.primary">{programme.title}</Typography>
      </Breadcrumbs>
      <Stack direction="row" alignItems="center" mb={1}>
        <Typography variant="h5" flexGrow={1}>{programme.title}</Typography>
        {isAdmin && <Button onClick={() => setEditing(true)}>Edit programme</Button>}
      </Stack>
      <Typography color="text.secondary" mb={2}>
        {[programme.skill_name && `Skill: ${programme.skill_name}`, label(QUARTERS, programme.quarter), label(DELIVERY_MODES, programme.delivery_mode),
          programme.provider, programme.venue, dateRange(programme.start_date, programme.end_date), `${programme.duration_days} days`].filter((v) => v && v !== '—').join(' · ')}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Participants" value={programme.participants} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Cost per officer" value={kes(programme.cost_per_participant)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Fixed cost" value={kes(programme.fixed_cost)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Total cost" value={kes(programme.total_cost)} /></Grid>
      </Grid>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} mb={1}>
        <Typography variant="h6" flexGrow={1}>Nominated officers</Typography>
        {isAdmin && proposed > 0 && <Button onClick={approveAll}>Approve all proposed ({proposed})</Button>}
        <Autocomplete
          size="small"
          sx={{ minWidth: 260 }}
          options={candidates}
          value={nominee}
          onChange={(e, value) => setNominee(value)}
          getOptionLabel={(p) => fullName(p)}
          renderInput={(params) => <TextField {...params} label="Nominate an officer" />}
        />
        <Button variant="contained" disabled={!nominee} onClick={nominate}>{isAdmin ? 'Nominate' : 'Propose'}</Button>
      </Stack>
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Nominated officers">
          <TableHead>
            <TableRow>
              <TableCell>Officer</TableCell>
              <TableCell>Gap (current → required)</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Attendance</TableCell>
              <TableCell>Participant rating</TableCell>
              <TableCell>Level after training</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {nominations.length === 0 && (
              <TableRow><TableCell colSpan={7}><Typography color="text.secondary">Nobody is nominated yet.</Typography></TableCell></TableRow>
            )}
            {nominations.map((n) => {
              const ev = n.evaluation;
              const canEvaluate = ['attended', 'partial'].includes(n.attendance) && n.user !== me.id;
              return (
                <TableRow key={n.id}>
                  <TableCell>
                    {n.officer.name || n.officer.username}
                    <Typography variant="caption" color="text.secondary" display="block">
                      {[n.officer.job_role?.title, n.officer.org_unit?.name].filter(Boolean).join(' · ') || 'No job role'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {n.gap ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{levelLabel(n.current_level)} → {levelLabel(n.required_level)}</span>
                        <PriorityChip priority={n.priority} />
                      </Stack>
                    ) : <Typography component="span" color="text.secondary">Nominated</Typography>}
                  </TableCell>
                  <TableCell sx={{ minWidth: 140 }}>
                    {isAdmin ? (
                      <TextField select size="small" variant="standard" fullWidth value={n.status}
                        onChange={(e) => update(n, { status: e.target.value, ...(e.target.value !== 'approved' && { attendance: 'not_recorded', days_attended: null }) })}
                        slotProps={{ htmlInput: { 'aria-label': `Status for ${n.officer.username}` } }}>
                        {NOMINATION_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                      </TextField>
                    ) : label(NOMINATION_STATUSES, n.status)}
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    {n.status === 'approved' ? (
                      <TextField select size="small" variant="standard" fullWidth value={n.attendance}
                        onChange={(e) => update(n, { attendance: e.target.value })}
                        slotProps={{ htmlInput: { 'aria-label': `Attendance for ${n.officer.username}` } }}>
                        {ATTENDANCE.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
                      </TextField>
                    ) : <Typography component="span" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell>{ev?.reaction_rating ? `${ev.reaction_rating} / 5` : '—'}</TableCell>
                  <TableCell>{ev?.post_training_level ? levelLabel(ev.post_training_level) : '—'}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {canEvaluate && <Button size="small" onClick={() => setEvaluating(n)}>Evaluate</Button>}
                    {isAdmin && (
                      <Tooltip title="Remove">
                        <IconButton size="small" aria-label={`Remove ${n.officer.username}`} onClick={() => act(() => api.delete(`/training-nominations/${n.id}/`))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
      {editing && <ProgrammeDialog programme={programme} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
      {evaluating && <EvaluationDialog nomination={evaluating} mode="supervisor" onClose={() => setEvaluating(null)} onSaved={() => { setEvaluating(null); load(); }} />}
    </Box>
  );
}
