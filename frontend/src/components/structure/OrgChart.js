import PropTypes from 'prop-types';
import { Box, Paper, Typography } from '@mui/material';
import { roleShape, unitShape } from './shapes';

const GAP = 20;
const LINE = (theme) => `1px solid ${theme.palette.grey[400]}`;

// Classic top-down org chart drawn with nested lists; the connector lines are
// CSS borders on each item's ::before/::after, so it needs no charting library.
const chartSx = (theme) => ({
  overflowX: 'auto',
  pb: 2,
  '& ul': {
    display: 'flex',
    justifyContent: 'center',
    position: 'relative',
    m: 0,
    p: 0,
    pt: `${GAP}px`,
  },
  '& > ul': { pt: 0, minWidth: 'max-content' },
  '& li': {
    listStyle: 'none',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    px: 1,
    pt: `${GAP}px`,
  },
  '& li::before, & li::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    right: '50%',
    width: '50%',
    height: GAP,
    borderTop: LINE(theme),
  },
  '& li::after': { right: 'auto', left: '50%', borderLeft: LINE(theme) },
  '& li:only-child::before, & li:only-child::after': { display: 'none' },
  '& li:only-child': { pt: 0 },
  '& li:first-of-type::before, & li:last-of-type::after': { border: 'none' },
  '& li:last-of-type::before': { borderRight: LINE(theme), borderTopRightRadius: 6 },
  '& li:first-of-type::after': { borderTopLeftRadius: 6 },
  '& ul ul::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '50%',
    height: GAP,
    borderLeft: LINE(theme),
  },
  // Top-level units stand side by side with no parent to connect to.
  '& > ul > li': { pt: 0 },
  '& > ul > li::before, & > ul > li::after': { display: 'none' },
});

function UnitNode({ unit }) {
  return (
    <li>
      <Paper variant="outlined" sx={{ width: 200, p: 1.5, borderTop: 3, borderTopColor: 'primary.main' }}>
        <Typography fontWeight="bold" gutterBottom={unit.job_roles.length > 0}>{unit.name}</Typography>
        {unit.job_roles.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No job roles</Typography>
        ) : (
          unit.job_roles.map((role) => (
            <Typography key={role.id} variant="body2" color="text.secondary" noWrap title={role.title}>
              {role.title}
            </Typography>
          ))
        )}
      </Paper>
      {unit.children.length > 0 && (
        <ul>
          {unit.children.map((child) => <UnitNode key={child.id} unit={child} />)}
        </ul>
      )}
    </li>
  );
}

UnitNode.propTypes = { unit: unitShape.isRequired };

export default function OrgChart({ units, unassignedRoles }) {
  return (
    <Box>
      <Box sx={chartSx} aria-label="Org chart">
        <ul>
          {units.map((unit) => <UnitNode key={unit.id} unit={unit} />)}
        </ul>
      </Box>
      {unassignedRoles.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
          <Typography variant="overline" color="text.secondary">Not in any org unit</Typography>
          <Typography variant="body2">{unassignedRoles.map((role) => role.title).join(', ')}</Typography>
        </Paper>
      )}
    </Box>
  );
}

OrgChart.propTypes = {
  units: PropTypes.arrayOf(unitShape).isRequired,
  unassignedRoles: PropTypes.arrayOf(roleShape).isRequired,
};
