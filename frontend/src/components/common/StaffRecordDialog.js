import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography,
} from '@mui/material';
import api from '../../api';
import { errorMessage } from '../../utils/errors';
import { useTerms } from '../../utils/terms';

const TERMS_OF_SERVICE = [
  { value: 'permanent', label: 'Permanent and pensionable' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'intern', label: 'Intern' },
];
const GENDERS = [{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'other', label: 'Other' }];
const DISABILITY = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];
const FIELDS = ['staff_number', 'grade', 'job_family', 'supervisor', 'employment_terms', 'date_of_appointment', 'gender'];

function formFor(person) {
  const form = Object.fromEntries(FIELDS.map((f) => [f, person?.[f] ?? '']));
  form.disability = person?.disability === true ? 'yes' : person?.disability === false ? 'no' : '';
  return form;
}

// HR's record of one officer: their number, grade, job family, supervisor and terms of service.
export default function StaffRecordDialog({ person, people, grades, jobFamilies, onClose, onSaved }) {
  const terms = useTerms();
  const [form, setForm] = useState(formFor(person));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(formFor(person));
    setError('');
  }, [person]);

  const save = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(FIELDS.map((f) => [f, form[f] === '' && f !== 'staff_number' && f !== 'employment_terms' && f !== 'gender' ? null : form[f]]));
    payload.disability = form.disability === '' ? null : form.disability === 'yes';
    try {
      await api.patch(`/users/${person.id}/`, payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const field = (name, label, options, extra = {}) => (
    <TextField
      select={!!options} label={label} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      fullWidth margin="dense" {...extra}
    >
      {options && <MenuItem value=""><em>None</em></MenuItem>}
      {options && options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
    </TextField>
  );

  const name = person ? ([person.first_name, person.last_name].filter(Boolean).join(' ') || person.username) : '';
  const extra = Object.entries(person?.extra || {});

  return (
    <Dialog open={!!person} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={save}>
        <DialogTitle>Staff record: {name}</DialogTitle>
        <DialogContent>
          <Grid container columnSpacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>{field('staff_number', terms.staff_number)}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {field('supervisor', 'Supervisor', people.filter((p) => p.id !== person?.id).map((p) => ({
                value: p.id, label: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username,
              })))}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('grade', terms.grade, grades.map((g) => ({ value: g.id, label: g.name || g.code })))}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('job_family', terms.job_family, jobFamilies.map((f) => ({ value: f.id, label: f.name })))}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('employment_terms', 'Terms of service', TERMS_OF_SERVICE)}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              {field('date_of_appointment', 'Date of appointment', null, { type: 'date', slotProps: { inputLabel: { shrink: true } } })}
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('gender', 'Gender', GENDERS)}</Grid>
            <Grid size={{ xs: 12, sm: 6 }}>{field('disability', 'Disability', DISABILITY)}</Grid>
          </Grid>
          {extra.length > 0 && (
            <Box mt={2}>
              <Typography variant="subtitle2">From the HR system</Typography>
              {extra.map(([key, value]) => <Typography key={key} variant="body2" color="text.secondary">{key}: {value}</Typography>)}
            </Box>
          )}
          {error && <Typography color="error" mt={1}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">Save</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

StaffRecordDialog.propTypes = {
  person: PropTypes.object,
  people: PropTypes.array.isRequired,
  grades: PropTypes.array.isRequired,
  jobFamilies: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
