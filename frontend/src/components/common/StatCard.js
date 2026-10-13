import PropTypes from 'prop-types';
import { Card, CardActionArea, CardContent, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function StatCard({ label, value, to }) {
  const navigate = useNavigate();
  const content = (
    <CardContent>
      <Typography variant="h4" fontWeight="bold">{value ?? '—'}</Typography>
      <Typography color="text.secondary">{label}</Typography>
    </CardContent>
  );
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      {to ? <CardActionArea onClick={() => navigate(to)} sx={{ height: '100%' }}>{content}</CardActionArea> : content}
    </Card>
  );
}

StatCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number,
  to: PropTypes.string,
};
