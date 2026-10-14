import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../../api';
import { errorMessage } from '../../utils/errors';
import { levelLabel } from '../../utils/levels';
import PriorityChip from '../common/PriorityChip';
import StatCard from '../common/StatCard';

const PERIOD_PATTERN = /^\d{4}\/\d{2}$/;

function pct(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

function dash(value) {
  return value === null || value === undefined ? '—' : value;
}

function name(user) {
  return user.name || user.username;
}

// File downloads come back as blobs, so errors do too.
async function blobErrorMessage(err) {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return errorMessage({ response: { data: JSON.parse(await data.text()) } });
    } catch {
      return 'The download failed.';
    }
  }
  return errorMessage(err);
}

function Section({ number, title, intro, columns, rows, empty = 'Nothing to report.' }) {
  return (
    <Box mt={4}>
      <Typography variant="h6">{number ? `${number}. ${title}` : title}</Typography>
      {intro && <Typography color="text.secondary" mb={1}>{intro}</Typography>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small" aria-label={title}>
          <TableHead>
            <TableRow>{columns.map((c) => <TableCell key={c}>{c}</TableCell>)}</TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={columns.length}><Typography color="text.secondary">{empty}</Typography></TableCell></TableRow>
            )}
            {rows}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

// Admins and managers: the Training Needs Assessment report for the institution
// or one department, previewed here and downloadable as PDF or Excel.
export default function TNAReportPage() {
  const [units, setUnits] = useState([]);
  const [unit, setUnit] = useState('');
  const [period, setPeriod] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const periodValid = !period || PERIOD_PATTERN.test(period);
  const params = { ...(unit && { unit }), ...(period && periodValid && { period }) };

  useEffect(() => {
    api.get('/org-units/').then(({ data }) => setUnits(data)).catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (!periodValid) return;
    setError('');
    api.get('/reports/tna/', { params: { ...(unit && { unit }), ...(period && { period }) } })
      .then(({ data }) => {
        setReport(data);
        if (!period) setPeriod(data.period);
      })
      .catch((err) => setError(errorMessage(err)));
    // Only refetch when the scope or a complete period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit, periodValid && period]);

  const download = async (format) => {
    setDownloading(format);
    setError('');
    try {
      const { data } = await api.get('/reports/tna/', { params: { ...params, download: format }, responseType: 'blob' });
      const scope = report.scope.org_unit?.name || report.institution.name;
      const filename = `TNA ${scope} ${report.period}`.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(await blobErrorMessage(err));
    } finally {
      setDownloading('');
    }
  };

  const s = report?.summary;

  return (
    <Box>
      <Typography variant="h5">Training Needs Assessment report</Typography>
      <Typography color="text.secondary" mb={2}>
        Organisational, occupational and individual analysis of skill gaps, with the training projections for the period.
        Figures come from the gap engine: role requirements against the latest supervisor or self ratings.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} mb={2}>
        <TextField select size="small" label="Scope" value={unit} onChange={(e) => setUnit(e.target.value)} sx={{ minWidth: 260 }}>
          <MenuItem value="">Whole institution</MenuItem>
          {units.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
        </TextField>
        <TextField
          size="small"
          label="Financial year"
          value={period}
          onChange={(e) => setPeriod(e.target.value.trim())}
          error={!periodValid}
          helperText={periodValid ? ' ' : 'Use the form 2026/27'}
          sx={{ width: 160 }}
        />
        <Box flexGrow={1} />
        <Button variant="contained" startIcon={<DownloadIcon />} disabled={!report || !periodValid || !!downloading} onClick={() => download('pdf')}>
          {downloading === 'pdf' ? 'Preparing…' : 'PDF'}
        </Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!report || !periodValid || !!downloading} onClick={() => download('xlsx')}>
          {downloading === 'xlsx' ? 'Preparing…' : 'Excel'}
        </Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {report && (
        <>
          <Typography variant="h6">1. Executive summary</Typography>
          <Typography color="text.secondary" mb={1}>
            {report.institution.name} · {report.scope.org_unit ? `${report.scope.org_unit.name} and the units below it` : 'Whole institution'} · FY {report.period}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}><StatCard label="Officers in scope" value={s.staff} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard label="Assessment coverage" value={s.assessment_coverage} suffix="%" /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard label="Officers to train" value={s.officers_to_train} /></Grid>
            <Grid size={{ xs: 6, md: 3 }}><StatCard label="Gap score" value={s.gap_score} /></Grid>
          </Grid>

          <Box mt={4}>
            <Typography variant="h6">2. Methodology</Typography>
            <Box component="ul" sx={{ mt: 1, pl: 3, color: 'text.secondary' }}>
              {report.methodology.map((line) => <li key={line}><Typography variant="body2">{line}</Typography></li>)}
            </Box>
          </Box>

          <Section
            number={3}
            title="Organisational analysis"
            intro="Gaps by department. Each line includes the units below it."
            columns={['Department', 'Officers', 'Assessed', 'With gaps', 'Coverage', 'Gap score']}
            rows={report.organisational.map((u) => (
              <TableRow key={u.org_unit.id}>
                <TableCell sx={{ pl: 2 + u.depth * 3 }}>{u.org_unit.name}</TableCell>
                <TableCell>{u.staff}</TableCell>
                <TableCell>{u.staff_assessed}</TableCell>
                <TableCell>{u.staff_with_gaps}</TableCell>
                <TableCell>{pct(u.assessment_coverage)}</TableCell>
                <TableCell>{dash(u.gap_score)}</TableCell>
              </TableRow>
            ))}
          />

          <Section
            number={4}
            title="Occupational analysis"
            intro="Gaps by job role, against each role's skill profile."
            columns={['Job role', 'Department', 'Officers', 'Assessed', 'With gaps', 'Gap score', 'Main training needs']}
            rows={report.occupational.map((r) => (
              <TableRow key={r.job_role.id}>
                <TableCell>{r.job_role.title}</TableCell>
                <TableCell>{r.org_unit?.name || '—'}</TableCell>
                <TableCell>{r.staff}</TableCell>
                <TableCell>{r.staff_assessed}</TableCell>
                <TableCell>{r.staff_with_gaps}</TableCell>
                <TableCell>{dash(r.gap_score)}</TableCell>
                <TableCell>{r.priority_needs.join(', ') || '—'}</TableCell>
              </TableRow>
            ))}
          />

          <Section
            number={5}
            title="Individual analysis"
            columns={['Officer', 'Job role', 'Department', 'Assessed', 'Gap score', 'Skill gaps']}
            empty="Nobody in scope."
            rows={report.individuals.map((p) => (
              <TableRow key={p.user.id}>
                <TableCell>{name(p.user)}</TableCell>
                <TableCell>{p.job_role?.title || '—'}</TableCell>
                <TableCell>{p.org_unit?.name || '—'}</TableCell>
                <TableCell>{p.job_role ? `${p.skills_assessed} of ${p.skills_required}` : '—'}</TableCell>
                <TableCell>{dash(p.gap_score)}</TableCell>
                <TableCell>
                  {p.gaps.map((g) => `${g.skill.name} (−${g.gap})`).join(', ') || (p.skills_assessed ? 'None' : 'Not assessed')}
                </TableCell>
              </TableRow>
            ))}
          />

          <Section
            number={6}
            title="Prioritised training needs"
            intro="Skills ranked by the total DIF-weighted gap across all officers."
            columns={['Skill', 'Officers requiring', 'Assessed', 'Officers to train', 'Average gap', 'Priority']}
            rows={report.training_needs.map((n) => (
              <TableRow key={n.skill.id}>
                <TableCell>{n.skill.name}</TableCell>
                <TableCell>{n.staff_requiring}</TableCell>
                <TableCell>{n.staff_assessed}</TableCell>
                <TableCell>{n.officers_to_train}</TableCell>
                <TableCell>{dash(n.average_gap)}</TableCell>
                <TableCell><PriorityChip priority={n.priority} /></TableCell>
              </TableRow>
            ))}
          />

          <Box mt={4}>
            <Typography variant="h6">7. Recommendations</Typography>
            <Box component="ol" sx={{ mt: 1, pl: 3 }}>
              {report.recommendations.map((line) => <li key={line}><Typography variant="body2">{line}</Typography></li>)}
            </Box>
          </Box>

          <Section
            title="Annex: Training projections"
            intro="Officers proposed for training in each skill, highest priority first."
            columns={['Skill', 'Officer', 'Job role', 'Department', 'Required', 'Current', 'Gap', 'Priority']}
            empty="No gaps to train for."
            rows={report.projections.map((p) => (
              <TableRow key={`${p.skill.id}-${p.officer.id}`}>
                <TableCell>{p.skill.name}</TableCell>
                <TableCell>{name(p.officer)}</TableCell>
                <TableCell>{p.job_role?.title || '—'}</TableCell>
                <TableCell>{p.org_unit?.name || '—'}</TableCell>
                <TableCell>{levelLabel(p.required_level)}</TableCell>
                <TableCell>{levelLabel(p.current_level)}</TableCell>
                <TableCell>{p.gap}</TableCell>
                <TableCell><PriorityChip priority={p.priority} /></TableCell>
              </TableRow>
            ))}
          />
        </>
      )}
    </Box>
  );
}
