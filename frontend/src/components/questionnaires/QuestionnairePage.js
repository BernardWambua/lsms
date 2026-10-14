import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, MenuItem,
  Paper, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import { errorMessage } from '../../utils/errors';
import { QUESTION_TYPES, questionTypeLabel } from './questionTypes';

const EMPTY_FORM = { text: '', question_type: 'rating', skill: '' };

// One questionnaire's questions. Admins add, edit and remove questions and
// multiple-choice options; everyone can open the answer form from here.
export default function QuestionnairePage() {
  const { id } = useParams();
  const { role } = useAuth();
  const canEdit = role === 'admin';
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [choices, setChoices] = useState([]);
  const [skills, setSkills] = useState([]);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [newChoice, setNewChoice] = useState({});

  const load = useCallback(async () => {
    try {
      const [qnRes, questionsRes, choicesRes, skillsRes, unitsRes] = await Promise.all([
        api.get(`/questionnaires/${id}/`),
        api.get('/questions/', { params: { questionnaire: id } }),
        api.get('/question-choices/', { params: { question__questionnaire: id } }),
        api.get('/skills/'),
        api.get('/org-units/'),
      ]);
      setQuestionnaire(qnRes.data);
      setQuestions(questionsRes.data);
      setChoices(choicesRes.data);
      setSkills(skillsRes.data);
      setUnits(unitsRes.data);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const skillName = useMemo(() => Object.fromEntries(skills.map((s) => [s.id, s.name])), [skills]);

  const open = (question) => {
    setFormError('');
    setEditing(question || {});
    setForm(question ? { text: question.text, question_type: question.question_type, skill: question.skill || '' } : EMPTY_FORM);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, skill: form.skill || null };
    try {
      if (editing.id) {
        await api.patch(`/questions/${editing.id}/`, payload);
      } else {
        await api.post('/questions/', { ...payload, questionnaire: id });
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const run = async (request) => {
    try {
      await request();
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeQuestion = (question) => {
    if (!window.confirm('Delete this question and its answers?')) return;
    run(() => api.delete(`/questions/${question.id}/`));
  };

  const addChoice = (question) => {
    const text = (newChoice[question.id] || '').trim();
    if (!text) return;
    setNewChoice({ ...newChoice, [question.id]: '' });
    run(() => api.post('/question-choices/', { question: question.id, text }));
  };

  if (!questionnaire) return error ? <Typography color="error">{error}</Typography> : null;

  const unit = units.find((u) => u.id === questionnaire.org_unit);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/questionnaires">Questionnaires</Link>
        <Typography color="text.primary">{questionnaire.title}</Typography>
      </Breadcrumbs>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5">{questionnaire.title}</Typography>
          <Typography color="text.secondary">
            For {unit ? unit.name : 'everyone'} · {questions.length} question{questions.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Button variant="outlined" component={RouterLink} to={`/questionnaires/${id}/answer`} disabled={questions.length === 0}>
            Answer
          </Button>
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => open(null)}>Add question</Button>}
        </Box>
      </Box>
      {error && <Typography color="error" mb={2}>{error}</Typography>}
      {canEdit && (
        <Typography color="text.secondary" mb={2}>
          Link rating questions to a skill: each answer becomes that person's self rating for the skill, which feeds their gap scores.
        </Typography>
      )}

      <Stack spacing={2}>
        {questions.length === 0 && <Typography color="text.secondary">No questions yet.</Typography>}
        {questions.map((q, index) => (
          <Paper key={q.id} variant="outlined" sx={{ p: 2 }}>
            <Box display="flex" justifyContent="space-between" gap={2}>
              <Box>
                <Typography fontWeight="bold">{index + 1}. {q.text}</Typography>
                <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                  <Chip size="small" label={questionTypeLabel(q.question_type)} />
                  {q.skill && <Chip size="small" color="primary" variant="outlined" label={`Skill: ${skillName[q.skill] || 'unknown'}`} />}
                </Box>
              </Box>
              {canEdit && (
                <Box sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="Edit"><IconButton size="small" onClick={() => open(q)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete"><IconButton size="small" onClick={() => removeQuestion(q)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
              )}
            </Box>
            {q.question_type === 'choice' && (
              <Box mt={2}>
                <Box display="flex" gap={1} flexWrap="wrap" mb={canEdit ? 1 : 0}>
                  {choices.filter((c) => c.question === q.id).map((c) => (
                    <Chip key={c.id} label={c.text} onDelete={canEdit ? () => run(() => api.delete(`/question-choices/${c.id}/`)) : undefined} />
                  ))}
                  {!choices.some((c) => c.question === q.id) && <Typography color="text.secondary" variant="body2">No options yet.</Typography>}
                </Box>
                {canEdit && (
                  <Box display="flex" gap={1} component="form" onSubmit={(e) => { e.preventDefault(); addChoice(q); }}>
                    <TextField size="small" label="New option" value={newChoice[q.id] || ''} onChange={(e) => setNewChoice({ ...newChoice, [q.id]: e.target.value })} />
                    <Button type="submit">Add option</Button>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        ))}
      </Stack>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editing?.id ? 'Edit question' : 'Add question'}</DialogTitle>
          <DialogContent>
            <TextField label="Question" required fullWidth margin="normal" autoFocus multiline
              value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <TextField select label="Answer type" required fullWidth margin="normal"
              value={form.question_type} onChange={(e) => setForm({ ...form, question_type: e.target.value })}>
              {QUESTION_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <TextField select label="Skill" fullWidth margin="normal"
              value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}
              helperText={form.question_type === 'rating' ? 'Answers record a self rating for this skill.' : 'Optional: what this question is about.'}>
              <MenuItem value=""><em>None</em></MenuItem>
              {skills.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </TextField>
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
