import { useContext as useReactContext, createContext, useCallback, useEffect, useState } from "react";
import PropTypes from "prop-types";
import api, { clearTokens } from "../../api";

const AuthContext = createContext(null);

// 'superadmin' runs the platform; tenant users are 'admin', 'manager' or 'employee'.
export function roleOf(user) {
  if (!user) return null;
  return user.is_superuser ? 'superadmin' : user.role;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!sessionStorage.getItem('access_token'));

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/users/me/');
      setUser(data);
      return data;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem('access_token')) loadMe();
  }, [loadMe]);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('lsms:session-expired', onExpired);
    return () => window.removeEventListener('lsms:session-expired', onExpired);
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/token/', { username, password });
    sessionStorage.setItem('access_token', data.access);
    sessionStorage.setItem('refresh_token', data.refresh);
    return loadMe();
  };

  const logout = () => {
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, role: roleOf(user), loading, login, logout, reload: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useReactContext(AuthContext);
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
