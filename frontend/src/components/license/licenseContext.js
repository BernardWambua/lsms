import { useContext as useReactContext, createContext, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import api from '../../api';
import { useAuth } from '../auth/authContext';

const LicenseContext = createContext({ license: null, reload: () => {} });

// The logged-in organisation's licence, loaded once after login. Super admins have none of their own.
export const LicenseProvider = ({ children }) => {
  const { user } = useAuth();
  const [license, setLicense] = useState(null);
  const tenant = user && !user.is_superuser ? user.tenant : null;

  const reload = useCallback(async () => {
    if (!tenant) {
      setLicense(null);
      return;
    }
    try {
      const { data } = await api.get('/license/');
      setLicense(data?.state ? data : null);
    } catch {
      setLicense(null);
    }
  }, [tenant]);

  useEffect(() => { reload(); }, [reload]);

  return <LicenseContext.Provider value={{ license, reload }}>{children}</LicenseContext.Provider>;
};

export const useLicense = () => useReactContext(LicenseContext);

LicenseProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
