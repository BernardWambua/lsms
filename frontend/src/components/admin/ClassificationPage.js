import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Grid, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import api from '../../api';
import { useAuth } from '../auth/authContext';
import ResourcePage from '../common/ResourcePage';
import { frameworks, grades, jobFamilies } from '../structure/resources';
import { errorMessage } from '../../utils/errors';
import { DEFAULT_TERMS, useTerms } from '../../utils/terms';

const TERM_LABELS = {
  organisation: 'The organisation',
  org_unit: 'An org unit',
  staff_number: 'Staff number',
  grade: 'Grade',
  grades: 'Grades',
  job_family: 'Job family',
  job_families: 'Job families',
  competency_framework: 'Competency framework',
  competency_frameworks: 'Competency frameworks',
};

// The organisation's own words for LSMS's generic terms, e.g. "Job Group" for grade.
function WordingForm() {
  const { user, reload } = useAuth();
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/tenants/${user.tenant}/`)
      .then(({ data }) => setForm(data.terminology || {}))
      .catch((err) => setError(errorMessage(err)));
  }, [user.tenant]);

  const save = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await api.patch(`/tenants/${user.tenant}/`, { terminology: form });
      await reload();
      setMessage('Saved. Pages now use these words.');
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Paper component="form" onSubmit={save} sx={{ p: 3 }}>
      <Typography color="text.secondary" mb={2}>
        LSMS uses general terms so any organisation can use it. Give your own word for any of them; leave a box empty to keep the default.
      </Typography>
      <Grid container spacing={2}>
        {Object.keys(DEFAULT_TERMS).map((key) => (
          <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              label={TERM_LABELS[key]}
              placeholder={DEFAULT_TERMS[key]}
              value={form[key] || ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        ))}
      </Grid>
      {error && <Typography color="error" mt={2}>{error}</Typography>}
      {message && <Typography color="success.main" mt={2}>{message}</Typography>}
      <Box mt={2}><Button type="submit" variant="contained">Save wording</Button></Box>
    </Paper>
  );
}

// How the organisation classifies its staff and skills: grades, job families,
// competency frameworks, and the words it uses for them.
export default function ClassificationPage() {
  const terms = useTerms();
  const [tab, setTab] = useState('grades');
  const pages = useMemo(() => ({ grades: grades(terms), families: jobFamilies(terms), frameworks: frameworks(terms) }), [terms]);

  return (
    <Box>
      <Typography variant="h5">Classification</Typography>
      <Typography color="text.secondary" mb={2}>How your organisation groups its staff and skills.</Typography>
      <Tabs value={tab} onChange={(e, value) => setTab(value)} sx={{ mb: 3 }} variant="scrollable">
        <Tab value="grades" label={terms.grades} />
        <Tab value="families" label={terms.job_families} />
        <Tab value="frameworks" label={terms.competency_frameworks} />
        <Tab value="wording" label="Wording" />
      </Tabs>
      {tab === 'wording' ? <WordingForm /> : <ResourcePage key={tab} {...pages[tab]} />}
    </Box>
  );
}
