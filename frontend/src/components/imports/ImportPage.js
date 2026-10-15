import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, FormControlLabel, Paper, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import api from '../../api';
import { blobErrorMessage, downloadFile } from '../../utils/download';
import { errorMessage } from '../../utils/errors';
import { useTerms } from '../../utils/terms';

const ACTION_COLORS = { created: 'success', updated: 'info', unchanged: 'default', error: 'error' };
const ACTION_LABELS = { created: 'New', updated: 'Updated', unchanged: 'Unchanged', error: 'Error' };
const ADDED_LABELS = {
  departments: 'Departments', job_roles: 'Posts', grades: 'Grades', job_families: 'Job families', frameworks: 'Frameworks',
};

function Counts({ counts }) {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {['created', 'updated', 'unchanged', 'error'].map((action) => (
        <Chip key={action} size="small" color={ACTION_COLORS[action]} variant={action === 'unchanged' ? 'outlined' : 'filled'}
          label={`${ACTION_LABELS[action]}: ${counts[action] || 0}`} />
      ))}
    </Stack>
  );
}

Counts.propTypes = { counts: PropTypes.object.isRequired };

// Each row of a checked or imported file: what happened to it and why.
function RowsTable({ rows, keyLabel, nameLabel }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.filter((r) => r.action !== 'unchanged' || r.warnings.length);
  return (
    <Box mt={2}>
      <FormControlLabel control={<Switch size="small" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />}
        label="Show unchanged rows" />
      <Paper variant="outlined" sx={{ overflowX: 'auto', maxHeight: 420 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Row</TableCell>
              <TableCell>{keyLabel}</TableCell>
              <TableCell>{nameLabel}</TableCell>
              <TableCell>Result</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {shown.length === 0 && (
              <TableRow><TableCell colSpan={5}><Typography color="text.secondary">Every row is unchanged.</Typography></TableCell></TableRow>
            )}
            {shown.map((r) => (
              <TableRow key={r.row}>
                <TableCell>{r.row}</TableCell>
                <TableCell>{r.key || '—'}</TableCell>
                <TableCell>{r.label || '—'}</TableCell>
                <TableCell><Chip size="small" color={ACTION_COLORS[r.action]} label={ACTION_LABELS[r.action]} /></TableCell>
                <TableCell>
                  {r.errors.map((e) => <Typography key={e} variant="body2" color="error">{e}</Typography>)}
                  {r.warnings.map((w) => <Typography key={w} variant="body2" color="warning.main">{w}</Typography>)}
                  {r.changes.length > 0 && <Typography variant="body2" color="text.secondary">Changes: {r.changes.join(', ').replace(/_/g, ' ')}</Typography>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

RowsTable.propTypes = { rows: PropTypes.array.isRequired, keyLabel: PropTypes.string.isRequired, nameLabel: PropTypes.string.isRequired };

function Result({ result, kind, terms }) {
  const added = Object.entries(result.added || {}).filter(([, labels]) => labels.length);
  return (
    <Box mt={3}>
      <Alert severity={result.committed ? 'success' : 'info'} sx={{ mb: 2 }}>
        {result.committed
          ? 'Imported. Rows with errors were skipped; fix them and upload the file again.'
          : 'Checked. Nothing has been saved yet. Review the rows below, then import.'}
      </Alert>
      <Typography variant="subtitle2" gutterBottom>{kind === 'staff' ? 'Officers' : 'Competencies'}</Typography>
      <Counts counts={result.counts} />
      {added.length > 0 && (
        <Box mt={2}>
          <Typography variant="subtitle2">{result.committed ? 'Also added' : 'Will also add'}</Typography>
          {added.map(([type, labels]) => (
            <Typography key={type} variant="body2" color="text.secondary">
              {ADDED_LABELS[type] || type} ({labels.length}): {labels.slice(0, 12).join('; ')}{labels.length > 12 ? '; …' : ''}
            </Typography>
          ))}
        </Box>
      )}
      {result.extra_columns?.length > 0 && (
        <Typography variant="body2" color="text.secondary" mt={1}>
          Kept on each officer's record as extra details: {result.extra_columns.join(', ')}.
        </Typography>
      )}
      {result.not_in_file?.length > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {result.not_in_file.length} active {result.not_in_file.length === 1 ? 'officer is' : 'officers are'} in LSMS but not in this file,
          so may have left: {result.not_in_file.slice(0, 10).map((p) => `${p.name} (${p.staff_number})`).join(', ')}
          {result.not_in_file.length > 10 ? ` and ${result.not_in_file.length - 10} more` : ''}. Nobody is removed by an import;
          deactivate them on the People page if they have left.
        </Alert>
      )}
      <RowsTable rows={result.rows} keyLabel={kind === 'staff' ? terms.staff_number : 'Code'} nameLabel={kind === 'staff' ? 'Name' : 'Competency'} />
      {result.requirements && (
        <Box mt={3}>
          <Typography variant="subtitle2" gutterBottom>Role requirements</Typography>
          <Counts counts={result.requirements.counts} />
          <RowsTable rows={result.requirements.rows} keyLabel="Competency" nameLabel="Post" />
        </Box>
      )}
    </Box>
  );
}

Result.propTypes = { result: PropTypes.object.isRequired, kind: PropTypes.string.isRequired, terms: PropTypes.object.isRequired };

function ImportCard({ kind, title, description, onImported }) {
  const terms = useTerms();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (commit) => {
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('commit', commit ? 'true' : 'false');
      const { data } = await api.post(`/imports/${kind}/`, body);
      setResult(data);
      if (commit) onImported();
    } catch (err) {
      setError(errorMessage(err));
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const template = async () => {
    try {
      await downloadFile(`/imports/${kind}/template/`, undefined, `lsms-${kind}-template.xlsx`);
    } catch (err) {
      setError(await blobErrorMessage(err));
    }
  };

  const canImport = result && !result.committed && (result.counts.created + result.counts.updated > 0
    || (result.requirements && result.requirements.counts.created + result.requirements.counts.updated > 0));

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6">{title}</Typography>
      <Typography color="text.secondary" mb={2}>{description}</Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
        <Button startIcon={<DownloadIcon />} onClick={template}>Download template</Button>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
          Choose file
          <input hidden type="file" accept=".xlsx,.csv" aria-label={`${title} file`}
            onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); setError(''); e.target.value = ''; }} />
        </Button>
        {file && <Typography variant="body2">{file.name}</Typography>}
        <Button variant="contained" disabled={!file || busy} onClick={() => send(false)}>Check file</Button>
        {canImport && <Button variant="contained" color="success" disabled={busy} onClick={() => send(true)}>Import</Button>}
      </Stack>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {result && <Result result={result} kind={kind} terms={terms} />}
    </Paper>
  );
}

ImportCard.propTypes = {
  kind: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  onImported: PropTypes.func.isRequired,
};

function History({ runs }) {
  if (runs.length === 0) return null;
  return (
    <Paper sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>When</TableCell>
            <TableCell>What</TableCell>
            <TableCell>File</TableCell>
            <TableCell>By</TableCell>
            <TableCell>Result</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{new Date(run.created_at).toLocaleString()}</TableCell>
              <TableCell>{run.kind === 'staff' ? 'Staff' : 'Competency framework'}</TableCell>
              <TableCell>{run.file_name}</TableCell>
              <TableCell>{run.created_by_name || '—'}</TableCell>
              <TableCell><Counts counts={run.counts} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

History.propTypes = { runs: PropTypes.array.isRequired };

export default function ImportPage() {
  const terms = useTerms();
  const [runs, setRuns] = useState([]);

  const loadRuns = useCallback(() => {
    api.get('/import-runs/').then(({ data }) => setRuns(data)).catch(() => setRuns([]));
  }, []);

  useEffect(() => { loadRuns(); }, [loadRuns]);

  return (
    <Box>
      <Typography variant="h5">Import</Typography>
      <Typography color="text.secondary" mb={3}>
        Load staff and competencies from a spreadsheet. Every file is checked first, so you see what will change before anything is saved.
      </Typography>
      <ImportCard
        kind="staff"
        title="Staff"
        description={`One row per officer: ${terms.staff_number}, name, department, post, ${terms.grade.toLowerCase()} and ${terms.job_family.toLowerCase()}. `
          + 'Use the template, or upload an export from your HR system as it is. Officers are matched on their number, so re-upload whenever HR updates the list.'}
        onImported={loadRuns}
      />
      <ImportCard
        kind="competencies"
        title={terms.competency_framework}
        description="The competencies staff are assessed on and the level each post requires. Download the template, fill it in from the official framework, and upload it. Import staff first so the posts exist."
        onImported={loadRuns}
      />
      {runs.length > 0 && <Typography variant="h6" mb={1}>Past imports</Typography>}
      <History runs={runs} />
    </Box>
  );
}
