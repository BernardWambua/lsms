import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import StatCard from '../common/StatCard';

// Headline gap figures for one person, from the gap engine.
export default function GapSummary({ gaps }) {
  return (
    <Grid container spacing={2} mb={3}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Gap score (0 = all met)" value={gaps.gap_score ?? undefined} suffix="%" />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}><StatCard label="Skills required" value={gaps.skills_required} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><StatCard label="Skills assessed" value={gaps.skills_assessed} /></Grid>
      <Grid size={{ xs: 6, md: 3 }}><StatCard label="High priority gaps" value={gaps.high_priority_gaps} /></Grid>
    </Grid>
  );
}

GapSummary.propTypes = {
  gaps: PropTypes.object.isRequired,
};
