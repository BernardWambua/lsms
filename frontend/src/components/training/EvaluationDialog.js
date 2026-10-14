import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Rating, Stack, TextField, Typography,
} from '@mui/material';
import api from '../../api';
import LevelSelect from '../common/LevelSelect';
import { errorMessage } from '../../utils/errors';
import { levelLabel } from '../../utils/levels';

function Stars({ label, value, onChange }) {
  return (
    <Box>
      <Typography component="legend">{label}</Typography>
      <Rating name={label} value={value ?? null} onChange={(e, v) => onChange(v)} />
    </Box>
  );
}

// Training evaluation. The participant rates the training (Kirkpatrick level 1);
// a supervisor records test scores (level 2) and the level seen back on the job
// (level 3), which is saved as the officer's manager rating.
export default function EvaluationDialog({ nomination, mode, onClose, onSaved }) {
  const existing = nomination.evaluation || {};
  const [form, setForm] = useState(mode === 'participant'
    ? { reaction_rating: existing.reaction_rating, relevance_rating: existing.relevance_rating, participant_comments: existing.participant_comments || '' }
    : { pre_test_score: existing.pre_test_score ?? '', post_test_score: existing.post_test_score ?? '', post_training_level: existing.post_training_level, supervisor_comments: existing.supervisor_comments || '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (field) => (value) => setForm({ ...form, [field]: value });

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = { ...form };
    ['pre_test_score', 'post_test_score'].forEach((f) => { if (f in payload && payload[f] === '') payload[f] = null; });
    try {
      await api.post(`/training-nominations/${nomination.id}/evaluation/`, payload);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const officer = nomination.officer.name || nomination.officer.username;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{mode === 'participant' ? `Evaluate ${nomination.programme_detail.title}` : `Evaluate ${officer}'s training`}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {mode === 'participant' ? (
          <Stack spacing={2} mt={1}>
            <Stars label="How good was the training overall?" value={form.reaction_rating} onChange={set('reaction_rating')} />
            <Stars label="How relevant was it to your job?" value={form.relevance_rating} onChange={set('relevance_rating')} />
            <TextField label="Comments" multiline minRows={3} value={form.participant_comments} onChange={(e) => set('participant_comments')(e.target.value)} />
          </Stack>
        ) : (
          <Stack spacing={2} mt={1}>
            <Typography color="text.secondary">
              {nomination.required_level
                ? `Before training: ${levelLabel(nomination.current_level)}. The job role requires ${levelLabel(nomination.required_level)}.`
                : 'Rate the skill as you see it on the job now.'}
            </Typography>
            <Stack direction="row" spacing={2}>
              <TextField type="number" label="Pre-test score (%)" value={form.pre_test_score} onChange={(e) => set('pre_test_score')(e.target.value)} />
              <TextField type="number" label="Post-test score (%)" value={form.post_test_score} onChange={(e) => set('post_test_score')(e.target.value)} />
            </Stack>
            <LevelSelect label="Level on the job after training" emptyLabel="Not rated yet" value={form.post_training_level} onChange={set('post_training_level')}
              helperText="Saved as the officer's manager rating, so the gap updates." />
            <TextField label="Comments" multiline minRows={3} value={form.supervisor_comments} onChange={(e) => set('supervisor_comments')(e.target.value)} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

EvaluationDialog.propTypes = {
  nomination: PropTypes.object.isRequired,
  mode: PropTypes.oneOf(['participant', 'supervisor']).isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
