import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import api from '../../api';
import { errorMessage } from '../../utils/errors';

// Create an organisation (super admins, with its first admin's email) or edit one's details.
export default function TenantFormDialog({ open, tenant, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', industry: '', admin_email: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ name: tenant?.name || '', industry: tenant?.industry || '', admin_email: '' });
      setError('');
    }
  }, [open, tenant]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const { data } = tenant
        ? await api.patch(`/tenants/${tenant.id}/`, { name: form.name, industry: form.industry })
        : await api.post('/tenants/', { name: form.name, industry: form.industry, ...(form.admin_email ? { admin_email: form.admin_email } : {}) });
      onSaved(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={save}>
        <DialogTitle>{tenant ? 'Edit organisation' : 'New organisation'}</DialogTitle>
        <DialogContent>
          <TextField label="Name" value={form.name} onChange={update('name')} required fullWidth margin="normal" autoFocus />
          <TextField label="Industry" value={form.industry} onChange={update('industry')} fullWidth margin="normal" />
          {!tenant && (
            <TextField
              label="First admin's email"
              type="email"
              value={form.admin_email}
              onChange={update('admin_email')}
              fullWidth
              margin="normal"
              helperText="They'll get an invitation to join as the organisation's admin."
            />
          )}
          {error && <Typography color="error" mt={1}>{error}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">{tenant ? 'Save' : 'Create'}</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

TenantFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  tenant: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func.isRequired,
};
