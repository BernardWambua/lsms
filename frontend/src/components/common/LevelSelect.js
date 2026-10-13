import PropTypes from 'prop-types';
import { MenuItem, TextField } from '@mui/material';
import { LEVELS } from '../../utils/levels';

// A 1-5 proficiency level picker. `emptyLabel` adds a blank option (value '').
export default function LevelSelect({ value, onChange, emptyLabel, ...props }) {
  return (
    <TextField select value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} {...props}>
      {emptyLabel && <MenuItem value=""><em>{emptyLabel}</em></MenuItem>}
      {LEVELS.map((l) => <MenuItem key={l.value} value={l.value}>{l.value} · {l.label}</MenuItem>)}
    </TextField>
  );
}

LevelSelect.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  emptyLabel: PropTypes.string,
};
