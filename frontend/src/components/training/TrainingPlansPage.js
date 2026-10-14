import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Paper, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import { errorMessage } from '../../utils/errors';
import { PLAN_STATUSES, financialYear, kes } from '../../utils/training';

const KES_ADORNMENT = { input: { startAdornment: <InputAdornment position="start">KES</InputAdornment> } };

// A new plan starts with default costs per officer, then is filled from the TNA gaps.
function NewPlanDialog({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ period: financialYear(), budget: '', default_fee: '', default_allowance_per_day: '', default_duration_days: 5 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, budget: form.budget || null, default_fee: form.default_fee || 0, default_allowance_per_day: form.default_allowance_per_day || 0 };
      const { data } = await api.post('/training-plans/', payload);
      await api.post(`/training-plans/${data.id}/generate/`);
      onCreated(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New training plan</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" mb={2}>
          The plan gets one programme for every skill with gaps in the TNA, and nominates each officer with a gap.
          The costs below are the starting point for every programme; you can change each one afterwards.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2}>
          <TextField label="Financial year" value={form.period} onChange={set('period')} helperText="July to June, e.g. 2026/27" />
          <TextField label="Approved training budget" type="number" value={form.budget} onChange={set('budget')} slotProps={KES_ADORNMENT} />
          <TextField label="Course fee per officer" type="number" value={form.default_fee} onChange={set('default_fee')} slotProps={KES_ADORNMENT} />
          <TextField label="Allowance per officer per day" type="number" value={form.default_allowance_per_day} onChange={set('default_allowance_per_day')} slotProps={KES_ADORNMENT} />
          <TextField label="Course length (days)" type="number" value={form.default_duration_days} onChange={set('default_duration_days')} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={create} disabled={saving || !form.period}>{saving ? 'Building…' : 'Create from gaps'}</Button>
      </DialogActions>
    </Dialog>
  );
}

// Admins and managers: the annual training plans, one per financial year.
export default function TrainingPlansPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/training-plans/').then(({ data }) => setPlans(data)).catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <Box>
      <Stack direction="row" alignItems="center" mb={1}>
        <Typography variant="h5" flexGrow={1}>Training plans</Typography>
        {role === 'admin' && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>New plan</Button>}
      </Stack>
      <Typography color="text.secondary" mb={2}>
        The costed annual plan built from the Training Needs Assessment: programmes, nominated officers, attendance and evaluation.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label="Training plans">
          <TableHead>
            <TableRow>
              <TableCell>Financial year</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Programmes</TableCell>
              <TableCell align="right">Participants</TableCell>
              <TableCell align="right">Total cost</TableCell>
              <TableCell align="right">Budget</TableCell>
              <TableCell align="right">Balance</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans?.length === 0 && (
              <TableRow><TableCell colSpan={7}><Typography color="text.secondary">No training plans yet.</Typography></TableCell></TableRow>
            )}
            {plans?.map((plan) => (
              <TableRow key={plan.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/training-plans/${plan.id}`)}>
                <TableCell>{plan.title || `Annual Training Plan ${plan.period}`}</TableCell>
                <TableCell><Chip size="small" {...PLAN_STATUSES[plan.status]} /></TableCell>
                <TableCell align="right">{plan.summary.programmes}</TableCell>
                <TableCell align="right">{plan.summary.participants}</TableCell>
                <TableCell align="right">{kes(plan.summary.total_cost)}</TableCell>
                <TableCell align="right">{kes(plan.summary.budget)}</TableCell>
                <TableCell align="right" sx={{ color: plan.summary.balance < 0 ? 'error.main' : undefined }}>{kes(plan.summary.balance)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
      {creating && <NewPlanDialog open onClose={() => setCreating(false)} onCreated={(plan) => navigate(`/training-plans/${plan.id}`)} />}
    </Box>
  );
}
