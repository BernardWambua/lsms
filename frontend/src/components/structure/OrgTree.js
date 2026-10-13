import PropTypes from 'prop-types';
import { Box, Chip, Collapse, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ApartmentIcon from '@mui/icons-material/Apartment';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import { roleShape, unitShape } from './shapes';

const INDENT = 3;

function RoleItem({ role, depth }) {
  return (
    <ListItem dense sx={{ pl: 2 + depth * INDENT + 4 }}>
      <ListItemIcon sx={{ minWidth: 32 }}><WorkOutlineIcon fontSize="small" color="action" /></ListItemIcon>
      <ListItemText primary={role.title} secondary={role.description || null} secondaryTypographyProps={{ noWrap: true }} />
    </ListItem>
  );
}

RoleItem.propTypes = { role: roleShape.isRequired, depth: PropTypes.number.isRequired };

function UnitItem({ unit, depth, expanded, onToggle }) {
  const open = expanded.has(unit.id);
  const hasContents = unit.children.length > 0 || unit.job_roles.length > 0;
  const roleCount = unit.job_roles.length;
  return (
    <>
      <ListItemButton onClick={() => onToggle(unit.id)} disabled={!hasContents} sx={{ pl: 2 + depth * INDENT, '&.Mui-disabled': { opacity: 1 } }} aria-expanded={hasContents ? open : undefined}>
        <Box sx={{ width: 28, display: 'flex' }}>
          {hasContents && (open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />)}
        </Box>
        <ListItemIcon sx={{ minWidth: 32 }}><ApartmentIcon fontSize="small" color="primary" /></ListItemIcon>
        <ListItemText primary={unit.name} primaryTypographyProps={{ fontWeight: 500 }} />
        <Chip size="small" variant="outlined" label={`${roleCount} ${roleCount === 1 ? 'role' : 'roles'}`} />
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List disablePadding>
          {unit.job_roles.map((role) => <RoleItem key={role.id} role={role} depth={depth} />)}
          {unit.children.map((child) => (
            <UnitItem key={child.id} unit={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))}
        </List>
      </Collapse>
    </>
  );
}

UnitItem.propTypes = {
  unit: unitShape.isRequired,
  depth: PropTypes.number.isRequired,
  expanded: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
};

// Collapsible outline of the organisation: units nest under their parents and
// list their job roles first.
export default function OrgTree({ units, unassignedRoles, expanded, onToggle }) {
  return (
    <Paper variant="outlined">
      <List disablePadding aria-label="Org structure tree">
        {units.map((unit) => <UnitItem key={unit.id} unit={unit} depth={0} expanded={expanded} onToggle={onToggle} />)}
      </List>
      {unassignedRoles.length > 0 && (
        <Box borderTop={1} borderColor="divider" pt={1}>
          <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>Not in any org unit</Typography>
          <List disablePadding dense>
            {unassignedRoles.map((role) => <RoleItem key={role.id} role={role} depth={-1} />)}
          </List>
        </Box>
      )}
    </Paper>
  );
}

OrgTree.propTypes = {
  units: PropTypes.arrayOf(unitShape).isRequired,
  unassignedRoles: PropTypes.arrayOf(roleShape).isRequired,
  expanded: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
};
