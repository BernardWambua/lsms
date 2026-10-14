import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import LevelSelect from '../common/LevelSelect';
import PriorityChip from '../common/PriorityChip';
import GapSummary from './GapSummary';
import { errorMessage } from '../../utils/errors';
import { levelLabel, today } from '../../utils/levels';

// Saves a self rating for today: updates today's rating if there is one, else
// starts a new one, so earlier surveys stay as history.
async function saveSelfRating(ratings, skillId, level) {
  const date = today();
  const existing = ratings.find((r) => r.skill === skillId && r.survey_date === date);
  if (existing) return api.patch(`/ratings/${existing.id}/`, { self_rating: level });
  return api.post('/ratings/', { skill: skillId, self_rating: level, survey_date: date });
}

// A person's own skills: what their job role requires, their self rating
// (editable), their manager's rating, and the resulting gap.
export default function MySkillsPage() {
  const { user } = useAuth();
  const [gaps, setGaps] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [draft, setDraft] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [gapsRes, ratingsRes] = await Promise.all([
        api.get('/gaps/me/'),
        api.get('/ratings/', { params: { user: user.id } }),
      ]);
      setGaps(gapsRes.data);
      setRatings(ratingsRes.data);
      setDraft({});
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const changed = Object.entries(draft).filter(([skillId, level]) => {
    const row = gaps?.skills.find((s) => s.skill.id === skillId);
    return level !== null && level !== row?.self_rating;
  });

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      for (const [skillId, level] of changed) {
        await saveSelfRating(ratings, skillId, level);
      }
      await load();
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!gaps) return error ? <Typography color="error">{error}</Typography> : null;

  return (
    <Box>
      <Typography variant="h5">My skills</Typography>
      <Typography color="text.secondary" mb={3}>
        {gaps.job_role
          ? <>What your role as <strong>{gaps.job_role.title}</strong>{gaps.org_unit ? ` in ${gaps.org_unit.name}` : ''} requires, and where you stand. Your manager's rating counts over your own once they've given one.</>
          : 'Your skills and where you stand.'}
      </Typography>

      {!gaps.job_role ? (
        <Alert severity="info">You haven't been placed in a job role yet. Ask your admin to assign one, then your required skills will show here.</Alert>
      ) : (
        <>
          <GapSummary gaps={gaps} />
          {gaps.skills.length === 0 ? (
            <Alert severity="info">Your job role has no required skills yet.</Alert>
          ) : (
            <Paper sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="My skills">
                <TableHead>
                  <TableRow>
                    <TableCell>Skill</TableCell>
                    <TableCell>Required</TableCell>
                    <TableCell>My rating</TableCell>
                    <TableCell>Manager rating</TableCell>
                    <TableCell align="center">Gap</TableCell>
                    <TableCell>Priority</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gaps.skills.map((row) => (
                    <TableRow key={row.skill.id} hover>
                      <TableCell>{row.skill.name}</TableCell>
                      <TableCell>{levelLabel(row.required_level)}</TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <LevelSelect
                          size="small" variant="standard" fullWidth emptyLabel="Not rated"
                          value={draft[row.skill.id] ?? row.self_rating}
                          onChange={(value) => setDraft({ ...draft, [row.skill.id]: value })}
                          slotProps={{ htmlInput: { 'aria-label': `My rating for ${row.skill.name}` } }}
                        />
                      </TableCell>
                      <TableCell>{row.manager_rating ? levelLabel(row.manager_rating) : <Typography component="span" color="text.secondary">Not reviewed</Typography>}</TableCell>
                      <TableCell align="center">{row.gap ?? '—'}</TableCell>
                      <TableCell><PriorityChip priority={row.priority} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
          <Box display="flex" alignItems="center" gap={2} mt={2} flexWrap="wrap">
            <Button variant="contained" onClick={save} disabled={saving || changed.length === 0}>
              {saving ? 'Saving…' : 'Save my ratings'}
            </Button>
            {saved && <Typography color="success.main">Saved.</Typography>}
            {error && <Typography color="error">{error}</Typography>}
            <Typography color="text.secondary" variant="body2">
              You can also rate yourself through a <Link component={RouterLink} to="/questionnaires">questionnaire</Link>.
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
}
