import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext({ canEdit: true });

export function AuthProvider({ children }) {
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('gc_token');
    if (!token) { setCanEdit(false); return; }
    api.get('/auth/me')
      .then(({ data }) => setCanEdit(!data.readOnly))
      .catch((err) => {
        if (err.response?.status === 403) {
          localStorage.removeItem('gc_token');
          window.location.href = '/login';
        }
      });
  }, []);

  return <AuthContext.Provider value={{ canEdit }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
