import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Breadcrumbs, Link, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import LevelSelect from '../common/LevelSelect';
import PriorityChip from '../common/PriorityChip';
import GapSummary from './GapSummary';
import { errorMessage } from '../../utils/errors';
import { levelLabel } from '../../utils/levels';

// One person's skills for a manager or admin to review: their self rating, and
// a manager rating saved onto their latest rating for each skill.
export default function PersonRatingsPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isMe = me.id === id;
  const [gaps, setGaps] = useState(null);
  const [latest, setLatest] = useState({}); // skill id -> latest rating
  const [error, setError] = useState('');
  const [savedSkill, setSavedSkill] = useState(null);

  const load = useCallback(async () => {
    try {
      const [gapsRes, ratingsRes] = await Promise.all([
        api.get(`/gaps/people/${id}/`),
        api.get('/ratings/', { params: { user: id } }),
      ]);
      setGaps(gapsRes.data);
      // Ratings come newest survey first; keep the first one per skill.
      const bySkill = {};
      ratingsRes.data.forEach((r) => { if (!bySkill[r.skill]) bySkill[r.skill] = r; });
      setLatest(bySkill);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const rate = async (skillId, level) => {
    setSavedSkill(null);
    try {
      await api.patch(`/ratings/${latest[skillId].id}/`, { manager_rating: level });
      await load();
      setSavedSkill(skillId);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!gaps) return error ? <Typography color="error">{error}</Typography> : null;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/ratings">Staff ratings</Link>
        <Typography color="text.primary">{gaps.user.name || gaps.user.username}</Typography>
      </Breadcrumbs>
      <Typography variant="h5">{gaps.user.name || gaps.user.username}</Typography>
      <Typography color="text.secondary" mb={3}>
        {gaps.job_role ? `${gaps.job_role.title}${gaps.org_unit ? ` · ${gaps.org_unit.name}` : ''}` : 'No job role'}
      </Typography>
      {error && <Typography color="error" mb={2}>{error}</Typography>}
      {isMe && <Alert severity="info" sx={{ mb: 2 }}>This is you. Someone else has to give your manager rating.</Alert>}

      {!gaps.job_role ? (
        <Alert severity="info">This person has no job role yet, so there are no required skills to rate.</Alert>
      ) : (
        <>
          <GapSummary gaps={gaps} />
          <Paper sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Skill ratings">
              <TableHead>
                <TableRow>
                  <TableCell>Skill</TableCell>
                  <TableCell>Required</TableCell>
                  <TableCell>Self rating</TableCell>
                  <TableCell>Manager rating</TableCell>
                  <TableCell align="center">Gap</TableCell>
                  <TableCell>Priority</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {gaps.skills.length === 0 && (
                  <TableRow><TableCell colSpan={6}><Typography color="text.secondary">This role has no required skills yet.</Typography></TableCell></TableRow>
                )}
                {gaps.skills.map((row) => {
                  const rating = latest[row.skill.id];
                  return (
                    <TableRow key={row.skill.id} hover>
                      <TableCell>{row.skill.name}</TableCell>
                      <TableCell>{levelLabel(row.required_level)}</TableCell>
                      <TableCell>
                        {rating ? levelLabel(rating.self_rating) : <Typography component="span" color="text.secondary">Not rated</Typography>}
                        {rating && <Typography variant="caption" color="text.secondary" display="block">{rating.survey_date}</Typography>}
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        {rating && !isMe ? (
                          <>
                            <LevelSelect
                              size="small" variant="standard" fullWidth emptyLabel="Not reviewed"
                              value={rating.manager_rating}
                              onChange={(value) => rate(row.skill.id, value)}
                              slotProps={{ htmlInput: { 'aria-label': `Manager rating for ${row.skill.name}` } }}
                            />
                            {savedSkill === row.skill.id && <Typography variant="caption" color="success.main">Saved</Typography>}
                          </>
                        ) : (
                          <Typography component="span" color="text.secondary">
                            {rating?.manager_rating ? levelLabel(rating.manager_rating) : rating ? 'Not reviewed' : 'Waiting for a self rating'}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">{row.gap ?? '—'}</TableCell>
                      <TableCell><PriorityChip priority={row.priority} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
