import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LanOutlinedIcon from '@mui/icons-material/LanOutlined';
import api from '../../api';
import { errorMessage } from '../../utils/errors';
import OrgTree from '../structure/OrgTree';
import OrgChart from '../structure/OrgChart';

function collectIds(units, ids = []) {
  units.forEach((unit) => {
    ids.push(unit.id);
    collectIds(unit.children, ids);
  });
  return ids;
}

// Admin view of the whole organisation: org units nested under their parents,
// each with the job roles placed in it. Shown as a tree or an org chart.
export default function OrgStructurePage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'chart' ? 'chart' : 'tree';
  const [structure, setStructure] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    api.get('/org-structure/')
      .then(({ data }) => {
        setStructure(data);
        setExpanded(new Set(collectIds(data.units)));
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  const allIds = useMemo(() => (structure ? collectIds(structure.units) : []), [structure]);

  const toggle = (id) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const changeView = (event, value) => {
    if (value) setParams(value === 'tree' ? {} : { view: value }, { replace: true });
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!structure) return <Box textAlign="center" mt={8}><CircularProgress /></Box>;

  const empty = structure.units.length === 0 && structure.unassigned_job_roles.length === 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2} flexWrap="wrap" mb={3}>
        <Box>
          <Typography variant="h5">Org structure</Typography>
          <Typography color="text.secondary">
            {structure.tenant.name}'s org units and the job roles in each.
          </Typography>
        </Box>
        <ToggleButtonGroup size="small" exclusive value={view} onChange={changeView} aria-label="View">
          <ToggleButton value="tree" aria-label="Tree view"><AccountTreeIcon fontSize="small" sx={{ mr: 1 }} />Tree</ToggleButton>
          <ToggleButton value="chart" aria-label="Org chart view"><LanOutlinedIcon fontSize="small" sx={{ mr: 1 }} />Org chart</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {empty ? (
        <Alert severity="info">
          Nothing here yet. Add org units and job roles and they'll appear in this view.
        </Alert>
      ) : view === 'tree' ? (
        <>
          <Box display="flex" gap={1} mb={1}>
            <Button size="small" onClick={() => setExpanded(new Set(allIds))}>Expand all</Button>
            <Button size="small" onClick={() => setExpanded(new Set())}>Collapse all</Button>
          </Box>
          <OrgTree units={structure.units} unassignedRoles={structure.unassigned_job_roles} expanded={expanded} onToggle={toggle} />
        </>
      ) : (
        <OrgChart units={structure.units} unassignedRoles={structure.unassigned_job_roles} />
      )}
    </Box>
  );
}
