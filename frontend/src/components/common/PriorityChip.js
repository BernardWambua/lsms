import PropTypes from 'prop-types';
import { Chip } from '@mui/material';
import { PRIORITIES } from '../../utils/levels';

export default function PriorityChip({ priority }) {
  const p = PRIORITIES[priority] || PRIORITIES.not_assessed;
  return <Chip size="small" label={p.label} color={p.color} variant={priority === 'not_assessed' ? 'outlined' : 'filled'} />;
}

PriorityChip.propTypes = {
  priority: PropTypes.string,
};
