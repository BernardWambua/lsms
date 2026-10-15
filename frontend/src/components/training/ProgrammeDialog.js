import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, InputAdornment, MenuItem, TextField, Typography,
} from '@mui/material';
import api from '../../api';
import { errorMessage } from '../../utils/errors';
import { DELIVERY_MODES, QUARTERS, kes } from '../../utils/training';

const FIELDS = ['title', 'skill', 'provider', 'delivery_mode', 'quarter', 'start_date', 'end_date', 'venue', 'duration_days', 'fee', 'allowance_per_day', 'fixed_cost', 'priority'];
const KES_ADORNMENT = { input: { startAdornment: <InputAdornment position="start">KES</InputAdornment> } };

function initial(programme) {
  const form = { title: '', skill: '', provider: '', delivery_mode: 'in_house', quarter: 1, start_date: '', end_date: '', venue: '', duration_days: 5, fee: 0, allowance_per_day: 0, fixed_cost: 0, priority: 'medium' };
  if (programme) FIELDS.forEach((f) => { form[f] = programme[f] ?? ''; });
  return form;
}

// Adds a programme to a plan, or edits one: what it covers, when, who runs it and what it costs.
export default function ProgrammeDialog({ planId, programme, onClose, onSaved }) {
  const [form, setForm] = useState(() => initial(programme));
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  useEffect(() => {
    api.get('/skills/').then(({ data }) => setSkills(data)).catch(() => setSkills([]));
  }, []);

  const perOfficer = Number(form.fee || 0) + Number(form.allowance_per_day || 0) * Number(form.duration_days || 0);

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = { ...form, skill: form.skill || null, start_date: form.start_date || null, end_date: form.end_date || null };
    try {
      const { data } = programme
        ? await api.patch(`/training-programmes/${programme.id}/`, payload)
        : await api.post('/training-programmes/', { ...payload, plan: planId });
      onSaved(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{programme ? 'Edit programme' : 'Add programme'}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, md: 8 }}><TextField fullWidth label="Programme" value={form.title} onChange={set('title')} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select fullWidth label="Skill" value={form.skill} onChange={set('skill')}>
              <MenuItem value=""><em>None</em></MenuItem>
              {skills.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Provider" value={form.provider} onChange={set('provider')} helperText="e.g. Kenya School of Government" /></Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField select fullWidth label="Delivery" value={form.delivery_mode} onChange={set('delivery_mode')}>
              {DELIVERY_MODES.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Venue" value={form.venue} onChange={set('venue')} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField select fullWidth label="Quarter" value={form.quarter} onChange={set('quarter')}>
              {QUARTERS.map((q) => <MenuItem key={q.value} value={q.value}>{q.label}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <TextField select fullWidth label="Priority" value={form.priority} onChange={set('priority')}>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="Start" value={form.start_date} onChange={set('start_date')} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="End" value={form.end_date} onChange={set('end_date')} slotProps={{ inputLabel: { shrink: true } }} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Days" value={form.duration_days} onChange={set('duration_days')} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Fee per officer" value={form.fee} onChange={set('fee')} slotProps={KES_ADORNMENT} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Allowance per day" value={form.allowance_per_day} onChange={set('allowance_per_day')} slotProps={KES_ADORNMENT} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="number" label="Fixed cost" value={form.fixed_cost} onChange={set('fixed_cost')} slotProps={KES_ADORNMENT} helperText="Facilitators, venue" /></Grid>
        </Grid>
        <Typography color="text.secondary" mt={2}>Each officer costs {kes(perOfficer)}: the fee plus the allowance for each day.</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !form.title}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

ProgrammeDialog.propTypes = {
  planId: PropTypes.string,
  programme: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
