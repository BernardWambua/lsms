import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, MenuItem,
  Paper, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import LevelSelect from '../common/LevelSelect';
import { errorMessage } from '../../utils/errors';
import { fullName, levelLabel } from '../../utils/levels';

// The role's own DIF fields and the skill fields they fall back to.
const DIF = [
  { name: 'difficulty', label: 'Difficulty', short: 'D', skillField: 'difficulty' },
  { name: 'importance', label: 'Importance', short: 'I', skillField: 'impact_if_missing' },
  { name: 'frequency', label: 'Frequency', short: 'F', skillField: 'usage_frequency' },
];

const EMPTY_FORM = { skill: '', required_level: 3, difficulty: null, importance: null, frequency: null };

// One job role's skill profile: the skills it requires, at what level, and how
// each scores on DIF for this role. Admins edit it; everyone else can read it.
export default function RoleProfilePage() {
  const { id } = useParams();
  const { role: myRole } = useAuth();
  const canEdit = myRole === 'admin';
  const [jobRole, setJobRole] = useState(null);
  const [unit, setUnit] = useState(null);
  const [profile, setProfile] = useState([]);
  const [skills, setSkills] = useState([]);
  const [holders, setHolders] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, row = edit
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const [roleRes, profileRes, skillsRes, usersRes] = await Promise.all([
        api.get(`/job-roles/${id}/`),
        api.get('/job-role-skills/', { params: { job_role: id } }),
        api.get('/skills/'),
        api.get('/users/'),
      ]);
      setJobRole(roleRes.data);
      setProfile(profileRes.data);
      setSkills(skillsRes.data);
      setHolders(usersRes.data.filter((u) => u.job_role === id));
      setUnit(roleRes.data.org_unit ? (await api.get(`/org-units/${roleRes.data.org_unit}/`)).data : null);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const skillsById = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s])), [skills]);
  const rows = useMemo(() => profile
    .map((row) => ({ ...row, skillObj: skillsById[row.skill] }))
    .sort((a, b) => (a.skillObj?.name || '').localeCompare(b.skillObj?.name || '')), [profile, skillsById]);

  const open = (row) => {
    setFormError('');
    setEditing(row || {});
    setForm(row
      ? { skill: row.skill, required_level: row.required_level, difficulty: row.difficulty, importance: row.importance, frequency: row.frequency }
      : EMPTY_FORM);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing.id) {
        await api.patch(`/job-role-skills/${editing.id}/`, form);
      } else {
        await api.post('/job-role-skills/', { ...form, job_role: id });
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const remove = async (row) => {
    if (!window.confirm(`Remove ${row.skillObj?.name || 'this skill'} from the role's profile?`)) return;
    try {
      await api.delete(`/job-role-skills/${row.id}/`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!jobRole) return error ? <Typography color="error">{error}</Typography> : null;

  const inProfile = new Set(profile.map((row) => row.skill));
  const available = skills.filter((s) => !inProfile.has(s.id) || s.id === editing?.skill);
  const formSkill = skillsById[form.skill];

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/job-roles">Job roles</Link>
        <Typography color="text.primary">{jobRole.title}</Typography>
      </Breadcrumbs>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5">{jobRole.title}</Typography>
          <Typography color="text.secondary">
            {unit ? unit.name : 'Not placed in an org unit'}{jobRole.description ? ` · ${jobRole.description}` : ''}
          </Typography>
        </Box>
        {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => open(null)} disabled={available.length === 0 && skills.length > 0}>Add skill</Button>}
      </Box>
      {error && <Typography color="error" mb={2}>{error}</Typography>}

      <Typography variant="h6" mb={1}>Skill profile</Typography>
      <Typography color="text.secondary" mb={2}>
        Gaps are measured against the required level. DIF scores (difficulty, importance, frequency, 1 to 5) rank training needs; grey scores are the skill's defaults.
      </Typography>
      <Paper sx={{ overflowX: 'auto', mb: 4 }}>
        <Table size="small" aria-label="Skill profile">
          <TableHead>
            <TableRow>
              <TableCell>Skill</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Required level</TableCell>
              {DIF.map((d) => <TableCell key={d.name} align="center">{d.label}</TableCell>)}
              <TableCell align="center">DIF score</TableCell>
              {canEdit && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={8}><Typography color="text.secondary">No skills in this role's profile yet.</Typography></TableCell></TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{row.skillObj?.name || '—'}</TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{row.skillObj?.type || '—'}</TableCell>
                <TableCell><Chip size="small" label={levelLabel(row.required_level)} /></TableCell>
                {DIF.map((d) => (
                  <TableCell key={d.name} align="center">
                    {row[d.name] !== null && row[d.name] !== undefined
                      ? <strong>{row[d.name]}</strong>
                      : <Typography component="span" color="text.disabled">{row.skillObj?.[d.skillField] ?? '—'}</Typography>}
                  </TableCell>
                ))}
                <TableCell align="center">{Number(row.importance_score).toFixed(1)}</TableCell>
                {canEdit && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => open(row)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Remove"><IconButton size="small" onClick={() => remove(row)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Typography variant="h6" mb={1}>People in this role</Typography>
      {holders.length === 0 ? (
        <Typography color="text.secondary">
          Nobody holds this role yet.{canEdit && <> Assign people on the <Link component={RouterLink} to="/people">People</Link> page.</>}
        </Typography>
      ) : (
        <Box display="flex" gap={1} flexWrap="wrap">
          {holders.map((u) => <Chip key={u.id} label={fullName(u)} />)}
        </Box>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editing?.id ? `Edit ${formSkill?.name || 'skill'}` : 'Add a skill to this role'}</DialogTitle>
          <DialogContent>
            <TextField
              select label="Skill" required fullWidth margin="normal" autoFocus
              value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}
              disabled={Boolean(editing?.id)}
              helperText={skills.length === 0 ? 'Add skills on the Skills page first.' : undefined}
            >
              {available.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
            <LevelSelect
              label="Required level" required fullWidth margin="normal"
              value={form.required_level} onChange={(value) => setForm({ ...form, required_level: value })}
            />
            <Box display="flex" gap={2} flexWrap="wrap">
              {DIF.map((d) => (
                <TextField
                  key={d.name} select label={d.label} margin="normal" sx={{ flex: '1 1 140px' }}
                  value={form[d.name] ?? ''}
                  onChange={(e) => setForm({ ...form, [d.name]: e.target.value === '' ? null : Number(e.target.value) })}
                >
                  <MenuItem value="">
                    <em>Skill default{formSkill ? ` (${formSkill[d.skillField]})` : ''}</em>
                  </MenuItem>
                  {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                </TextField>
              ))}
            </Box>
            {formError && <Typography color="error" mt={1}>{formError}</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
