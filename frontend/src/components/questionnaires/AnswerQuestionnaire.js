import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Breadcrumbs, Button, FormControl, FormControlLabel, FormLabel, Link, Paper, Radio, RadioGroup,
  Stack, TextField, Typography,
} from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import { errorMessage } from '../../utils/errors';
import { LEVELS } from '../../utils/levels';

const TRUE_FALSE = [{ value: 'true', label: 'True' }, { value: 'false', label: 'False' }];

// The answer payload for one question, or null when it hasn't been answered.
function responseFor(question, answer) {
  if (answer === undefined || answer === '') return null;
  if (question.question_type === 'rating') return { response_rating: Number(answer) };
  if (question.question_type === 'text') return answer.trim() ? { response_text: answer.trim() } : null;
  return { response_choice: answer };
}

// Anyone in the organisation fills in a questionnaire here. Rating answers on
// questions linked to a skill are recorded as the person's self rating.
export default function AnswerQuestionnaire() {
  const { id } = useParams();
  const { user } = useAuth();
  const [questionnaire, setQuestionnaire] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [choices, setChoices] = useState([]);
  const [lastSubmitted, setLastSubmitted] = useState(null);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [qnRes, questionsRes, choicesRes, responsesRes] = await Promise.all([
          api.get(`/questionnaires/${id}/`),
          api.get('/questions/', { params: { questionnaire: id } }),
          api.get('/question-choices/', { params: { question__questionnaire: id } }),
          api.get('/question-responses/', { params: { question__questionnaire: id, user: user.id } }),
        ]);
        setQuestionnaire(qnRes.data);
        setQuestions(questionsRes.data);
        setChoices(choicesRes.data);
        setLastSubmitted(responsesRes.data[0]?.submitted_at || null);
      } catch (err) {
        setError(errorMessage(err));
      }
    })();
  }, [id, user.id]);

  const submit = async (e) => {
    e.preventDefault();
    const missing = questions.filter((q) => q.question_type !== 'text' && !responseFor(q, answers[q.id]));
    if (missing.length) {
      setError(`Please answer every question; ${missing.length} still need${missing.length === 1 ? 's' : ''} an answer.`);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      for (const q of questions) {
        const response = responseFor(q, answers[q.id]);
        if (response) await api.post('/question-responses/', { question: q.id, ...response });
      }
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!questionnaire) return error ? <Typography color="error">{error}</Typography> : null;

  const set = (questionId, value) => setAnswers({ ...answers, [questionId]: value });
  const linksSkills = questions.some((q) => q.question_type === 'rating' && q.skill);

  return (
    <Box maxWidth={760}>
      <Breadcrumbs sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/questionnaires">Questionnaires</Link>
        <Link component={RouterLink} to={`/questionnaires/${id}`}>{questionnaire.title}</Link>
        <Typography color="text.primary">Answer</Typography>
      </Breadcrumbs>
      <Typography variant="h5" mb={1}>{questionnaire.title}</Typography>
      {lastSubmitted && !done && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You last answered this on {new Date(lastSubmitted).toLocaleDateString()}. Answering again records new answers.
        </Alert>
      )}
      {linksSkills && !done && (
        <Typography color="text.secondary" mb={2}>
          Rate yourself honestly: 1 Awareness, 2 Basic, 3 Intermediate, 4 Advanced, 5 Expert. Your skill ratings are reviewed by your manager.
        </Typography>
      )}

      {done ? (
        <Alert severity="success">
          Thanks, your answers are saved.{linksSkills && <> Your skill ratings are updated on <Link component={RouterLink} to="/my-skills">My skills</Link>.</>}
        </Alert>
      ) : (
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            {questions.map((q, index) => (
              <Paper key={q.id} variant="outlined" sx={{ p: 2 }}>
                <FormControl fullWidth>
                  <FormLabel id={`q-${q.id}`} sx={{ color: 'text.primary', mb: 1 }}>{index + 1}. {q.text}</FormLabel>
                  {q.question_type === 'text' && (
                    <TextField multiline minRows={2} value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} placeholder="Optional" />
                  )}
                  {q.question_type !== 'text' && (
                    <RadioGroup row aria-labelledby={`q-${q.id}`} value={answers[q.id] ?? ''} onChange={(e) => set(q.id, e.target.value)}>
                      {q.question_type === 'rating' && LEVELS.map((l) => (
                        <FormControlLabel key={l.value} value={String(l.value)} control={<Radio />} label={`${l.value} ${l.label}`} />
                      ))}
                      {q.question_type === 'true_false' && TRUE_FALSE.map((o) => (
                        <FormControlLabel key={o.value} value={o.value} control={<Radio />} label={o.label} />
                      ))}
                      {q.question_type === 'choice' && choices.filter((c) => c.question === q.id).map((c) => (
                        <FormControlLabel key={c.id} value={c.text} control={<Radio />} label={c.text} />
                      ))}
                    </RadioGroup>
                  )}
                </FormControl>
              </Paper>
            ))}
          </Stack>
          {error && <Typography color="error" mt={2}>{error}</Typography>}
          <Button type="submit" variant="contained" sx={{ mt: 2 }} disabled={submitting || questions.length === 0}>
            {submitting ? 'Submitting…' : 'Submit answers'}
          </Button>
        </Box>
      )}
    </Box>
  );
}
