import { useEffect } from 'react';
import { Alert, Box, Chip, Grid, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { useLicense } from './licenseContext';
import { formatDate, LICENSE_STATES } from '../../utils/license';

function Fact({ label, children }) {
  return (
    <Box>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography>{children}</Typography>
    </Box>
  );
}

// An admin's view of the organisation's licence: plan, term and staff used against the band.
export default function LicensePage() {
  const { license, reload } = useLicense();

  // Staff numbers change as people are added, so fetch fresh figures on each visit.
  useEffect(() => { reload(); }, [reload]);

  if (!license) return null;
  const state = LICENSE_STATES[license.state];
  const limited = license.staff_limit !== null;
  const used = limited ? Math.min(100, (license.staff_count / license.staff_limit) * 100) : 0;

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={3} flexWrap="wrap">
        <Typography variant="h4">Licence</Typography>
        <Chip label={state.label} color={state.color} />
      </Stack>

      {license.plan === 'pilot' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You are on a free pilot. Everything works as in a paid licence, except that TNA reports carry an evaluation watermark.
        </Alert>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Stack spacing={2}>
              <Fact label="Plan">{license.plan_label}</Fact>
              <Fact label="Term">{formatDate(license.starts_on)} to {formatDate(license.ends_on)}</Fact>
              <Fact label="Grace period ends">{formatDate(license.grace_ends_on)}</Fact>
              {license.lpo_number && <Fact label="LPO number">{license.lpo_number}</Fact>}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
            <Typography variant="body2" color="text.secondary">Active staff</Typography>
            <Typography variant="h4" fontWeight="bold" my={1}>
              {license.staff_count.toLocaleString()}{limited && ` of ${license.staff_limit.toLocaleString()}`}
            </Typography>
            {limited && <LinearProgress variant="determinate" value={used} color={used >= 90 ? 'warning' : 'primary'} sx={{ height: 8, borderRadius: 4, mb: 1 }} />}
            <Typography variant="body2" color="text.secondary">{license.band_label}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Typography color="text.secondary" mt={3}>
        Licences run for the financial year (1 July to 30 June). To renew, or to move to a larger staff band, send the LPO to your LSMS account manager.
        If the licence lapses, LSMS stays readable for everyone and reports can still be downloaded; only changes are paused.
      </Typography>
    </Box>
  );
}
