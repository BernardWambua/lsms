import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Breadcrumbs, Button, Chip, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import PriorityChip from '../common/PriorityChip';
import StatCard from '../common/StatCard';
import ProgrammeDialog from './ProgrammeDialog';
import { errorMessage } from '../../utils/errors';
import { blobErrorMessage, downloadFile } from '../../utils/download';
import { DELIVERY_MODES, PLAN_STATUSES, QUARTERS, dateRange, kes, label } from '../../utils/training';

function dash(value, suffix = '') {
  return value === null || value === undefined ? '—' : `${value}${suffix}`;
}

function SmallTable({ title, columns, rows }) {
  return (
    <Paper sx={{ overflowX: 'auto', height: '100%' }}>
      <Typography variant="subtitle1" fontWeight="bold" px={2} pt={1.5}>{title}</Typography>
      <Table size="small" aria-label={title}>
        <TableHead><TableRow>{columns.map((c, i) => <TableCell key={c} align={i ? 'right' : 'left'}>{c}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={columns.length}><Typography color="text.secondary">Nothing yet.</Typography></TableCell></TableRow>}
          {rows.map((row) => (
            <TableRow key={row[0]}>{row.map((v, i) => <TableCell key={i} align={i ? 'right' : 'left'}>{v}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

// The costed annual plan: totals against the budget, cost by quarter and
// department, attendance and evaluation results, and every programme.
export default function TrainingPlanPage() {
  const { id } = useParams();
  const { role } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/training-plans/${id}/`);
      setPlan(data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const run = async (name, action) => {
    setBusy(name);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (err) {
      setError(await blobErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const generate = () => run('generate', async () => {
    const { data } = await api.post(`/training-plans/${id}/generate/`);
    setPlan(data);
    const { programmes, nominations } = data.created;
    setNotice(programmes || nominations
      ? `Added ${programmes} programme${programmes === 1 ? '' : 's'} and ${nominations} nomination${nominations === 1 ? '' : 's'} from the latest gaps.`
      : 'The plan already covers every current gap.');
  });

  const setStatus = (status) => run(status, async () => {
    await api.patch(`/training-plans/${id}/`, { status });
    await load();
  });

  const download = (format) => run(format, async () => {
    const filename = `Training plan ${plan.institution.name} ${plan.period}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await downloadFile(`/training-plans/${id}/export/`, { download: format }, `${filename}.${format}`);
  });

  if (!plan) return error ? <Alert severity="error">{error}</Alert> : null;
  const s = plan.summary;
  const e = plan.evaluation;
  const a = plan.attendance;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/training-plans">Training plans</Link>
        <Typography color="text.primary">{plan.period}</Typography>
      </Breadcrumbs>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} mb={1}>
        <Typography variant="h5" flexGrow={1}>
          {plan.title} <Chip size="small" sx={{ ml: 1, verticalAlign: 'middle' }} {...PLAN_STATUSES[plan.status]} />
        </Typography>
        {isAdmin && plan.status !== 'approved' && (
          <Button onClick={generate} disabled={!!busy}>{busy === 'generate' ? 'Updating…' : 'Add from latest gaps'}</Button>
        )}
        {isAdmin && plan.status === 'draft' && <Button onClick={() => setStatus('submitted')} disabled={!!busy}>Submit for approval</Button>}
        {isAdmin && plan.status === 'submitted' && <Button onClick={() => setStatus('approved')} disabled={!!busy}>Mark approved</Button>}
        {isAdmin && plan.status !== 'draft' && <Button onClick={() => setStatus('draft')} disabled={!!busy}>Back to draft</Button>}
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={() => download('pdf')} disabled={!!busy}>{busy === 'pdf' ? 'Preparing…' : 'PDF'}</Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => download('xlsx')} disabled={!!busy}>{busy === 'xlsx' ? 'Preparing…' : 'Excel'}</Button>
      </Stack>
      <Typography color="text.secondary" mb={2}>
        {plan.institution.name} · Financial year {plan.period}. Programmes and nominees come from the TNA gaps; declined and withdrawn nominees are not costed.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      {s.balance !== null && s.balance < 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>The plan is {kes(-s.balance)} over the approved budget.</Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Total cost" value={kes(s.total_cost)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Approved budget" value={kes(s.budget)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Officers to train" value={s.officers} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatCard label="Programmes" value={s.programmes} /></Grid>
      </Grid>

      <Grid container spacing={2} mt={1}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SmallTable
            title="Cost by quarter"
            columns={['Quarter', 'Programmes', 'Participants', 'Cost']}
            rows={plan.by_quarter.map((q) => [q.label, q.programmes, q.participants, kes(q.cost)])}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SmallTable
            title="Cost by department"
            columns={['Department', 'Participants', 'Cost']}
            rows={plan.by_department.map((d) => [d.org_unit?.name || 'No department', d.participants, kes(d.cost)])}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SmallTable
            title="Attendance (approved nominees)"
            columns={['', 'Officers']}
            rows={[['Attended', a.attended], ['Partly attended', a.partial], ['Absent', a.absent], ['Not recorded', a.not_recorded], ['Attendance rate', dash(a.attendance_rate, '%')]]}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SmallTable
            title="Evaluation"
            columns={['', 'Result']}
            rows={[
              ['Participant responses', e.participant_responses],
              ['Average rating (1-5)', dash(e.average_reaction)],
              ['Average relevance (1-5)', dash(e.average_relevance)],
              ['Average learning gain (test points)', dash(e.average_learning_gain)],
              ['Gaps closed after training', `${e.gaps_closed} of ${e.supervisor_evaluations} evaluated`],
            ]}
          />
        </Grid>
      </Grid>

      <Stack direction="row" alignItems="center" mt={4} mb={1}>
        <Typography variant="h6" flexGrow={1}>Programmes</Typography>
        {isAdmin && <Button startIcon={<AddIcon />} onClick={() => setAdding(true)}>Add programme</Button>}
      </Stack>
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Programmes">
          <TableHead>
            <TableRow>
              <TableCell>Programme</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Quarter</TableCell>
              <TableCell>Delivery</TableCell>
              <TableCell>Dates</TableCell>
              <TableCell align="right">Participants</TableCell>
              <TableCell align="right">Approved</TableCell>
              <TableCell align="right">Attended</TableCell>
              <TableCell align="right">Per officer</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plan.programmes.length === 0 && (
              <TableRow><TableCell colSpan={10}><Typography color="text.secondary">No programmes yet. Add them from the latest gaps or one at a time.</Typography></TableCell></TableRow>
            )}
            {plan.programmes.map((p) => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/training-programmes/${p.id}`)}>
                <TableCell>
                  {p.title}
                  {p.provider && <Typography variant="caption" color="text.secondary" display="block">{p.provider}</Typography>}
                </TableCell>
                <TableCell><PriorityChip priority={p.priority} /></TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{label(QUARTERS, p.quarter)}</TableCell>
                <TableCell>{label(DELIVERY_MODES, p.delivery_mode)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateRange(p.start_date, p.end_date)}</TableCell>
                <TableCell align="right">{p.participants}</TableCell>
                <TableCell align="right">{p.approved}</TableCell>
                <TableCell align="right">{p.attended}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{kes(p.cost_per_participant)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{kes(p.total_cost)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      {adding && <ProgrammeDialog planId={plan.id} onClose={() => setAdding(false)} onSaved={(p) => navigate(`/training-programmes/${p.id}`)} />}
    </Box>
  );
}
