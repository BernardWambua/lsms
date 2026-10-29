import { Alert, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/authContext';
import { bannerFor } from '../../utils/license';
import { useLicense } from './licenseContext';

export default function LicenseBanner() {
  const { role } = useAuth();
  const { license } = useLicense();
  const navigate = useNavigate();
  const banner = bannerFor(license, role);
  if (!banner) return null;
  return (
    <Alert
      severity={banner.severity}
      sx={{ mb: 3 }}
      action={role === 'admin' ? <Button color="inherit" size="small" onClick={() => navigate('/license')}>Licence</Button> : null}
    >
      {banner.text}
    </Alert>
  );
}
