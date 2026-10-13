import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Link, MenuItem, Paper,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../api';
import { errorMessage } from '../../utils/errors';

function emptyForm(fields) {
  return Object.fromEntries(fields.map((f) => [f.name, f.default ?? '']));
}

/**
 * A list of one API resource with create / edit / delete in a dialog.
 *
 * `fields` describe the form: { name, label, type: 'text' | 'multiline' | 'number' | 'select',
 * required, default, choices: [{ value, label }] or optionsFrom: '/endpoint/' + optionLabel }.
 * `columns` describe the table: { field, label } (select fields show their option's label).
 * `rowLink(item)` makes each row's first column a link to that item's own page.
 */
export default function ResourcePage({ title, description, endpoint, params, fields, columns, readOnly, itemName, rowLink }) {
  const [items, setItems] = useState([]);
  const [options, setOptions] = useState({});
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null = closed, {} = new, item = edit
  const [form, setForm] = useState(emptyForm(fields));
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      const sources = fields.filter((f) => f.optionsFrom);
      const [list, ...lookups] = await Promise.all([
        api.get(endpoint, { params }),
        ...sources.map((f) => api.get(f.optionsFrom, { params })),
      ]);
      setItems(list.data);
      setOptions(Object.fromEntries(sources.map((f, i) => [
        f.name, lookups[i].data.map((row) => ({ value: row.id, label: row[f.optionLabel || 'name'] })),
      ])));
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
    // `params` is an object literal from the caller; compare it by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, JSON.stringify(params), fields]);

  useEffect(() => { load(); }, [load]);

  const choicesFor = useCallback((field) => field.choices || options[field.name] || [], [options]);

  const labels = useMemo(() => Object.fromEntries(fields
    .filter((f) => f.type === 'select')
    .map((f) => [f.name, Object.fromEntries(choicesFor(f).map((c) => [String(c.value), c.label]))])), [fields, choicesFor]);

  const display = (item, field) => {
    const value = item[field];
    if (value === null || value === undefined || value === '') return '—';
    return labels[field]?.[String(value)] ?? String(value);
  };

  const open = (item) => {
    setFormError('');
    setEditing(item || {});
    setForm(item ? Object.fromEntries(fields.map((f) => [f.name, item[f.name] ?? ''])) : emptyForm(fields));
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(fields.map((f) => [f.name, form[f.name] === '' && f.type === 'select' ? null : form[f.name]]));
    try {
      if (editing.id) {
        await api.patch(`${endpoint}${editing.id}/`, payload);
      } else {
        await api.post(endpoint, payload);
      }
      setEditing(null);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete this ${itemName}? This can't be undone.`)) return;
    try {
      await api.delete(`${endpoint}${item.id}/`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h5">{title}</Typography>
          {description && <Typography color="text.secondary">{description}</Typography>}
        </Box>
        {!readOnly && <Button variant="contained" startIcon={<AddIcon />} onClick={() => open(null)}>Add {itemName}</Button>}
      </Box>
      {error && <Typography color="error" mb={2}>{error}</Typography>}
      <Paper sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => <TableCell key={c.field}>{c.label}</TableCell>)}
              {!readOnly && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.length === 0 && (
              <TableRow><TableCell colSpan={columns.length + 1}><Typography color="text.secondary">Nothing here yet.</Typography></TableCell></TableRow>
            )}
            {items.map((item) => (
              <TableRow key={item.id} hover>
                {columns.map((c, index) => (
                  <TableCell key={c.field}>
                    {rowLink && index === 0
                      ? <Link component={RouterLink} to={rowLink(item)}>{display(item, c.field)}</Link>
                      : display(item, c.field)}
                  </TableCell>
                ))}
                {!readOnly && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => open(item)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" onClick={() => remove(item)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={save}>
          <DialogTitle>{editing?.id ? `Edit ${itemName}` : `Add ${itemName}`}</DialogTitle>
          <DialogContent>
            {fields.map((f, index) => (
              <TextField
                key={f.name}
                label={f.label}
                autoFocus={index === 0}
                value={form[f.name]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                required={f.required}
                type={f.type === 'number' ? 'number' : 'text'}
                inputProps={f.type === 'number' ? { min: f.min, max: f.max } : undefined}
                select={f.type === 'select'}
                multiline={f.type === 'multiline'}
                minRows={f.type === 'multiline' ? 3 : undefined}
                helperText={f.help}
                fullWidth
                margin="normal"
              >
                {f.type === 'select' && !f.required && <MenuItem value=""><em>None</em></MenuItem>}
                {f.type === 'select' && choicesFor(f)
                  .filter((c) => !(f.excludeSelf && editing?.id && c.value === editing.id))
                  .map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            ))}
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

ResourcePage.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  endpoint: PropTypes.string.isRequired,
  params: PropTypes.object,
  fields: PropTypes.arrayOf(PropTypes.object).isRequired,
  columns: PropTypes.arrayOf(PropTypes.object).isRequired,
  readOnly: PropTypes.bool,
  itemName: PropTypes.string.isRequired,
  rowLink: PropTypes.func,
};
